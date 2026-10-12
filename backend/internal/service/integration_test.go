//go:build integration

package service

import (
	"afterframe/internal/catalog"
	"afterframe/internal/db"
	"context"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPostgresJourneys(t *testing.T) {
	ctx := context.Background()
	container, e := postgres.Run(ctx, "pgvector/pgvector:pg17", postgres.WithDatabase("afterframe_test"), postgres.WithUsername("postgres"), postgres.WithPassword("isolated-test-only"), postgres.BasicWaitStrategies())
	if e != nil {
		t.Fatal(e)
	}
	defer testcontainers.TerminateContainer(container)
	url, e := container.ConnectionString(ctx, "sslmode=disable")
	if e != nil {
		t.Fatal(e)
	}
	pool, e := pgxpool.New(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	files, e := filepath.Glob("../../migrations/*.up.sql")
	if e != nil {
		t.Fatal(e)
	}
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = pool.Exec(ctx, string(data)); err != nil {
			t.Fatal(file, err)
		}
	}
	s := &Service{Pool: pool, Catalog: catalog.New("")}
	a, b := uuid.NewString(), uuid.NewString()
	if e = s.Ensure(ctx, a); e != nil {
		t.Fatal(e)
	}
	if e = s.Ensure(ctx, b); e != nil {
		t.Fatal(e)
	}
	_, e = db.New(pool).UpsertFilm(ctx, pack(catalog.Film{ID: 550, Title: "Fight Club", Year: "1999", Genres: []string{"Drama"}}))
	if e != nil {
		t.Fatal(e)
	}
	rating := 4.0
	in := Input{FilmID: 550, WatchedOn: "2024-10-10", Rating: &rating, Notes: "first impression", RequestID: uuid.NewString(), Scene: "Rain on a neon window", Emotion: "unsettled", Context: "watched with college friends", Private: true}
	v, e := s.Write(ctx, a, "diary", in)
	if e != nil {
		t.Fatal(e)
	}
	viewID := object(v)["id"].(string)
	t.Run("atomic idempotent film logging", func(t *testing.T) {
		var wg sync.WaitGroup
		for i := 0; i < 6; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if _, e := s.Write(ctx, a, "diary", in); e != nil {
					t.Error(e)
				}
			}()
		}
		wg.Wait()
		var count int
		pool.QueryRow(ctx, "SELECT count(*) FROM viewings WHERE user_id=$1", a).Scan(&count)
		if count != 1 {
			t.Fatalf("duplicate viewing: %d", count)
		}
		pool.QueryRow(ctx, "SELECT count(*) FROM opinions WHERE user_id=$1", a).Scan(&count)
		if count != 1 {
			t.Fatal("duplicate opinion")
		}
	})
	t.Run("Global vs tribe taste: suppression, duplicate-rating protection, and membership exclusion", func(t *testing.T) {
		// Fresh users, not the shared a/b — later subtests assert *absolute*
		// counts of a's total viewings across all films, so adding viewings
		// for a/b here would break them.
		ta, tb, tc, td := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
		for _, u := range []string{ta, tb, tc, td} {
			if e := s.Ensure(ctx, u); e != nil {
				t.Fatal(e)
			}
		}
		if _, e := db.New(pool).UpsertFilm(ctx, pack(catalog.Film{ID: 13, Title: "Forrest Gump", Year: "1994", Genres: []string{"Drama"}})); e != nil {
			t.Fatal(e)
		}
		rate := func(user string, r float64, reqID string) {
			rating := r
			if _, e := s.Write(ctx, user, "diary", Input{FilmID: 13, WatchedOn: "2024-01-01", Rating: &rating, RequestID: reqID}); e != nil {
				t.Fatal(e)
			}
		}
		// ta rates it, then rewatches and re-rates lower — only the latest
		// should ever count, proving a user can't inflate the average by
		// submitting duplicate ratings.
		rate(ta, 5.0, uuid.NewString())
		rate(ta, 1.0, uuid.NewString())
		rate(tb, 5.0, uuid.NewString())
		rate(tc, 5.0, uuid.NewString())
		rate(td, 5.0, uuid.NewString())

		global, e := s.FilmRatings(ctx, ta, 13, "")
		if e != nil {
			t.Fatal(e)
		}
		var g struct {
			Global struct {
				Score      *float64 `json:"score"`
				SampleSize int      `json:"sample_size"`
				Source     string   `json:"source"`
			} `json:"global"`
		}
		json.Unmarshal(global, &g)
		if g.Global.SampleSize != 4 {
			t.Fatalf("expected 4 raters (one each), got %d — a duplicate rating was counted twice", g.Global.SampleSize)
		}
		if g.Global.Score == nil || *g.Global.Score != 4.0 {
			t.Fatalf("expected avg(1,5,5,5)=4.0 using only a's latest rating, got %v", g.Global.Score)
		}
		if g.Global.Source != "afterframe_community" {
			t.Fatalf("global rating needs a clear source label, got %q", g.Global.Source)
		}

		// Only a and c join the tribe: below the minimum sample, the tribe
		// score must be suppressed (nil) even though a real average could
		// technically be computed — sample size still visible.
		if _, e = s.SetTribe(ctx, ta, "horror_enthusiasts", true); e != nil {
			t.Fatal(e)
		}
		if _, e = s.SetTribe(ctx, tc, "horror_enthusiasts", true); e != nil {
			t.Fatal(e)
		}
		sparse, e := s.FilmRatings(ctx, ta, 13, "horror_enthusiasts")
		if e != nil {
			t.Fatal(e)
		}
		var sp struct {
			Tribe struct {
				Score      *float64 `json:"score"`
				SampleSize int      `json:"sample_size"`
			} `json:"tribe"`
		}
		json.Unmarshal(sparse, &sp)
		if sp.Tribe.Score != nil {
			t.Fatalf("a 2-rater tribe sample should be suppressed, not fabricated: %v", *sp.Tribe.Score)
		}
		if sp.Tribe.SampleSize != 2 {
			t.Fatalf("sample size must stay visible even when the score is suppressed, got %d", sp.Tribe.SampleSize)
		}

		// d also joins: now at the minimum sample, with a real (and
		// different-from-global) average — b's 5.0 correctly excluded
		// since b never joined.
		if _, e = s.SetTribe(ctx, td, "horror_enthusiasts", true); e != nil {
			t.Fatal(e)
		}
		full, e := s.FilmRatings(ctx, ta, 13, "horror_enthusiasts")
		if e != nil {
			t.Fatal(e)
		}
		var fl struct {
			Tribe struct {
				Score      *float64 `json:"score"`
				SampleSize int      `json:"sample_size"`
				Source     string   `json:"source"`
			} `json:"tribe"`
		}
		json.Unmarshal(full, &fl)
		if fl.Tribe.SampleSize != 3 {
			t.Fatalf("expected 3 tribe raters (a, c, d — not b), got %d", fl.Tribe.SampleSize)
		}
		wantAvg := (1.0 + 5.0 + 5.0) / 3.0
		if fl.Tribe.Score == nil || *fl.Tribe.Score < wantAvg-0.001 || *fl.Tribe.Score > wantAvg+0.001 {
			t.Fatalf("expected tribe avg %.4f excluding b's rating, got %v", wantAvg, fl.Tribe.Score)
		}
		if fl.Tribe.Source != "Horror enthusiasts" {
			t.Fatalf("tribe rating needs a clear source label, got %q", fl.Tribe.Source)
		}

		// Unrecognized tribe IDs are rejected, not silently accepted.
		if _, e = s.SetTribe(ctx, ta, "made_up_tribe", true); e == nil {
			t.Fatal("accepted a tribe outside the fixed, documented list")
		}
		if _, e = s.FilmRatings(ctx, ta, 13, "made_up_tribe"); e == nil {
			t.Fatal("computed a rating for an undocumented tribe")
		}

		// b never joined, so leaving an un-joined tribe is a harmless no-op,
		// not an error — matches this codebase's existing mute/follow pattern.
		if _, e = s.SetTribe(ctx, tb, "horror_enthusiasts", false); e != nil {
			t.Fatal(e)
		}
	})
	t.Run("Craft Mode spoiler gating, privacy, and search", func(t *testing.T) {
		// A dedicated film, not 550 — the later "Spoiler Safe" subtest relies
		// on b's reveal layer for 550 starting unrevealed, and craft notes
		// share the exact same `reveals`/viewed-it auto-unlock mechanism, so
		// reusing 550 here would leak state between the two subtests.
		if _, e := db.New(pool).UpsertFilm(ctx, pack(catalog.Film{ID: 603, Title: "The Matrix", Year: "1999", Genres: []string{"Science Fiction"}})); e != nil {
			t.Fatal(e)
		}
		pubSpoiler, e := s.Write(ctx, a, "craft", Input{
			FilmID: 603, Category: "scene_reference",
			Scene: "The twist in the final act", Body: "It was him all along.",
			Spoiler: true, Private: false,
		})
		if e != nil {
			t.Fatal(e)
		}
		privateNote, e := s.Write(ctx, a, "craft", Input{
			FilmID: 603, Category: "cinematography",
			Scene: "Lighting in the apartment", Body: "Hard sidelight throughout.",
			Spoiler: false, Private: true,
		})
		if e != nil {
			t.Fatal(e)
		}

		// b hasn't watched 603 and hasn't revealed: sees the public spoiler
		// note exists, but not its scene/body; never sees the private note.
		before, e := s.Read(ctx, b, "craft", Filter{FilmID: 603})
		if e != nil {
			t.Fatal(e)
		}
		var notes []map[string]any
		json.Unmarshal(before, &notes)
		if len(notes) != 1 {
			t.Fatalf("private note leaked, or public note missing: got %d notes", len(notes))
		}
		if _, ok := notes[0]["body"]; ok {
			t.Fatal("spoiler body visible to a viewer who hasn't watched or revealed")
		}
		if notes[0]["allowed_spoiler"] != false {
			t.Fatal("allowed_spoiler should be false before watching or revealing")
		}

		// Once b has actually watched the film, the same automatic layer-2
		// reveal reviews already grant applies here too.
		if _, e = s.Write(ctx, b, "diary", Input{FilmID: 603, WatchedOn: "2024-11-01", RequestID: uuid.NewString()}); e != nil {
			t.Fatal(e)
		}
		after, e := s.Read(ctx, b, "craft", Filter{FilmID: 603})
		if e != nil {
			t.Fatal(e)
		}
		var afterNotes []map[string]any
		json.Unmarshal(after, &afterNotes)
		if afterNotes[0]["body"] != "It was him all along." {
			t.Fatalf("spoiler body should unlock after watching: got %v", afterNotes[0]["body"])
		}

		// a's own search finds the note by its scene text, spoiler or private
		// status notwithstanding — it's always visible to its owner.
		found, e := s.Read(ctx, a, "craft", Filter{Query: "sidelight"})
		if e != nil {
			t.Fatal(e)
		}
		var ownNotes []map[string]any
		json.Unmarshal(found, &ownNotes)
		if len(ownNotes) != 1 || ownNotes[0]["body"] != "Hard sidelight throughout." {
			t.Fatalf("owner's search over their own craft notes failed: %v", ownNotes)
		}

		if _, e = s.Delete(ctx, a, "craft", object(pubSpoiler)["id"].(string)); e != nil {
			t.Fatal(e)
		}
		if _, e = s.Delete(ctx, a, "craft", object(privateNote)["id"].(string)); e != nil {
			t.Fatal(e)
		}
	})
	t.Run("Theatrical planning: invites, voting, group permissions, and decision", func(t *testing.T) {
		stranger := uuid.NewString()
		if e := s.Ensure(ctx, stranger); e != nil {
			t.Fatal(e)
		}
		planJSON, e := s.CreatePlan(ctx, a, 550, "Opening night?")
		if e != nil {
			t.Fatal(e)
		}
		planID := object(planJSON)["id"].(string)

		slot1JSON, e := s.AddPlanSlot(ctx, a, planID, "Friday 7pm")
		if e != nil {
			t.Fatal(e)
		}
		slot1 := object(slot1JSON)["id"].(string)
		if _, e = s.AddPlanSlot(ctx, a, planID, "Saturday 2pm"); e != nil {
			t.Fatal(e)
		}

		// A non-creator can't add slots — group permissions work.
		if _, e = s.AddPlanSlot(ctx, b, planID, "Sunday noon"); e == nil {
			t.Fatal("a non-creator added a slot")
		}

		// A stranger who was never invited can't see the plan at all.
		if _, e = s.PlanDetail(ctx, stranger, planID); e == nil {
			t.Fatal("an uninvited stranger could read a private plan")
		}

		if _, e = s.InvitePlanParticipant(ctx, a, planID, "b-does-not-exist-as-a-username"); e == nil {
			t.Fatal("invited a nonexistent username")
		}

		// b hasn't joined yet: a vote attempt is silently rejected by RLS
		// (no row inserted), not an error — mirrors how the rest of this
		// codebase treats a denied write as "nothing happened."
		if _, e = s.VotePlanSlot(ctx, b, slot1, true); e != nil {
			t.Fatal(e)
		}
		before, e := s.PlanDetail(ctx, a, planID)
		if e != nil {
			t.Fatal(e)
		}
		var beforeDetail struct {
			Slots []map[string]any `json:"slots"`
		}
		json.Unmarshal(before, &beforeDetail)
		if beforeDetail.Slots[0]["votes"].(float64) != 0 {
			t.Fatalf("a non-participant's vote should not count: %+v", beforeDetail.Slots[0])
		}

		// Find b's real username to invite properly, then respond and vote.
		meB, e := s.Read(ctx, b, "me", Filter{})
		if e != nil {
			t.Fatal(e)
		}
		bUsername := object(meB)["username"].(string)
		if _, e = s.InvitePlanParticipant(ctx, a, planID, bUsername); e != nil {
			t.Fatal(e)
		}
		if _, e = s.RespondPlanInvite(ctx, b, planID, true); e != nil {
			t.Fatal(e)
		}
		if _, e = s.VotePlanSlot(ctx, b, slot1, true); e != nil {
			t.Fatal(e)
		}
		if _, e = s.VotePlanSlot(ctx, a, slot1, true); e != nil {
			t.Fatal(e) // the creator is auto-joined and can vote on their own plan
		}

		after, e := s.PlanDetail(ctx, b, planID)
		if e != nil {
			t.Fatal(e)
		}
		var afterDetail struct {
			Slots []map[string]any `json:"slots"`
		}
		json.Unmarshal(after, &afterDetail)
		if afterDetail.Slots[0]["votes"].(float64) != 2 || afterDetail.Slots[0]["voted"] != true {
			t.Fatalf("expected 2 votes on slot 1, voted=true for b: %+v", afterDetail.Slots[0])
		}

		// Only the creator can decide — group permissions work both ways.
		if _, e = s.DecidePlan(ctx, b, planID, slot1, false); e == nil {
			t.Fatal("a non-creator decided the plan")
		}
		decided, e := s.DecidePlan(ctx, a, planID, slot1, false)
		if e != nil {
			t.Fatal(e)
		}
		d := object(decided)
		if d["status"] != "decided" || d["decided_slot_id"] != slot1 {
			t.Fatalf("plan change not persisted correctly: %+v", d)
		}

		// The stranger still can't see it even after a decision is made.
		if _, e = s.PlanDetail(ctx, stranger, planID); e == nil {
			t.Fatal("an uninvited stranger could read a decided plan")
		}

		// A separate plan can be cancelled outright.
		plan2JSON, e := s.CreatePlan(ctx, a, 550, "Or maybe not")
		if e != nil {
			t.Fatal(e)
		}
		cancelled, e := s.DecidePlan(ctx, a, object(plan2JSON)["id"].(string), "", true)
		if e != nil {
			t.Fatal(e)
		}
		if object(cancelled)["status"] != "cancelled" {
			t.Fatalf("cancellation not persisted: %+v", object(cancelled))
		}
	})
	t.Run("Memory Vault ownership keyword fuzzy update delete", func(t *testing.T) {
		m, e := s.Read(ctx, a, "memories", Filter{Query: "neon"})
		if e != nil {
			t.Fatal(e)
		}
		var memories []map[string]any
		json.Unmarshal(m, &memories)
		if len(memories) != 1 {
			t.Fatalf("missing keyword result: %s", m)
		}
		secretID := memories[0]["id"].(string)
		other, e := s.Read(ctx, b, "memories", Filter{Query: "neon"})
		if e != nil || string(other) != "[]" {
			t.Fatalf("cross-user search leak: %s %v", other, e)
		}
		if _, e = s.Write(ctx, b, "memories", Input{ViewingID: viewID, Scene: "stolen"}); e == nil {
			t.Fatal("cross-user write allowed")
		}
		if _, e = s.Delete(ctx, b, "memories", secretID); e == nil {
			t.Fatal("cross-user delete allowed")
		}
		m, e = s.Read(ctx, a, "memories", Filter{Query: "neonn"})
		if e != nil || string(m) == "[]" {
			t.Fatal("fuzzy retrieval missing", e)
		}
		if _, e = s.Write(ctx, a, "memories", Input{ViewingID: viewID, Scene: "revised lighthouse", Emotion: "calm", Context: "coast"}); e != nil {
			t.Fatal(e)
		}
		m, e = s.Read(ctx, a, "memories", Filter{Query: "lighthouse"})
		if e != nil || !strings.Contains(string(m), "lighthouse") {
			t.Fatal("edited index missing")
		}
		if _, e = s.Delete(ctx, a, "memories", secretID); e != nil {
			t.Fatal(e)
		}
		m, _ = s.Read(ctx, a, "memories", Filter{Query: "lighthouse"})
		if string(m) != "[]" {
			t.Fatal("deleted index survived")
		}
	})
	t.Run("Taste Timeline reflection never creates rewatch", func(t *testing.T) {
		five := 5.0
		if _, e = s.Write(ctx, a, "timeline", Input{FilmID: 550, Rating: &five, Reflection: "It grew on me"}); e != nil {
			t.Fatal(e)
		}
		timeline, e := s.Read(ctx, a, "timeline", Filter{FilmID: 550})
		if e != nil {
			t.Fatal(e)
		}
		var events []map[string]any
		json.Unmarshal(timeline, &events)
		if len(events) != 2 || events[0]["rating"] != 5.0 || events[1]["rating"] != 4.0 {
			t.Fatalf("history incorrect: %s", timeline)
		}
		var count int
		pool.QueryRow(ctx, "SELECT count(*) FROM viewings WHERE user_id=$1", a).Scan(&count)
		if count != 1 {
			t.Fatal("reflection became viewing")
		}
		if _, e = s.Delete(ctx, b, "diary", viewID); e == nil {
			t.Fatal("ownership bypass")
		}
	})
	t.Run("Spoiler Safe progressive disclosure and comments", func(t *testing.T) {
		r, e := s.Write(ctx, a, "reviews", Input{FilmID: 550, Safe: "Great atmosphere", Watched: "SECRET_ENDING", Reflection: "SECRET_MEANING"})
		if e != nil {
			t.Fatal(e)
		}
		rid := object(r)["id"].(string)
		feed, e := s.Read(ctx, b, "reviews", Filter{FilmID: 550})
		if e != nil {
			t.Fatal(e)
		}
		if strings.Contains(string(feed), "SECRET_") {
			t.Fatal("API spoiler leak")
		}
		if _, e = s.Write(ctx, b, "comments", Input{ID: rid, Body: "spoiler", Layer: 2}); e == nil {
			t.Fatal("hidden layer comment allowed")
		}
		if _, e = s.Write(ctx, b, "reveal", Input{FilmID: 550, Layer: 2}); e != nil {
			t.Fatal(e)
		}
		feed, e = s.Read(ctx, b, "reviews", Filter{FilmID: 550})
		if e != nil || !strings.Contains(string(feed), "SECRET_ENDING") || strings.Contains(string(feed), "SECRET_MEANING") {
			t.Fatalf("layer 2 policy failed %s %v", feed, e)
		}
		if _, e = s.Write(ctx, b, "reveal", Input{FilmID: 550, Layer: 3}); e != nil {
			t.Fatal(e)
		}
		feed, _ = s.Read(ctx, b, "reviews", Filter{FilmID: 550})
		if !strings.Contains(string(feed), "SECRET_MEANING") {
			t.Fatal("reflection missing")
		}
	})
	t.Run("list transaction rollback and ownership", func(t *testing.T) {
		list, e := s.Write(ctx, a, "lists", Input{Title: "Private list", Private: true, FilmIDs: []int64{550}})
		if e != nil {
			t.Fatal(e)
		}
		id := object(list)["id"].(string)
		if _, e = s.Write(ctx, b, "lists", Input{ID: id, Title: "stolen"}); e == nil {
			t.Fatal("list hijacked")
		}
		lists, _ := s.Read(ctx, b, "lists", Filter{})
		if strings.Contains(string(lists), id) {
			t.Fatal("private list leaked")
		}
		if _, e = s.Write(ctx, a, "lists", Input{Title: "duplicates", FilmIDs: []int64{550, 550}}); e == nil {
			t.Fatal("duplicate films allowed")
		}
	})
	t.Run("erasure retries remain durable during provider failure", func(t *testing.T) {
		user := uuid.NewString()
		if err := s.Ensure(ctx, user); err != nil {
			t.Fatal(err)
		}
		if _, err := s.Write(ctx, user, "diary", Input{FilmID: 550, WatchedOn: "2024-10-10", RequestID: uuid.NewString(), Scene: "erase this private memory"}); err != nil {
			t.Fatal(err)
		}
		if err := s.EraseAccount(ctx, user); err != nil {
			t.Fatal(err)
		}
		if err := s.Ensure(ctx, user); !errors.Is(err, ErrForbidden) {
			t.Fatal("tombstone did not deny recreation", err)
		}
		calls := 0
		s.RetryErasures(ctx, func(context.Context, string) error { calls++; return errors.New("provider unavailable") })
		var done bool
		if err := pool.QueryRow(ctx, "SELECT auth_deleted FROM deleted_accounts WHERE user_id=$1", user).Scan(&done); err != nil || done {
			t.Fatal("failure lost retry", err)
		}
		s.RetryErasures(ctx, func(context.Context, string) error { calls++; return nil })
		pool.QueryRow(ctx, "SELECT auth_deleted FROM deleted_accounts WHERE user_id=$1", user).Scan(&done)
		if calls != 2 || !done {
			t.Fatal("retry did not complete", calls, done)
		}
		var remaining int
		pool.QueryRow(ctx, "SELECT count(*) FROM memories WHERE user_id=$1", user).Scan(&remaining)
		if remaining != 0 {
			t.Fatal("private data survived")
		}
	})
	t.Run("large histories remain bounded and owner scoped", func(t *testing.T) {
		user := uuid.NewString()
		if err := s.Ensure(ctx, user); err != nil {
			t.Fatal(err)
		}
		_, err := pool.Exec(ctx, `INSERT INTO viewings(user_id,film_id,watched_on,request_id,notes,private) SELECT $1,550,'2024-10-10',gen_random_uuid(),'bulk fixture '||n,true FROM generate_series(1,2000) n`, user)
		if err != nil {
			t.Fatal(err)
		}
		_, err = pool.Exec(ctx, `INSERT INTO memories(user_id,viewing_id,scene,emotion,context) SELECT user_id,id,'lighthouse memory','calm','winter' FROM viewings WHERE user_id=$1`, user)
		if err != nil {
			t.Fatal(err)
		}
		start := time.Now()
		data, err := s.Read(ctx, user, "memories", Filter{Query: "lighthouse"})
		elapsed := time.Since(start)
		if err != nil {
			t.Fatal(err)
		}
		var rows []any
		json.Unmarshal(data, &rows)
		if len(rows) != 50 {
			t.Fatal("unbounded or missing results", len(rows))
		}
		t.Logf("2000 private memories: %s, 50-result bound", elapsed)
		profile, err := s.Read(ctx, user, "profile", Filter{TargetID: user})
		if err != nil {
			t.Fatal(err)
		}
		if len(object(profile)["diary"].([]any)) != 50 {
			t.Fatal("profile history not bounded")
		}

		_, err = pool.Exec(ctx, `INSERT INTO opinions(user_id,film_id,rating,reflection,kind) SELECT $1,550,4,'history fixture','reflection' FROM generate_series(1,2000)`, user)
		if err != nil {
			t.Fatal(err)
		}
		_, err = pool.Exec(ctx, `INSERT INTO reviews(user_id,film_id,safe,watched,reflection) SELECT $1,550,'safe fixture','plot fixture','reflection fixture' FROM generate_series(1,500)`, user)
		if err != nil {
			t.Fatal(err)
		}
		if out := os.Getenv("AFTERFRAME_AUDIT_OUTPUT"); out != "" {
			queries, err := os.ReadFile("../../queries/app.sql")
			if err != nil {
				t.Fatal(err)
			}
			plans := map[string]json.RawMessage{}
			for name, args := range map[string][]any{"SearchMemories": {"lighthouse", "", "", ""}, "Diary": {"", 0}, "Timeline": {int64(550)}, "ReadReviews": {int64(550), false, 0}, "Lists": {false, "", 0}} {
				marker := "-- name: " + name + " :one\n"
				parts := strings.Split(string(queries), marker)
				if len(parts) != 2 {
					t.Fatal(name)
				}
				query := strings.Split(parts[1], "-- name:")[0]
				tx, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				q := db.New(tx)
				if err = q.SetViewer(ctx, user); err != nil {
					t.Fatal(err)
				}
				if err = q.SetRole(ctx); err != nil {
					t.Fatal(err)
				}
				var plan []byte
				if err = tx.QueryRow(ctx, "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+query, args...).Scan(&plan); err != nil {
					tx.Rollback(ctx)
					t.Fatal(name, err)
				}
				tx.Rollback(ctx)
				plans[name] = plan
			}
			encoded, err := json.MarshalIndent(plans, "", "  ")
			if err != nil {
				t.Fatal(err)
			}
			if err = os.WriteFile(out, encoded, 0600); err != nil {
				t.Fatal(err)
			}
		}

		data, err = s.Read(ctx, b, "memories", Filter{Query: "lighthouse"})
		if err != nil || string(data) != "[]" {
			t.Fatal("bulk privacy isolation failed")
		}
		data, err = s.Read(ctx, user, "diary", Filter{Offset: 1950})
		json.Unmarshal(data, &rows)
		if err != nil || len(rows) != 50 {
			t.Fatal("large diary pagination", err, len(rows))
		}
	})
	t.Run("database failure rolls back prior list edits", func(t *testing.T) {
		data, err := s.Write(ctx, a, "lists", Input{Title: "rollback", FilmIDs: []int64{550}})
		if err != nil {
			t.Fatal(err)
		}
		id := ID(object(data)["id"].(string))
		_, err = s.Transaction(ctx, a, func(q *db.Queries) (any, error) {
			if err := q.DeleteListItems(ctx, id); err != nil {
				return nil, err
			}
			return nil, q.AddListItem(ctx, db.AddListItemParams{ListID: id, FilmID: 999999999, Position: 0})
		})
		if err == nil {
			t.Fatal("expected foreign-key error")
		}
		var count int
		pool.QueryRow(ctx, "SELECT count(*) FROM list_items WHERE list_id=$1", id).Scan(&count)
		if count != 1 {
			t.Fatal("transaction did not restore items")
		}
	})

}

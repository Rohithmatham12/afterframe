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

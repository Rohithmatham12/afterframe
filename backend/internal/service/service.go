package service

import (
	"afterframe/internal/catalog"
	"afterframe/internal/db"
	"afterframe/internal/memory"
	"afterframe/internal/recommend"
	"afterframe/internal/spoilers"
	"afterframe/internal/taste"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var ErrInvalid = errors.New("invalid input")
var ErrForbidden = errors.New("not found or not permitted")

// GAP 04: feelings belong to a viewing event, not the film, so the same film
// can carry different emotions across separate (re)watches. Mirrors the
// viewing_feelings table's CHECK constraint, which is the authoritative source.
var allowedFeelings = map[string]bool{
	"comforted": true, "wrecked": true, "inspired": true, "energized": true,
	"nostalgic": true, "uneasy": true, "hopeful": true, "melancholic": true,
	"amused": true, "thoughtful": true, "frustrated": true, "calm": true, "amazed": true,
}

// GAP 07: watchlist intent captures *why* a film was saved. Mirrors the
// watchlist.intent CHECK constraint; "" means no intent was given.
var allowedIntents = map[string]bool{
	"": true, "date_night": true, "rainy_day": true, "friends_recommended": true,
	"family_night": true, "weekend": true, "comfort_watch": true, "short_movie": true,
	"personal_recommendation": true,
}

// GAP 19: who/why someone watched. Mirrors viewings.context's CHECK constraint.
var allowedContexts = map[string]bool{
	"": true, "solo": true, "date_night": true, "friends": true, "family": true, "kids": true,
}

// GAP 09: author-selected review tone. Mirrors reviews.tone's CHECK constraint.
var allowedTones = map[string]bool{"": true, "insightful": true, "funny": true}

// GAP 20: mirrors viewing_progress's CHECK constraints. "" is not a valid
// status (progress always records something); reason stays optional.
var allowedProgressStatuses = map[string]bool{"started": true, "paused": true, "abandoned": true}
var allowedProgressReasons = map[string]bool{
	"": true, "bored": true, "not_in_the_mood": true, "too_intense": true,
	"interrupted": true, "other": true,
}

// GAP 17: mirrors craft_notes.category's CHECK constraint.
var allowedCraftCategories = map[string]bool{
	"cinematography": true, "editing": true, "sound_design": true,
	"production_design": true, "direction": true, "performance": true,
	"scene_reference": true, "other": true,
}

// GAP 18: "" means Family Mode is off. Mirrors profiles.family_policy's
// CHECK constraint.
var allowedFamilyPolicies = map[string]bool{"": true, "strict": true, "standard": true}

var regionPattern = regexp.MustCompile(`^[A-Z]{2}$`)
var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
var reservedUsernames = map[string]bool{
	"admin": true, "administrator": true, "afterframe": true, "api": true,
	"root": true, "support": true, "help": true, "null": true, "undefined": true,
	"me": true, "settings": true, "login": true, "logout": true, "signup": true,
	"signin": true, "password": true, "moderator": true, "system": true,
	"staff": true, "official": true, "security": true, "legal": true, "privacy": true,
}

// NormalizeUsername is the single canonicalization step applied before validation,
// storage, and uniqueness checks so "Strike" and "strike" are always the same handle.
func NormalizeUsername(raw string) string { return strings.ToLower(strings.TrimSpace(raw)) }

func ValidUsername(u string) error {
	if !usernamePattern.MatchString(u) {
		return fmt.Errorf("%w: usernames use 3-30 letters, numbers, or underscores", ErrInvalid)
	}
	if reservedUsernames[u] {
		return fmt.Errorf("%w: that username is reserved", ErrInvalid)
	}
	return nil
}

type Service struct {
	Pool    *pgxpool.Pool
	Catalog *catalog.Client
}
type Input struct {
	ID                 string   `json:"id"`
	FilmID             int64    `json:"film_id"`
	WatchedOn          string   `json:"watched_on"`
	Rating             *float64 `json:"rating"`
	Notes              string   `json:"notes"`
	Rewatch            bool     `json:"rewatch"`
	Private            bool     `json:"private"`
	RequestID          string   `json:"request_id"`
	ViewingID          string   `json:"viewing_id"`
	Scene              string   `json:"scene"`
	Emotion            string   `json:"emotion"`
	Context            string   `json:"context"`
	Reflection         string   `json:"reflection"`
	Kind               string   `json:"kind"`
	Safe               string   `json:"safe"`
	Watched            string   `json:"watched"`
	Layer              int32    `json:"layer"`
	Body               string   `json:"body"`
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	Ranked             bool     `json:"ranked"`
	FilmIDs            []int64  `json:"film_ids"`
	Username           string   `json:"username"`
	Name               string   `json:"name"`
	Bio                string   `json:"bio"`
	Resurface          bool     `json:"resurface"`
	NotifyAvailability bool     `json:"notify_availability"`
	TargetID           string   `json:"target_id"`
	Enabled            bool     `json:"enabled"`
	Subject            string   `json:"subject"`
	Reason             string   `json:"reason"`
	Feelings           []string `json:"feelings"`
	Intent             string   `json:"intent"`
	IntentNote         string   `json:"intent_note"`
	// ViewingContext is distinct from Context (the Memory Vault's free-text
	// "where you were, who you were with"): this is the fixed who/why tag
	// (solo, date_night, friends, family, kids) captured at log time.
	ViewingContext string `json:"viewing_context"`
	Tone           string `json:"tone"`
	// Status and ProgressMinutes are GAP 20 (abandonment tracking): a
	// partial-viewing signal stored separately from a completed watch, so an
	// abandoned film is never counted as finished and never automatically
	// scored as a dislike.
	Status          string `json:"status"`
	ProgressMinutes *int32 `json:"progress_minutes"`
	// Category and Spoiler are GAP 17 (Craft Mode): optional filmmaking-technique
	// observations, kept entirely separate from reviews/opinions.
	Category string `json:"category"`
	Spoiler  bool   `json:"spoiler"`
	// FamilyPolicy and FamilyRegion are GAP 18 (Family Mode): a persistent
	// profile setting, not a per-request toggle, so it can't be silently
	// bypassed by a client just omitting it on one Tonight Mode call.
	FamilyPolicy string `json:"family_policy"`
	FamilyRegion string `json:"family_region"`
}
type Filter struct {
	Query, Emotion, From, To, Month, TargetID, ObjectID string
	FilmID                                              int64
	Offset                                              int32
	Mine                                                bool
}

func ID(s string) pgtype.UUID { u, e := uuid.Parse(s); return pgtype.UUID{Bytes: u, Valid: e == nil} }
func raw(v any) json.RawMessage {
	if b, ok := v.([]byte); ok {
		return b
	}
	b, _ := json.Marshal(v)
	return b
}
func object(v any) map[string]any { var m map[string]any; json.Unmarshal(raw(v), &m); return m }
func pack(v any) []byte           { b, _ := json.Marshal(v); return b }
func (s *Service) Transaction(ctx context.Context, user string, fn func(*db.Queries) (any, error)) (json.RawMessage, error) {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	if e = q.SetViewer(ctx, user); e != nil {
		return nil, e
	}
	if e = q.SetRole(ctx); e != nil {
		return nil, e
	}
	v, e := fn(q)
	if e != nil {
		return nil, e
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	return raw(v), nil
}
func (s *Service) Ensure(ctx context.Context, user string) error {
	_, e := s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		deleted, e := q.AccountDeleted(ctx)
		if e != nil {
			return nil, e
		}
		if deleted {
			return nil, ErrForbidden
		}
		return q.EnsureProfile(ctx, db.EnsureProfileParams{Column1: ID(user), Column2: "film_" + regexp.MustCompile(`-`).ReplaceAllString(user, "")[:20]})
	})
	return e
}

// UsernameAvailable is the authoritative server check behind live username validation.
// It never trusts the client's own regex/availability read, since two people can race
// the same handle; the real guarantee is the profiles_username_key constraint at save time.
func (s *Service) UsernameAvailable(ctx context.Context, user, raw string) (json.RawMessage, error) {
	u := NormalizeUsername(raw)
	if e := ValidUsername(u); e != nil {
		return pack(map[string]any{"available": false, "username": u, "reason": strings.TrimPrefix(e.Error(), ErrInvalid.Error()+": ")}), nil
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		taken, e := q.UsernameTaken(ctx, u)
		if e != nil {
			return nil, e
		}
		if !taken {
			return map[string]any{"available": true, "username": u}, nil
		}
		suggestions := []string{}
		for _, cand := range usernameSuggestions(u) {
			if len(suggestions) == 3 {
				break
			}
			if ct, e := q.UsernameTaken(ctx, cand); e == nil && !ct {
				suggestions = append(suggestions, cand)
			}
		}
		return map[string]any{"available": false, "username": u, "reason": "That username is taken.", "suggestions": suggestions}, nil
	})
}
func usernameSuggestions(u string) []string {
	base := u
	if len(base) > 23 {
		base = base[:23]
	}
	return []string{base + "_films", base + "2026", base + "_" + strconv.Itoa(10+len(u)%89)}
}

// GAP 24 (free-tier only): current region streaming availability from TMDB's
// watch/providers endpoint (JustWatch-sourced). Never stores or returns a
// predicted departure date — only an observed snapshot and, when a prior
// snapshot existed, a verified added/removed change that fans out to opted-in
// watchers. Cache window matches Film()'s existing 1-day TMDB refresh policy.
func (s *Service) Availability(ctx context.Context, user string, filmID int64, rawRegion string) (json.RawMessage, error) {
	if filmID <= 0 {
		return nil, ErrInvalid
	}
	region := strings.ToUpper(strings.TrimSpace(rawRegion))
	if region == "" {
		region = "US"
	}
	if !regionPattern.MatchString(region) {
		return nil, fmt.Errorf("%w: region must be a two-letter code", ErrInvalid)
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		cached, cacheErr := q.GetFilmAvailability(ctx, db.GetFilmAvailabilityParams{FilmID: filmID, Region: region})
		hadCache := cacheErr == nil
		if hadCache && time.Since(cached.FetchedAt.Time) < 24*time.Hour {
			return availabilityResult(region, cached.Providers, cached.Source, cached.FetchedAt.Time, false), nil
		}
		live, liveErr := s.Catalog.Availability(ctx, filmID, region)
		if liveErr != nil {
			if hadCache {
				return availabilityResult(region, cached.Providers, cached.Source, cached.FetchedAt.Time, true), nil
			}
			return nil, liveErr
		}
		if e := q.SetFilmAvailability(ctx, db.SetFilmAvailabilityParams{FilmID: filmID, Region: region, Providers: live.Providers, Source: live.Source}); e != nil {
			return nil, e
		}
		if hadCache {
			for _, c := range diffProviders(cached.Providers, live.Providers) {
				if e := q.NotifyAvailabilityChange(ctx, db.NotifyAvailabilityChangeParams{FilmID: filmID, Region: region, Provider: c.provider, Change: c.change}); e != nil {
					return nil, e
				}
			}
		}
		return availabilityResult(region, live.Providers, live.Source, time.Now(), false), nil
	})
}
func availabilityResult(region string, providers []string, source string, fetchedAt time.Time, stale bool) map[string]any {
	return map[string]any{"region": region, "providers": providers, "source": source, "fetched_at": fetchedAt, "stale": stale}
}

type providerChange struct{ provider, change string }

func diffProviders(old, new []string) []providerChange {
	oldSet, newSet := map[string]bool{}, map[string]bool{}
	for _, p := range old {
		oldSet[p] = true
	}
	for _, p := range new {
		newSet[p] = true
	}
	var changes []providerChange
	for p := range newSet {
		if !oldSet[p] {
			changes = append(changes, providerChange{p, "added"})
		}
	}
	for p := range oldSet {
		if !newSet[p] {
			changes = append(changes, providerChange{p, "removed"})
		}
	}
	sort.Slice(changes, func(i, j int) bool { return changes[i].provider < changes[j].provider })
	return changes
}
func (s *Service) Film(ctx context.Context, id int64) (json.RawMessage, error) {
	if id <= 0 {
		return nil, ErrInvalid
	}
	q := db.New(s.Pool)
	if b, e := q.Film(ctx, id); e == nil {
		return b, nil
	}
	f, e := s.Catalog.Detail(ctx, id)
	if e != nil {
		return nil, e
	}
	return q.UpsertFilm(ctx, pack(f))
}

// GAP 02: a fixed, reproducible 15-film set spanning genre, decade, language
// and region (not randomized), so a retake is comparable and nothing here
// depends on paid AI. Picked from TMDB IDs already verified against the live
// catalog. Keep in sync with frontend/lib/vocab.ts's QUIZ copy if retitled.
var quizFilmIDs = []int64{550, 603, 680, 13, 27205, 157336, 278, 238, 129, 372058, 19404, 429, 11216, 496243, 9806}

func (s *Service) QuizFilms(ctx context.Context) (json.RawMessage, error) {
	films := make([]json.RawMessage, 0, len(quizFilmIDs))
	for _, id := range quizFilmIDs {
		f, e := s.Film(ctx, id)
		if e != nil {
			return nil, e
		}
		films = append(films, f)
	}
	return pack(films), nil
}

type QuizAnswer struct {
	FilmID   int64  `json:"film_id"`
	Response string `json:"response"`
}

var allowedQuizResponses = map[string]bool{"like": true, "dislike": true, "unseen": true}

// SaveQuiz only accepts responses for the fixed quiz set, rejecting any
// attempt to feed arbitrary films into the taste signal.
func (s *Service) SaveQuiz(ctx context.Context, user string, answers []QuizAnswer) (json.RawMessage, error) {
	if len(answers) == 0 {
		return nil, fmt.Errorf("%w: at least one response is required", ErrInvalid)
	}
	allowed := map[int64]bool{}
	for _, id := range quizFilmIDs {
		allowed[id] = true
	}
	seen := map[int64]bool{}
	filmIDs := make([]int64, len(answers))
	responses := make([]string, len(answers))
	for i, a := range answers {
		if !allowed[a.FilmID] {
			return nil, fmt.Errorf("%w: film %d is not part of the taste quiz", ErrInvalid, a.FilmID)
		}
		if seen[a.FilmID] {
			return nil, fmt.Errorf("%w: duplicate response for film %d", ErrInvalid, a.FilmID)
		}
		seen[a.FilmID] = true
		if !allowedQuizResponses[a.Response] {
			return nil, fmt.Errorf("%w: unrecognized quiz response %q", ErrInvalid, a.Response)
		}
		filmIDs[i] = a.FilmID
		responses[i] = a.Response
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if e := q.SaveQuizResponses(ctx, db.SaveQuizResponsesParams{FilmIds: filmIDs, Responses: responses}); e != nil {
			return nil, e
		}
		return q.MarkQuizCompleted(ctx)
	})
}
func quizStatus(ctx context.Context, q *db.Queries) (any, error) {
	me, e := q.Me(ctx)
	if e != nil {
		return nil, e
	}
	responses, e := q.QuizResponses(ctx)
	if e != nil {
		return nil, e
	}
	return map[string]any{"completed_at": object(me)["quiz_completed_at"], "responses": raw(responses)}, nil
}
func tasteMap(ctx context.Context, q *db.Queries) (any, error) {
	b, e := q.QuizResponses(ctx)
	if e != nil {
		return nil, e
	}
	var responses []taste.QuizResponse
	if e = json.Unmarshal(raw(b), &responses); e != nil {
		return nil, e
	}
	return taste.BuildTasteMap(responses), nil
}

// GAP 08 (solo + guest couple; no dual-account consent flow yet — see
// docs/product/GAP_TRACEABILITY.md). Tonight Mode's candidate pool is TMDB
// popular+trending plus the user's own watchlist, deduped and capped so a
// cold cache still answers in a few seconds; genres/runtime require the
// per-film TMDB detail fetch (list endpoints only return genre_ids, not
// names), reusing the same Film() cache every other page already relies on.
const tonightCandidateCap = 40

type GuestPreferences struct {
	LikedGenres    []string `json:"liked_genres"`
	DislikedGenres []string `json:"disliked_genres"`
}
type TonightRequest struct {
	MaxMinutes int               `json:"max_minutes"`
	Mood       string            `json:"mood"`
	Context    string            `json:"context"`
	Guest      *GuestPreferences `json:"guest"`
	// Partner names a connected Afterframe account (see RequestTasteShare)
	// to use their real taste instead of a hand-entered guest. Mutually
	// exclusive with Guest — one request picks one couple mode, not both.
	Partner string `json:"partner"`
}

func (s *Service) Tonight(ctx context.Context, user string, req TonightRequest) (json.RawMessage, error) {
	if req.MaxMinutes < 0 || req.MaxMinutes > 1000 {
		return nil, fmt.Errorf("%w: time limit must be a reasonable number of minutes", ErrInvalid)
	}
	if req.Context != "" && !allowedContexts[req.Context] {
		return nil, fmt.Errorf("%w: unrecognized context %q", ErrInvalid, req.Context)
	}
	if req.Mood != "" && !allowedFeelings[req.Mood] {
		return nil, fmt.Errorf("%w: unrecognized mood %q", ErrInvalid, req.Mood)
	}
	if req.Guest != nil && req.Partner != "" {
		return nil, fmt.Errorf("%w: choose either a guest or a connected partner, not both", ErrInvalid)
	}
	var guestTaste *recommend.Taste
	if req.Guest != nil {
		g := recommend.Taste{GenreScore: map[string]int{}}
		for _, genre := range req.Guest.LikedGenres {
			g.GenreScore[genre]++
		}
		for _, genre := range req.Guest.DislikedGenres {
			g.GenreScore[genre]--
		}
		guestTaste = &g
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if req.Partner != "" {
			partnerTaste, e := partnerGenreScore(ctx, q, NormalizeUsername(req.Partner))
			if e != nil {
				return nil, e
			}
			guestTaste = &recommend.Taste{GenreScore: partnerTaste, Label: "@" + NormalizeUsername(req.Partner)}
		}
		genreScore, e := ownGenreScore(ctx, q)
		if e != nil {
			return nil, e
		}

		// GAP 18: Family Mode is a persistent profile setting, never a
		// client-supplied request field — so it can't be silently bypassed
		// by a caller just omitting it on one Tonight Mode call.
		me, e := q.Me(ctx)
		if e != nil {
			return nil, e
		}
		var profile struct {
			FamilyPolicy string `json:"family_policy"`
			FamilyRegion string `json:"family_region"`
		}
		json.Unmarshal(raw(me), &profile)

		wl, e := q.Watchlist(ctx, db.WatchlistParams{Offset: 0})
		if e != nil {
			return nil, e
		}
		var watchlist []struct {
			FilmID int64 `json:"film_id"`
		}
		json.Unmarshal(raw(wl), &watchlist)
		watchlisted := map[int64]bool{}
		for _, w := range watchlist {
			watchlisted[w.FilmID] = true
		}

		wf, e := q.WatchedFilmIDs(ctx)
		if e != nil {
			return nil, e
		}
		var watchedIDs []int64
		json.Unmarshal(raw(wf), &watchedIDs)
		watched := map[int64]bool{}
		for _, id := range watchedIDs {
			watched[id] = true
		}
		// GAP 20: conservative use of abandonment — a paused/abandoned film is
		// excluded from fresh picks (no point re-suggesting it), but it is
		// never treated as a genre dislike, since an interruption isn't taste.
		pf, e := q.UnresolvedProgressFilmIDs(ctx)
		if e != nil {
			return nil, e
		}
		var inProgressIDs []int64
		json.Unmarshal(raw(pf), &inProgressIDs)
		for _, id := range inProgressIDs {
			watched[id] = true
		}

		seen := map[int64]bool{}
		var ids []int64
		addIDs := func(films []catalog.Film) {
			for _, f := range films {
				if !seen[f.ID] {
					seen[f.ID] = true
					ids = append(ids, f.ID)
				}
			}
		}
		if pop, e := s.Catalog.Search(ctx, "", "popular", 1); e == nil {
			addIDs(pop)
		}
		if trend, e := s.Catalog.Search(ctx, "", "trending", 1); e == nil {
			addIDs(trend)
		}
		for id := range watchlisted {
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}
		if len(ids) > tonightCandidateCap {
			ids = ids[:tonightCandidateCap]
		}

		candidates := make([]recommend.Candidate, 0, len(ids))
		for i, id := range ids {
			if watched[id] {
				continue
			}
			fb, e := s.Film(ctx, id)
			if e != nil {
				continue // a single bad/unavailable film must not fail the whole request
			}
			var film struct {
				Genres         []string          `json:"genres"`
				Runtime        int               `json:"runtime"`
				Certifications map[string]string `json:"certifications"`
			}
			json.Unmarshal(fb, &film)
			candidates = append(candidates, recommend.Candidate{
				FilmID: id, Genres: film.Genres, Runtime: film.Runtime,
				Popularity: i, InWatchlist: watchlisted[id],
				Certification: film.Certifications[profile.FamilyRegion],
			})
		}

		picks, eligible := recommend.Rank(
			candidates, recommend.Taste{GenreScore: genreScore}, guestTaste,
			recommend.Constraints{
				MaxMinutes: req.MaxMinutes, Context: req.Context,
				FamilyPolicy: profile.FamilyPolicy, FamilyRegion: profile.FamilyRegion,
			}, req.Mood, 3,
		)
		results := make([]map[string]any, len(picks))
		for i, p := range picks {
			filmJSON, _ := s.Film(ctx, p.FilmID)
			reasons := p.Reasons
			if reasons == nil {
				reasons = []string{}
			}
			results[i] = map[string]any{"film": json.RawMessage(filmJSON), "reasons": reasons}
		}
		msg := ""
		if len(picks) < 3 {
			msg = "Only " + strconv.Itoa(len(picks)) + " film(s) fit right now — try loosening your time limit, mood, or context."
			if profile.FamilyPolicy != "" {
				msg += " Family Mode is on, and many films have no certification data on file for your region — those are excluded, not assumed safe."
			}
		}
		return map[string]any{"picks": results, "candidates_considered": eligible, "message": msg}, nil
	})
}

// GAP 23: group theatrical planning. No $0-cost showtime provider exists
// (see catalog.ShowtimeProvider), so a plan's "slots" are proposed meeting
// times the group agrees on themselves — plain strings, never presented as
// a verified showtime, and never a ticket/booking confirmation of any kind.
const planNoteLimit = 2000
const planSlotLimit = 200

func (s *Service) CreatePlan(ctx context.Context, user string, filmID int64, note string) (json.RawMessage, error) {
	if len(note) > planNoteLimit {
		return nil, fmt.Errorf("%w: note is too long", ErrInvalid)
	}
	if _, e := s.Film(ctx, filmID); e != nil {
		return nil, e
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		b, e := q.CreatePlan(ctx, db.CreatePlanParams{FilmID: filmID, Note: note})
		if e != nil {
			return nil, e
		}
		// The creator is a participant too, from the start, so they can vote
		// on their own plan's slots the same as anyone they invite.
		planID := ID(object(b)["id"].(string))
		if e = q.JoinOwnPlan(ctx, planID); e != nil {
			return nil, e
		}
		return b, nil
	})
}

func (s *Service) PlanList(ctx context.Context, user string) (json.RawMessage, error) {
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		return q.MyPlans(ctx)
	})
}

// PlanDetail returns {plan, slots, participants} — three separate queries
// rather than one jsonb-merging mega-query, since RLS alone (not this Go
// code) is what actually keeps a non-member from ever reaching any of them:
// a non-member's PlanDetail query itself returns zero rows.
func (s *Service) PlanDetail(ctx context.Context, user, id string) (json.RawMessage, error) {
	if !ID(id).Valid {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		plan, e := q.PlanDetail(ctx, ID(id))
		if e != nil {
			return nil, e
		}
		slots, e := q.PlanSlots(ctx, ID(id))
		if e != nil {
			return nil, e
		}
		participants, e := q.PlanParticipants(ctx, ID(id))
		if e != nil {
			return nil, e
		}
		return map[string]any{"plan": json.RawMessage(plan), "slots": slots, "participants": participants}, nil
	})
}

func (s *Service) AddPlanSlot(ctx context.Context, user, planID, label string) (json.RawMessage, error) {
	if !ID(planID).Valid || label == "" || len(label) > planSlotLimit {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		return q.AddPlanSlot(ctx, db.AddPlanSlotParams{PlanID: ID(planID), Label: label})
	})
}

func (s *Service) InvitePlanParticipant(ctx context.Context, user, planID, username string) (json.RawMessage, error) {
	if !ID(planID).Valid {
		return nil, ErrInvalid
	}
	username = NormalizeUsername(username)
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		uid, e := q.ProfileIDByUsername(ctx, username)
		if e != nil {
			return nil, fmt.Errorf("%w: no such user %q", ErrInvalid, username)
		}
		b, e := q.InvitePlanParticipant(ctx, db.InvitePlanParticipantParams{PlanID: ID(planID), UserID: uid})
		if e != nil {
			return nil, e
		}
		return b, q.Notify(ctx, db.NotifyParams{UserID: uid, Kind: "plan_invite", ObjectID: planID})
	})
}

// RespondPlanInvite lets only the invited participant accept or decline —
// the plan_participants_respond RLS policy enforces that even if this
// check did not.
func (s *Service) RespondPlanInvite(ctx context.Context, user, planID string, accept bool) (json.RawMessage, error) {
	if !ID(planID).Valid {
		return nil, ErrInvalid
	}
	status := "declined"
	if accept {
		status = "joined"
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		return q.RespondPlanInvite(ctx, db.RespondPlanInviteParams{PlanID: ID(planID), Status: status})
	})
}

// VotePlanSlot requires the voter to already be a joined participant — the
// vote_insert RLS policy is the real enforcement; this just validates input.
func (s *Service) VotePlanSlot(ctx context.Context, user, slotID string, on bool) (json.RawMessage, error) {
	if !ID(slotID).Valid {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if on {
			return nil, q.VoteSlot(ctx, ID(slotID))
		}
		return nil, q.UnvoteSlot(ctx, ID(slotID))
	})
}

// DecidePlan sets a chosen slot (status becomes "decided") or cancels the
// plan outright — creator-only, enforced by RLS. Never confirms a booking:
// this only records which of the group's own proposed slots they picked.
func (s *Service) DecidePlan(ctx context.Context, user, planID, slotID string, cancel bool) (json.RawMessage, error) {
	if !ID(planID).Valid {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if cancel {
			return q.CancelPlan(ctx, ID(planID))
		}
		if !ID(slotID).Valid {
			return nil, ErrInvalid
		}
		return q.DecidePlan(ctx, db.DecidePlanParams{ID: ID(planID), DecidedSlotID: ID(slotID)})
	})
}

// GAP 10: global vs tribe taste. Tribes are a fixed, product-curated list
// (taste.Tribes) — there's no tribe-creation or moderation surface because
// there's no user-generated tribe content to moderate; joining only
// changes whose existing ratings get averaged together.
func (s *Service) TribeList(ctx context.Context, user string) (json.RawMessage, error) {
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		mine, e := q.MyTribes(ctx)
		if e != nil {
			return nil, e
		}
		var joined []string
		json.Unmarshal(raw(mine), &joined)
		joinedSet := map[string]bool{}
		for _, id := range joined {
			joinedSet[id] = true
		}
		out := make([]map[string]any, len(taste.Tribes))
		for i, t := range taste.Tribes {
			out[i] = map[string]any{"id": t.ID, "label": t.Label, "kind": t.Kind, "joined": joinedSet[t.ID]}
		}
		return out, nil
	})
}

func (s *Service) SetTribe(ctx context.Context, user, tribeID string, enabled bool) (json.RawMessage, error) {
	if !taste.ValidTribe(tribeID) {
		return nil, fmt.Errorf("%w: unrecognized tribe %q", ErrInvalid, tribeID)
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if enabled {
			return nil, q.JoinTribe(ctx, tribeID)
		}
		return nil, q.LeaveTribe(ctx, tribeID)
	})
}

// FilmRatings pairs the global community rating with one optional tribe's
// rating for the same film — "both scores side by side," each with its own
// sample size and source label, never fabricated below taste.MinRatingSample.
func (s *Service) FilmRatings(ctx context.Context, user string, filmID int64, tribeID string) (json.RawMessage, error) {
	if tribeID != "" && !taste.ValidTribe(tribeID) {
		return nil, fmt.Errorf("%w: unrecognized tribe %q", ErrInvalid, tribeID)
	}
	if _, e := s.Film(ctx, filmID); e != nil {
		return nil, e
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		g, e := q.GlobalRating(ctx, filmID)
		if e != nil {
			return nil, e
		}
		global := taste.BuildRating(deref(g.AvgRating), g.AvgRating != nil, int(g.SampleSize), "afterframe_community")
		result := map[string]any{"global": global, "tribe": nil}
		if tribeID != "" {
			tr, e := q.TribeRating(ctx, db.TribeRatingParams{FilmID: filmID, TribeID: tribeID})
			if e != nil {
				return nil, e
			}
			label := ""
			for _, t := range taste.Tribes {
				if t.ID == tribeID {
					label = t.Label
				}
			}
			tribeRating := taste.BuildRating(deref(tr.AvgRating), tr.AvgRating != nil, int(tr.SampleSize), label)
			result["tribe"] = tribeRating
		}
		return result, nil
	})
}

func deref(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}

// ownGenreScore is the viewer's own net genre affinity from their quiz
// answers — the same computation Tonight Mode and GAP 25 compatibility both
// need, kept in one place so they can't drift apart.
func ownGenreScore(ctx context.Context, q *db.Queries) (map[string]int, error) {
	qr, e := q.QuizResponses(ctx)
	if e != nil {
		return nil, e
	}
	var responses []taste.QuizResponse
	if e = json.Unmarshal(raw(qr), &responses); e != nil {
		return nil, e
	}
	tm := taste.BuildTasteMap(responses)
	score := map[string]int{}
	for _, g := range tm.Genres {
		score[g.Genre] = g.Score
	}
	return score, nil
}

// Compatibility (GAP 25) reuses the exact same consent primitive as Tonight
// Mode's partner path — no new sharing mechanism, no new privacy surface.
func (s *Service) Compatibility(ctx context.Context, user, partner string) (json.RawMessage, error) {
	partner = NormalizeUsername(partner)
	if partner == "" {
		return nil, fmt.Errorf("%w: partner username is required", ErrInvalid)
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		mine, e := ownGenreScore(ctx, q)
		if e != nil {
			return nil, e
		}
		theirs, e := partnerGenreScore(ctx, q, partner)
		if e != nil {
			return nil, e
		}
		return taste.BuildCompatibility(mine, theirs), nil
	})
}

// partnerGenreScore resolves a username to a profile, confirms a mutually
// accepted taste share exists, and returns their genre affinity. The
// consent check is deliberately re-verified here even though shared_taste()
// also checks it server-side — defense in depth, and it lets us return a
// specific, honest error instead of a silently-empty taste.
func partnerGenreScore(ctx context.Context, q *db.Queries, username string) (map[string]int, error) {
	id, e := q.ProfileIDByUsername(ctx, username)
	if e != nil {
		return nil, fmt.Errorf("%w: no such user %q", ErrInvalid, username)
	}
	accepted, e := q.TasteShareAccepted(ctx, id)
	if e != nil {
		return nil, e
	}
	if !accepted {
		return nil, fmt.Errorf("%w: you don't have an accepted taste-sharing connection with %q yet", ErrInvalid, username)
	}
	b, e := q.SharedTaste(ctx, id)
	if e != nil {
		return nil, e
	}
	var responses []taste.QuizResponse
	if e = json.Unmarshal(b, &responses); e != nil {
		return nil, e
	}
	tm := taste.BuildTasteMap(responses)
	score := map[string]int{}
	for _, g := range tm.Genres {
		score[g.Genre] = g.Score
	}
	return score, nil
}

// RequestTasteShare sends a consent request to connect taste data (used by
// Tonight Mode's partner path and, later, GAP 25 compatibility) with
// another real Afterframe account. Nothing is shared until they accept.
func (s *Service) RequestTasteShare(ctx context.Context, user, username string) (json.RawMessage, error) {
	username = NormalizeUsername(username)
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		partnerID, e := q.ProfileIDByUsername(ctx, username)
		if e != nil {
			return nil, fmt.Errorf("%w: no such user %q", ErrInvalid, username)
		}
		if partnerID.Bytes == ID(user).Bytes {
			return nil, fmt.Errorf("%w: you can't send yourself a taste-sharing request", ErrInvalid)
		}
		b, e := q.RequestTasteShare(ctx, partnerID)
		if e != nil {
			return nil, e
		}
		share := object(b)
		return b, q.Notify(ctx, db.NotifyParams{UserID: partnerID, Kind: "taste_share_invite", ObjectID: share["id"].(string)})
	})
}

// RespondTasteShare lets only the invited partner accept or decline — the
// taste_share_respond RLS policy enforces that even if this check did not.
func (s *Service) RespondTasteShare(ctx context.Context, user, id string, accept bool) (json.RawMessage, error) {
	if !ID(id).Valid {
		return nil, ErrInvalid
	}
	status := "declined"
	if accept {
		status = "accepted"
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		b, e := q.RespondTasteShare(ctx, db.RespondTasteShareParams{ID: ID(id), Status: status})
		if e != nil {
			return nil, e
		}
		share := object(b)
		return b, q.Notify(ctx, db.NotifyParams{
			UserID:   ID(share["requester_id"].(string)),
			Kind:     "taste_share_" + status,
			ObjectID: id,
		})
	})
}
func (s *Service) Read(ctx context.Context, user, area string, f Filter) (json.RawMessage, error) {
	if (f.ObjectID != "" && !ID(f.ObjectID).Valid) || len(f.Query) > 300 || f.Offset < 0 || f.Offset > 100000 {
		return nil, ErrInvalid
	}
	for _, d := range []string{f.From, f.To} {
		if d != "" {
			if _, e := time.Parse("2006-01-02", d); e != nil {
				return nil, ErrInvalid
			}
		}
	}
	if f.Month != "" {
		if _, e := time.Parse("2006-01", f.Month); e != nil {
			return nil, ErrInvalid
		}
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		switch area {
		case "profile":
			if !ID(f.TargetID).Valid {
				return nil, ErrInvalid
			}
			return q.ProfileDetails(ctx, ID(f.TargetID))
		case "followers", "following":
			if !ID(f.TargetID).Valid {
				return nil, ErrInvalid
			}
			return q.Network(ctx, db.NetworkParams{TargetID: ID(f.TargetID), Column2: area == "followers"})
		case "film-state":
			return q.FilmState(ctx, f.FilmID)
		case "me":
			return q.Me(ctx)
		case "diary":
			return q.Diary(ctx, db.DiaryParams{Column1: f.Month, Offset: f.Offset})
		case "timeline":
			return q.Timeline(ctx, f.FilmID)
		case "memories":
			parsed := memory.Interpret(f.Query, f.From, f.To, time.Now())
			return q.SearchMemories(ctx, db.SearchMemoriesParams{Column1: parsed.Text, Column2: f.Emotion, Column3: parsed.From, Column4: parsed.To})
		case "insights":
			data, e := q.Timeline(ctx, f.FilmID)
			if e != nil {
				return nil, e
			}
			var events []taste.Opinion
			if e = json.Unmarshal(raw(data), &events); e != nil {
				return nil, e
			}
			return taste.Compare(events), nil
		case "resurface":
			b, e := q.Resurface(ctx)
			if e != nil {
				return nil, e
			}
			var memories []map[string]any
			if e = json.Unmarshal(raw(b), &memories); e != nil {
				return nil, e
			}
			for _, m := range memories {
				if wo, ok := m["watched_on"].(string); ok {
					m["explanation"] = resurfaceExplanation(wo)
				}
			}
			return memories, nil
		case "watchlist":
			// f.Emotion is reused here as the watchlist intent filter (e.g. "date_night");
			// it has no connection to Memory Vault's mood filter beyond sharing a field.
			return q.Watchlist(ctx, db.WatchlistParams{Intent: f.Emotion, Offset: f.Offset})
		case "lists":
			return q.Lists(ctx, db.ListsParams{Column1: f.Mine, Column2: f.ObjectID, Offset: f.Offset})
		case "people":
			return q.Profiles(ctx, pgtype.Text{String: f.Query, Valid: true})
		case "notifications":
			return q.Notifications(ctx)
		case "availability-alerts":
			return q.AvailabilityAlerts(ctx)
		case "taste-shares":
			return q.TasteShares(ctx)
		case "muted":
			return q.MutedProfiles(ctx)
		case "progress":
			return q.Progress(ctx)
		case "craft":
			if f.FilmID != 0 {
				notes, e := q.CraftNotesForFilm(ctx, f.FilmID)
				if e != nil {
					return nil, e
				}
				var parsed []map[string]any
				if e = json.Unmarshal(raw(notes), &parsed); e != nil {
					return nil, e
				}
				for _, n := range parsed {
					if n["spoiler"] == true && n["allowed_spoiler"] != true {
						delete(n, "scene")
						delete(n, "body")
					}
				}
				return parsed, nil
			}
			return q.SearchCraftNotes(ctx, f.Query)
		case "quiz-films":
			return s.QuizFilms(ctx)
		case "quiz":
			return quizStatus(ctx, q)
		case "taste-map":
			return tasteMap(ctx, q)
		case "reviews", "feed":
			// f.Emotion doubles as the review tone filter here (GAP 09), same
			// reuse pattern as the watchlist intent filter above.
			v, e := q.ReadReviews(ctx, db.ReadReviewsParams{Column1: f.FilmID, Column2: area == "feed", Offset: f.Offset, Column4: f.Emotion})
			if e != nil {
				return nil, e
			}
			var reviews []map[string]any
			if e = json.Unmarshal(raw(v), &reviews); e != nil {
				return nil, e
			}
			for _, r := range reviews {
				Disclose(r)
			}
			return reviews, nil
		}
		return nil, ErrInvalid
	})
}

// resurfaceExplanation is GAP 05's "On this day" caption: honest and
// derived entirely from the real watched_on date, never a fabricated or
// invented reflection. Falls back to a neutral caption only if the date
// itself fails to parse (defensive, shouldn't happen for a real row).
func resurfaceExplanation(watchedOn string) string {
	t, e := time.Parse("2006-01-02", watchedOn)
	if e != nil {
		return "A memory from an earlier chapter."
	}
	days := int(time.Since(t).Hours() / 24)
	switch {
	case days >= 365:
		years := days / 365
		if years == 1 {
			return "A year ago around this time, you watched this."
		}
		return fmt.Sprintf("%d years ago around this time, you watched this.", years)
	case days >= 30:
		months := days / 30
		if months == 1 {
			return "A month ago, you watched this."
		}
		return fmt.Sprintf("%d months ago, you watched this.", months)
	default:
		return "Not long ago, you watched this."
	}
}

// Disclose removes protected text entirely, including for feed and preview responses.
func Disclose(r map[string]any) { spoilers.Disclose(r) }

func Validate(area string, in Input) error {
	for _, s := range []string{in.ID, in.ViewingID, in.TargetID, in.RequestID} {
		if s != "" && !ID(s).Valid {
			return fmt.Errorf("%w: invalid identifier", ErrInvalid)
		}
	}
	if in.Rating != nil && (math.IsNaN(*in.Rating) || *in.Rating < .5 || *in.Rating > 5 || math.Mod(*in.Rating*2, 1) != 0) {
		return fmt.Errorf("%w: rating must be a half-star from 0.5 to 5", ErrInvalid)
	}
	for _, text := range []string{in.Notes, in.Scene, in.Context, in.Reflection, in.Safe, in.Watched, in.Description, in.Body} {
		if len(text) > 10000 {
			return fmt.Errorf("%w: text too long", ErrInvalid)
		}
	}
	if len(in.Emotion) > 100 || len(in.Name) > 100 || len(in.Bio) > 1000 || len(in.Title) > 200 {
		return ErrInvalid
	}
	if area == "diary" {
		t, e := time.Parse("2006-01-02", in.WatchedOn)
		if e != nil || t.After(time.Now().Add(24*time.Hour)) || t.Year() < 1888 {
			return fmt.Errorf("%w: valid viewing date required", ErrInvalid)
		}
		if !ID(in.RequestID).Valid && in.ID == "" {
			return fmt.Errorf("%w: request_id required", ErrInvalid)
		}
		if len(in.Feelings) > len(allowedFeelings) {
			return fmt.Errorf("%w: too many feelings", ErrInvalid)
		}
		for _, feeling := range in.Feelings {
			if !allowedFeelings[feeling] {
				return fmt.Errorf("%w: unrecognized feeling %q", ErrInvalid, feeling)
			}
		}
		if !allowedContexts[in.ViewingContext] {
			return fmt.Errorf("%w: unrecognized viewing context %q", ErrInvalid, in.ViewingContext)
		}
	}
	if area == "reviews" && !allowedTones[in.Tone] {
		return fmt.Errorf("%w: unrecognized review tone %q", ErrInvalid, in.Tone)
	}
	if area == "me" {
		if e := ValidUsername(in.Username); e != nil {
			return e
		}
		if !allowedFamilyPolicies[in.FamilyPolicy] {
			return fmt.Errorf("%w: unrecognized family mode policy %q", ErrInvalid, in.FamilyPolicy)
		}
		if in.FamilyRegion != "" && !regionPattern.MatchString(in.FamilyRegion) {
			return fmt.Errorf("%w: family region must be a two-letter code", ErrInvalid)
		}
	}
	if area == "watchlist" {
		if !allowedIntents[in.Intent] {
			return fmt.Errorf("%w: unrecognized watchlist intent %q", ErrInvalid, in.Intent)
		}
		if len(in.IntentNote) > 200 {
			return fmt.Errorf("%w: watchlist note must be 200 characters or fewer", ErrInvalid)
		}
	}
	if area == "progress" {
		if !allowedProgressStatuses[in.Status] {
			return fmt.Errorf("%w: unrecognized progress status %q", ErrInvalid, in.Status)
		}
		if !allowedProgressReasons[in.Reason] {
			return fmt.Errorf("%w: unrecognized abandonment reason %q", ErrInvalid, in.Reason)
		}
		if in.ProgressMinutes != nil && *in.ProgressMinutes < 0 {
			return fmt.Errorf("%w: progress minutes can't be negative", ErrInvalid)
		}
	}
	if area == "craft" && !allowedCraftCategories[in.Category] {
		return fmt.Errorf("%w: unrecognized craft category %q", ErrInvalid, in.Category)
	}
	return nil
}
func (s *Service) Write(ctx context.Context, user, area string, in Input) (json.RawMessage, error) {
	if area == "me" {
		in.Username = NormalizeUsername(in.Username)
	}
	if e := Validate(area, in); e != nil {
		return nil, e
	}
	needsFilm := area == "diary" || area == "timeline" || area == "reviews" || area == "watchlist" || area == "reveal" || area == "progress" || area == "craft"
	if needsFilm {
		filmJSON, e := s.Film(ctx, in.FilmID)
		if e != nil {
			return nil, e
		}
		if area == "progress" && in.ProgressMinutes != nil {
			var film struct {
				Runtime int `json:"runtime"`
			}
			json.Unmarshal(filmJSON, &film)
			if film.Runtime > 0 && int(*in.ProgressMinutes) > film.Runtime {
				return nil, fmt.Errorf("%w: progress can't exceed the film's runtime (%d min)", ErrInvalid, film.Runtime)
			}
		}
	}
	if area == "lists" {
		if in.Title == "" || len(in.FilmIDs) > 200 {
			return nil, ErrInvalid
		}
		seen := map[int64]bool{}
		for _, id := range in.FilmIDs {
			if seen[id] {
				return nil, fmt.Errorf("%w: duplicate film", ErrInvalid)
			}
			seen[id] = true
			if _, e := s.Film(ctx, id); e != nil {
				return nil, e
			}
		}
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		switch area {
		case "me":
			return q.SaveProfile(ctx, pack(in))
		case "diary":
			return saveViewing(ctx, q, in)
		case "memories":
			if !ID(in.ViewingID).Valid {
				return nil, ErrInvalid
			}
			return q.SaveMemory(ctx, pack(in))
		case "timeline":
			in.ViewingID = ""
			if in.Kind != "reflection" && in.Kind != "correction" {
				in.Kind = "reflection"
			}
			return q.AddOpinion(ctx, pack(in))
		case "reviews":
			if in.Safe == "" {
				return nil, fmt.Errorf("%w: a spoiler-safe introduction is required", ErrInvalid)
			}
			return q.SaveReview(ctx, pack(in))
		case "reveal":
			if in.Layer < 1 || in.Layer > 3 {
				return nil, ErrInvalid
			}
			return q.Reveal(ctx, db.RevealParams{FilmID: in.FilmID, Layer: in.Layer})
		case "watchlist":
			if !in.Enabled {
				return nil, q.RemoveWatchlist(ctx, in.FilmID)
			}
			return q.SetWatchlist(ctx, db.SetWatchlistParams{FilmID: in.FilmID, Private: in.Private, Intent: in.Intent, IntentNote: in.IntentNote})
		case "lists":
			b, e := q.SaveList(ctx, pack(in))
			if e != nil {
				return nil, e
			}
			id := ID(object(b)["id"].(string))
			if e = q.DeleteListItems(ctx, id); e != nil {
				return nil, e
			}
			for i, f := range in.FilmIDs {
				if e = q.AddListItem(ctx, db.AddListItemParams{ListID: id, FilmID: f, Position: int32(i)}); e != nil {
					return nil, e
				}
			}
			return b, nil
		case "follow":
			if !ID(in.TargetID).Valid || in.TargetID == user {
				return nil, ErrInvalid
			}
			if !in.Enabled {
				return nil, q.Unfollow(ctx, ID(in.TargetID))
			}
			b, e := q.Follow(ctx, ID(in.TargetID))
			if errors.Is(e, pgx.ErrNoRows) {
				return nil, nil
			}
			if e != nil {
				return nil, e
			}
			return b, q.Notify(ctx, db.NotifyParams{UserID: ID(in.TargetID), Kind: "follow", ObjectID: user})
		case "block":
			if !ID(in.TargetID).Valid || in.TargetID == user {
				return nil, ErrInvalid
			}
			if e := q.Block(ctx, ID(in.TargetID)); e != nil {
				return nil, e
			}
			return nil, q.RemoveBlockedFollows(ctx, ID(in.TargetID))
		case "mute":
			if !ID(in.TargetID).Valid || in.TargetID == user {
				return nil, ErrInvalid
			}
			if !in.Enabled {
				return nil, q.Unmute(ctx, ID(in.TargetID))
			}
			return nil, q.Mute(ctx, ID(in.TargetID))
		case "list-like":
			if !ID(in.ID).Valid {
				return nil, ErrInvalid
			}
			if _, e := q.ListAccess(ctx, ID(in.ID)); e != nil {
				return nil, e
			}
			if in.Enabled {
				return nil, q.LikeList(ctx, ID(in.ID))
			}
			return nil, q.UnlikeList(ctx, ID(in.ID))
		case "like":
			if !ID(in.ID).Valid {
				return nil, ErrInvalid
			}
			if !in.Enabled {
				return nil, q.UnlikeReview(ctx, ID(in.ID))
			}
			access, e := q.ReviewAccess(ctx, ID(in.ID))
			if e != nil {
				return nil, e
			}
			b, e := q.LikeReview(ctx, ID(in.ID))
			if errors.Is(e, pgx.ErrNoRows) {
				return nil, nil
			}
			if e != nil {
				return nil, e
			}
			return b, q.Notify(ctx, db.NotifyParams{UserID: ID(object(access)["user_id"].(string)), Kind: "review_like", ObjectID: in.ID})
		case "comments":
			if !ID(in.ID).Valid || in.Body == "" || len(in.Body) > 5000 || in.Layer < 1 || in.Layer > 3 {
				return nil, ErrInvalid
			}
			a, e := q.ReviewAccess(ctx, ID(in.ID))
			if e != nil {
				return nil, e
			}
			m := object(a)
			if float64(in.Layer) > m["allowed_layer"].(float64) {
				return nil, ErrForbidden
			}
			b, e := q.AddComment(ctx, db.AddCommentParams{ReviewID: ID(in.ID), Body: in.Body, Layer: in.Layer})
			if e != nil {
				return nil, e
			}
			return b, q.Notify(ctx, db.NotifyParams{UserID: ID(m["user_id"].(string)), Kind: "comment", ObjectID: in.ID})
		case "notifications":
			return nil, q.ReadNotifications(ctx)
		case "availability-alerts":
			return nil, q.ReadAvailabilityAlerts(ctx)
		case "report":
			if in.Subject == "" || in.Reason == "" || len(in.Reason) > 2000 {
				return nil, ErrInvalid
			}
			return nil, q.Report(ctx, db.ReportParams{Subject: in.Subject, Reason: in.Reason})
		case "progress":
			return q.SaveProgress(ctx, pack(in))
		case "craft":
			return q.SaveCraftNote(ctx, pack(in))
		}
		return nil, ErrInvalid
	})
}
func saveViewing(ctx context.Context, q *db.Queries, in Input) (any, error) {
	var b []byte
	var e error
	kind := "initial"
	if in.Rewatch {
		kind = "rewatch"
	}
	if in.ID != "" {
		b, e = q.EditViewing(ctx, pack(in))
		kind = "correction"
	} else {
		b, e = q.AddViewing(ctx, pack(in))
		if errors.Is(e, pgx.ErrNoRows) {
			return q.ExistingViewing(ctx, ID(in.RequestID))
		}
	}
	if e != nil {
		return nil, e
	}
	v := object(b)
	in.ViewingID = v["id"].(string)
	in.FilmID = int64(v["film_id"].(float64))
	in.Kind = kind
	in.Reflection = in.Notes
	if _, e = q.AddOpinion(ctx, pack(in)); e != nil {
		return nil, e
	}
	if in.Scene != "" || in.Emotion != "" || in.Context != "" {
		if _, e = q.SaveMemory(ctx, pack(in)); e != nil {
			return nil, e
		}
	}
	viewingID := ID(in.ViewingID)
	if e = q.DeleteViewingFeelings(ctx, viewingID); e != nil {
		return nil, e
	}
	if len(in.Feelings) > 0 {
		if e = q.AddViewingFeelings(ctx, viewingID, in.Feelings); e != nil {
			return nil, e
		}
	}
	if e = q.RemoveWatchlist(ctx, in.FilmID); e != nil {
		return nil, e
	}
	// GAP 20: finishing a film for real, even one previously marked paused or
	// abandoned, resolves the partial-viewing record — it's a completed watch
	// now, not an abandonment, and must never show up as both.
	if e = q.ClearProgress(ctx, in.FilmID); e != nil {
		return nil, e
	}
	return b, q.Analytics(ctx, "film_logged")
}
func (s *Service) Comments(ctx context.Context, user, id string) (json.RawMessage, error) {
	if !ID(id).Valid {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		a, e := q.ReviewAccess(ctx, ID(id))
		if e != nil {
			return nil, e
		}
		return q.Comments(ctx, db.CommentsParams{ReviewID: ID(id), Layer: int32(object(a)["allowed_layer"].(float64))})
	})
}
func (s *Service) Delete(ctx context.Context, user, area, id string) (json.RawMessage, error) {
	if !ID(id).Valid {
		return nil, ErrInvalid
	}
	return s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		switch area {
		case "diary":
			return q.DeleteViewing(ctx, ID(id))
		case "memories":
			return q.DeleteMemory(ctx, ID(id))
		case "reviews":
			return q.DeleteReview(ctx, ID(id))
		case "lists":
			return q.DeleteList(ctx, ID(id))
		case "craft":
			return q.DeleteCraftNote(ctx, ID(id))
		}
		return nil, ErrInvalid
	})
}
func Int(s string) int64 { n, _ := strconv.ParseInt(s, 10, 64); return n }

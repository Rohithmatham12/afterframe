package service

import (
	"afterframe/internal/catalog"
	"afterframe/internal/db"
	"afterframe/internal/memory"
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
	"strconv"
	"time"
)

var ErrInvalid = errors.New("invalid input")
var ErrForbidden = errors.New("not found or not permitted")

type Service struct {
	Pool    *pgxpool.Pool
	Catalog *catalog.Client
}
type Input struct {
	ID          string   `json:"id"`
	FilmID      int64    `json:"film_id"`
	WatchedOn   string   `json:"watched_on"`
	Rating      *float64 `json:"rating"`
	Notes       string   `json:"notes"`
	Rewatch     bool     `json:"rewatch"`
	Private     bool     `json:"private"`
	RequestID   string   `json:"request_id"`
	ViewingID   string   `json:"viewing_id"`
	Scene       string   `json:"scene"`
	Emotion     string   `json:"emotion"`
	Context     string   `json:"context"`
	Reflection  string   `json:"reflection"`
	Kind        string   `json:"kind"`
	Safe        string   `json:"safe"`
	Watched     string   `json:"watched"`
	Layer       int32    `json:"layer"`
	Body        string   `json:"body"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Ranked      bool     `json:"ranked"`
	FilmIDs     []int64  `json:"film_ids"`
	Username    string   `json:"username"`
	Name        string   `json:"name"`
	Bio         string   `json:"bio"`
	Resurface   bool     `json:"resurface"`
	TargetID    string   `json:"target_id"`
	Enabled     bool     `json:"enabled"`
	Subject     string   `json:"subject"`
	Reason      string   `json:"reason"`
}
type Filter struct {
	Query, Emotion, From, To, Month, TargetID string
	FilmID                                    int64
	Offset                                    int32
	Mine                                      bool
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
func (s *Service) Read(ctx context.Context, user, area string, f Filter) (json.RawMessage, error) {
	if len(f.Query) > 300 || f.Offset < 0 || f.Offset > 100000 {
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
			return q.Resurface(ctx)
		case "watchlist":
			return q.Watchlist(ctx)
		case "lists":
			return q.Lists(ctx, f.Mine)
		case "people":
			return q.Profiles(ctx, pgtype.Text{String: f.Query, Valid: true})
		case "notifications":
			return q.Notifications(ctx)
		case "reviews", "feed":
			v, e := q.ReadReviews(ctx, db.ReadReviewsParams{Column1: f.FilmID, Column2: area == "feed", Offset: f.Offset})
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
	}
	if area == "me" && !regexp.MustCompile(`^[a-z0-9_]{3,30}$`).MatchString(in.Username) {
		return fmt.Errorf("%w: username needs 3–30 lowercase letters, numbers or underscores", ErrInvalid)
	}
	return nil
}
func (s *Service) Write(ctx context.Context, user, area string, in Input) (json.RawMessage, error) {
	if e := Validate(area, in); e != nil {
		return nil, e
	}
	needsFilm := area == "diary" || area == "timeline" || area == "reviews" || area == "watchlist" || area == "reveal"
	if needsFilm {
		if _, e := s.Film(ctx, in.FilmID); e != nil {
			return nil, e
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
			return q.SetWatchlist(ctx, db.SetWatchlistParams{FilmID: in.FilmID, Private: in.Private})
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
		case "list-like":
			if !ID(in.ID).Valid {
				return nil, ErrInvalid
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
		case "report":
			if in.Subject == "" || in.Reason == "" || len(in.Reason) > 2000 {
				return nil, ErrInvalid
			}
			return nil, q.Report(ctx, db.ReportParams{Subject: in.Subject, Reason: in.Reason})
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
	if e = q.RemoveWatchlist(ctx, in.FilmID); e != nil {
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
		}
		return nil, ErrInvalid
	})
}
func Int(s string) int64 { n, _ := strconv.ParseInt(s, 10, 64); return n }

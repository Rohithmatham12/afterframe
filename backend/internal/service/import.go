package service

import (
	"afterframe/internal/db"
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/google/uuid"
)

// GAP 15: Letterboxd diary import. The CSV itself is parsed client-side (no
// ZIP-handling dependency needed); this only ever receives already-parsed,
// already-typed rows and is responsible for the parts that actually need a
// server — film matching, ownership, and idempotency.

type ImportEntry struct {
	Title     string   `json:"title"`
	Year      string   `json:"year"`
	WatchedOn string   `json:"watched_on"`
	Rating    *float64 `json:"rating"`
	Rewatch   bool     `json:"rewatch"`
}
type ImportSkip struct {
	Title  string `json:"title"`
	Reason string `json:"reason"`
}

const importEntryCap = 500

// importNamespace anchors deterministic per-entry request IDs: re-uploading
// the same export twice must not duplicate diary entries. It intentionally
// does NOT depend on anything random, so the same (user, film, date) always
// derives the same ID and lands on the existing ON CONFLICT DO NOTHING path
// AddViewing already has.
var importNamespace = uuid.NewSHA1(uuid.NameSpaceOID, []byte("afterframe-letterboxd-import"))

func importRequestID(user string, filmID int64, watchedOn string) string {
	return uuid.NewSHA1(importNamespace, []byte(user+":"+strconv.FormatInt(filmID, 10)+":"+watchedOn)).String()
}

// ImportDiary never fails the whole batch for one bad row — each entry is
// independently matched and saved, and anything that doesn't work is
// reported back by name and reason rather than silently dropped.
func (s *Service) ImportDiary(ctx context.Context, user string, entries []ImportEntry) (json.RawMessage, error) {
	if len(entries) == 0 {
		return nil, fmt.Errorf("%w: no entries to import", ErrInvalid)
	}
	if len(entries) > importEntryCap {
		return nil, fmt.Errorf("%w: import is limited to %d entries at a time", ErrInvalid, importEntryCap)
	}
	imported := 0
	skipped := []ImportSkip{}
	for _, e := range entries {
		if e.Title == "" {
			skipped = append(skipped, ImportSkip{e.Title, "missing title"})
			continue
		}
		filmID, matched := s.matchImportFilm(ctx, e.Title, e.Year)
		if !matched {
			skipped = append(skipped, ImportSkip{e.Title, "no confident match found — title/year did not match a TMDB result"})
			continue
		}
		if _, fe := s.Film(ctx, filmID); fe != nil {
			skipped = append(skipped, ImportSkip{e.Title, "could not load film details"})
			continue
		}
		in := Input{
			FilmID:    filmID,
			WatchedOn: e.WatchedOn,
			Rating:    e.Rating,
			Rewatch:   e.Rewatch,
			RequestID: importRequestID(user, filmID, e.WatchedOn),
		}
		if ve := Validate("diary", in); ve != nil {
			skipped = append(skipped, ImportSkip{e.Title, "invalid entry: " + ve.Error()})
			continue
		}
		if _, se := s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
			return saveViewing(ctx, q, in)
		}); se != nil {
			skipped = append(skipped, ImportSkip{e.Title, "could not save this entry"})
			continue
		}
		imported++
	}
	return pack(map[string]any{"imported": imported, "skipped": skipped}), nil
}

// matchImportFilm requires an exact year match when a year is supplied
// (Letterboxd always supplies one) rather than guessing the top search
// result — a wrong match would silently corrupt someone's real diary.
func (s *Service) matchImportFilm(ctx context.Context, title, year string) (int64, bool) {
	results, e := s.Catalog.Search(ctx, title, "", 1)
	if e != nil || len(results) == 0 {
		return 0, false
	}
	if year == "" {
		return results[0].ID, true
	}
	for _, r := range results {
		if r.Year == year {
			return r.ID, true
		}
	}
	return 0, false
}

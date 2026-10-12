// Package recommend is Afterframe's deterministic, paid-AI-free Tonight Mode
// scorer. Every number here is a documented, fixed weight — not learned, not
// hidden. See the formula comment on Score for the whole thing in one place.
package recommend

import (
	"sort"
)

// Candidate is the minimal shape Rank needs from a film; the caller (service
// layer) is responsible for building this from the real catalog + database.
type Candidate struct {
	FilmID      int64
	Genres      []string
	Runtime     int // minutes; 0 means unknown, never hard-filtered on unknown
	Popularity  int // position in a popularity-ordered source list; lower = more popular. Tiebreaker only, never part of Score.
	InWatchlist bool
	// Certification is the film's rating string for Constraints.FamilyRegion
	// (e.g. "PG-13"), or "" when TMDB has no certification on file for that
	// region. GAP 18's family filter treats "" exactly like an unrecognized
	// rating: conservatively excluded, never assumed safe.
	Certification string
}

// Constraints are hard filters. They are applied before scoring and can
// never be overridden by a high score — that is the whole point of calling
// them constraints rather than preferences.
type Constraints struct {
	MaxMinutes int    // 0 = no limit
	Context    string // "", solo, date_night, friends, family, kids
	// FamilyPolicy ("", "strict", "standard") and FamilyRegion are GAP 18's
	// certification-aware hard filter — distinct from the Context=="kids"
	// genre-based filter above, which knows nothing about ratings.
	FamilyPolicy string
	FamilyRegion string
}

// Taste is a net per-genre affinity: positive means liked more than
// disliked, negative the reverse. The service layer builds this from taste
// quiz answers and logged ratings; Rank itself has no opinion about where
// the numbers came from.
type Taste struct {
	GenreScore map[string]int
	// Label names whose taste this is in a reason string, e.g. "@jordan" for
	// a connected partner. Empty defaults to "your guest" (the hand-entered,
	// no-account path), so existing callers need no change.
	Label string
}

type Pick struct {
	FilmID  int64
	Score   float64
	Reasons []string
}

// contextGenres and moodGenres are small, fixed, documented lookup tables —
// not learned weights. They exist so "date night" or "energized" nudges the
// ranking without needing a taste history to do it.
var contextGenres = map[string][]string{
	"date_night": {"Romance", "Comedy", "Drama"},
	"family":     {"Family", "Animation", "Adventure"},
	"kids":       {"Family", "Animation"},
	"friends":    {"Comedy", "Action", "Thriller"},
}

var moodGenres = map[string][]string{
	"comforted":   {"Family", "Romance", "Comedy"},
	"energized":   {"Action", "Adventure"},
	"inspired":    {"Drama", "History", "Documentary"},
	"thoughtful":  {"Drama", "Mystery", "Documentary"},
	"amused":      {"Comedy"},
	"nostalgic":   {"Family", "Animation"},
	"hopeful":     {"Drama", "Family"},
	"calm":        {"Documentary", "Drama"},
	"amazed":      {"Science Fiction", "Fantasy", "Adventure"},
	"melancholic": {"Drama"},
}

const (
	watchlistBonus = 3.0
	contextBonus   = 2.0
	moodBonus      = 2.0
)

// kidsGenres gates the "kids" context as a hard filter, not a score nudge —
// a high taste-affinity score must never surface an inappropriate pick for
// that context. This is a genre-based filter only; GAP 18's Family Mode
// (FamilySafe, below) is the separate certification-aware filter.
var kidsGenres = map[string]bool{"Family": true, "Animation": true}

// GAP 18: a deliberately small, documented, best-effort map from a region's
// real TMDB/MPA-style certification strings to a coarse maturity tier. It is
// not exhaustive — most regions and many certification strings are simply
// absent — by design: FamilySafe treats anything outside this map exactly
// like a missing rating, never as implicitly safe. "strict" only admits the
// youngest tier; "standard" additionally admits content meant for a general
// or teen audience. Nothing above that tier is ever considered family-safe.
var familyCertTiers = map[string]map[string]string{
	"US": {"G": "strict", "TV-Y": "strict", "TV-G": "strict", "PG": "standard", "TV-PG": "standard", "PG-13": "standard", "TV-14": "standard"},
	"GB": {"U": "strict", "PG": "standard", "12": "standard", "12A": "standard"},
	"CA": {"G": "strict", "PG": "standard", "14A": "standard"},
	"AU": {"G": "strict", "PG": "standard", "M": "standard"},
	"IN": {"U": "strict", "UA": "standard"},
	"DE": {"0": "strict", "6": "strict", "12": "standard"},
	"FR": {"U": "strict", "10": "standard", "12": "standard"},
}

// FamilySafe is pure and conservative: no mapped region, no certification on
// file, or a certification outside the known tiers for that policy all
// resolve to false, never true. policy=="" means Family Mode is off, so
// everything passes (the caller decides whether to even call this).
func FamilySafe(region, certification, policy string) bool {
	if policy == "" {
		return true
	}
	tiers, ok := familyCertTiers[region]
	if !ok {
		return false
	}
	tier, ok := tiers[certification]
	if !ok {
		return false
	}
	if policy == "strict" {
		return tier == "strict"
	}
	return true // policy=="standard": tier is "strict" or "standard", both admitted
}

// Score documents the entire formula in one place:
//
//	score = genre_affinity (sum of Taste.GenreScore for each of the film's genres)
//	      + context_bonus (contextBonus if any genre matches the requested context)
//	      + mood_bonus    (moodBonus if any genre matches the requested mood)
//	      + watchlist_bonus (watchlistBonus if the film is already watchlisted)
//
// Popularity is never part of the score; it only breaks ties, so a cold-start
// user with zero taste data still gets a sensible, non-random order instead
// of all-zero scores sorting arbitrarily.
func Score(c Candidate, taste Taste, mood, context string) (float64, []string) {
	score := 0.0
	var reasons []string
	var matchedGenres []string
	for _, g := range c.Genres {
		if v := taste.GenreScore[g]; v != 0 {
			score += float64(v)
			matchedGenres = append(matchedGenres, g)
		}
	}
	if len(matchedGenres) > 0 {
		reasons = append(reasons, "matches your taste in "+joinGenres(matchedGenres))
	}
	if hasOverlap(c.Genres, contextGenres[context]) {
		score += contextBonus
		reasons = append(reasons, "fits a "+humanContext(context)+" pick")
	}
	if hasOverlap(c.Genres, moodGenres[mood]) {
		score += moodBonus
		reasons = append(reasons, "matches a "+mood+" mood")
	}
	if c.InWatchlist {
		score += watchlistBonus
		reasons = append(reasons, "already on your watchlist")
	}
	return score, reasons
}

// Rank applies hard constraints, scores every surviving candidate (against a
// second Taste for a guest/partner when present, using a balanced-couple
// objective that rewards overlap without ignoring whichever person likes it
// least), breaks diversity so the same primary genre can't dominate all of
// max picks, and returns at most max pick. It never pads with irrelevant
// films: fewer than max eligible candidates means fewer than max picks.
func Rank(candidates []Candidate, taste Taste, guest *Taste, c Constraints, mood string, max int) ([]Pick, int) {
	eligible := make([]Candidate, 0, len(candidates))
	for _, cand := range candidates {
		if c.MaxMinutes > 0 && cand.Runtime > 0 && cand.Runtime > c.MaxMinutes {
			continue
		}
		if c.Context == "kids" && !hasOverlap(cand.Genres, keys(kidsGenres)) {
			continue
		}
		if c.FamilyPolicy != "" && !FamilySafe(c.FamilyRegion, cand.Certification, c.FamilyPolicy) {
			continue
		}
		eligible = append(eligible, cand)
	}
	scored := make([]Pick, len(eligible))
	for i, cand := range eligible {
		score, reasons := Score(cand, taste, mood, c.Context)
		if guest != nil {
			gScore, gReasons := Score(cand, *guest, mood, c.Context)
			// Balanced-couple objective: reward overall fit but weight it by
			// whichever person likes the pick least, so one person's taste
			// is never simply averaged away. Documented weights: the weaker
			// fit counts in full, the combined total counts for a quarter.
			combined := min(score, gScore) + 0.25*(score+gScore)
			if len(gReasons) > 0 {
				label := guest.Label
				if label == "" {
					label = "your guest"
				}
				reasons = append(reasons, "for "+label+": "+joinGenres(gReasons))
			}
			score = combined
		}
		scored[i] = Pick{FilmID: cand.FilmID, Score: score, Reasons: reasons}
	}
	byID := map[int64]Candidate{}
	for _, cand := range eligible {
		byID[cand.FilmID] = cand
	}
	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score > scored[j].Score
		}
		return byID[scored[i].FilmID].Popularity < byID[scored[j].FilmID].Popularity
	})
	picks := diversify(scored, byID, max)
	return picks, len(eligible)
}

// diversify caps how many final picks can share the same primary (first
// listed) genre, so three near-identical films never crowd out variety.
func diversify(ranked []Pick, byID map[int64]Candidate, max int) []Pick {
	const perGenreCap = 2
	genreCount := map[string]int{}
	picks := make([]Pick, 0, max)
	for _, p := range ranked {
		if len(picks) == max {
			break
		}
		primary := ""
		if gs := byID[p.FilmID].Genres; len(gs) > 0 {
			primary = gs[0]
		}
		if primary != "" && genreCount[primary] >= perGenreCap {
			continue
		}
		picks = append(picks, p)
		if primary != "" {
			genreCount[primary]++
		}
	}
	return picks
}

func hasOverlap(a, b []string) bool {
	set := map[string]bool{}
	for _, x := range a {
		set[x] = true
	}
	for _, y := range b {
		if set[y] {
			return true
		}
	}
	return false
}
func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
func joinGenres(g []string) string {
	out := g[0]
	for _, x := range g[1:] {
		out += ", " + x
	}
	return out
}
func humanContext(c string) string {
	switch c {
	case "date_night":
		return "date night"
	default:
		return c
	}
}

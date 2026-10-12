package recommend

import (
	"strings"
	"testing"
)

func contains(picks []Pick, id int64) bool {
	for _, p := range picks {
		if p.FilmID == id {
			return true
		}
	}
	return false
}

// A new user with three liked genres should be ranked above unrelated films.
func TestNewUserWithThreeLikes(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Drama": 1, "Crime": 1, "Mystery": 1}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Drama", "Crime"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Horror"}, Popularity: 2},
		{FilmID: 3, Genres: []string{"Mystery"}, Popularity: 3},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "", 3)
	if picks[0].FilmID != 1 {
		t.Fatalf("expected the double-genre-match film first, got %+v", picks)
	}
	if contains(picks[:1], 2) {
		t.Fatal("an unrelated genre should not rank first")
	}
}

// A new user with three disliked genres should see those films rank last,
// never excluded outright by taste alone (only hard constraints exclude).
func TestNewUserWithThreeDislikes(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Horror": -1, "War": -1, "Western": -1}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Horror"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Comedy"}, Popularity: 2},
	}
	picks, eligible := Rank(candidates, taste, nil, Constraints{}, "", 3)
	if eligible != 2 {
		t.Fatalf("dislikes must not be hard-excluded, both remain eligible: got %d", eligible)
	}
	if picks[0].FilmID != 2 {
		t.Fatalf("the disliked-genre film must not outrank the neutral one: %+v", picks)
	}
}

// A user whose quiz was all "unseen" has an empty taste map; Rank must still
// return a sane, non-empty, popularity-ordered result instead of garbage.
func TestUnseenOnlyUserGetsPopularityOrderedFallback(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Drama"}, Popularity: 3},
		{FilmID: 2, Genres: []string{"Comedy"}, Popularity: 1},
		{FilmID: 3, Genres: []string{"Action"}, Popularity: 2},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "", 3)
	if len(picks) != 3 || picks[0].FilmID != 2 || picks[1].FilmID != 3 || picks[2].FilmID != 1 {
		t.Fatalf("expected pure popularity order with all-zero scores, got %+v", picks)
	}
}

// A horror fan asking for a "comforted" mood should see comfort genres
// nudged up even though their taste history itself leans Horror.
func TestHorrorFanSeekingComfortMood(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Horror": 3}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Horror"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Family"}, Popularity: 2},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "comforted", 2)
	// Horror still wins on raw taste (3 vs moodBonus 2) — mood nudges, it
	// does not override strong existing taste. Verify the nudge is real:
	// without the mood, Family would trail by the full gap, not just by 1.
	_, familyReasonsNoMood := Score(candidates[1], taste, "", "")
	_, familyReasonsMood := Score(candidates[1], taste, "comforted", "")
	if len(familyReasonsMood) <= len(familyReasonsNoMood) {
		t.Fatal("comforted mood must add a reason/bonus to the Family pick")
	}
	if picks[0].FilmID != 1 {
		t.Fatalf("a strong existing taste signal should still win over a mood nudge: %+v", picks)
	}
}

// A couple with conflicting genre taste must get a balanced pick, not one
// person's preference simply overriding the other's.
func TestCoupleWithConflictingGenres(t *testing.T) {
	a := Taste{GenreScore: map[string]int{"Horror": 5}}
	b := Taste{GenreScore: map[string]int{"Horror": -5, "Comedy": 2}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Horror"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Comedy"}, Popularity: 2},
	}
	picks, _ := Rank(candidates, a, &b, Constraints{}, "", 2)
	// Horror: min(5,-5) + 0.25*(0) = -5. Comedy: min(0,2) + 0.25*(2) = 0.5.
	if picks[0].FilmID != 2 {
		t.Fatalf("the film one partner strongly dislikes must not win: %+v", picks)
	}
}

// A connected partner's name, not a generic "guest", must appear in the
// explanation — a real account they consented to share with deserves to be
// named, same as the hand-entered guest path defaults sensibly without one.
func TestSecondTasteLabelDefaultsAndCanBeNamed(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{}}
	candidates := []Candidate{{FilmID: 1, Genres: []string{"Comedy"}}}

	anonymous := Taste{GenreScore: map[string]int{"Comedy": 1}}
	picks, _ := Rank(candidates, taste, &anonymous, Constraints{}, "", 1)
	if !anyContains(picks[0].Reasons, "for your guest:") {
		t.Fatalf("expected the default guest label, got %+v", picks[0].Reasons)
	}

	named := Taste{GenreScore: map[string]int{"Comedy": 1}, Label: "@jordan"}
	picks, _ = Rank(candidates, taste, &named, Constraints{}, "", 1)
	if !anyContains(picks[0].Reasons, "for @jordan:") {
		t.Fatalf("expected the named partner label, got %+v", picks[0].Reasons)
	}
}

func anyContains(items []string, substr string) bool {
	for _, s := range items {
		if strings.Contains(s, substr) {
			return true
		}
	}
	return false
}

// A 90-minute limit is a hard constraint: a great match that runs long must
// be excluded, not merely penalized.
func TestNinetyMinuteLimitIsHardNotSoft(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Drama": 10}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Drama"}, Runtime: 150, Popularity: 1},
		{FilmID: 2, Genres: []string{"Comedy"}, Runtime: 85, Popularity: 2},
	}
	picks, eligible := Rank(candidates, taste, nil, Constraints{MaxMinutes: 90}, "", 2)
	if eligible != 1 {
		t.Fatalf("the long film must be excluded entirely, not scored low: eligible=%d", eligible)
	}
	if contains(picks, 1) {
		t.Fatal("a runtime-violating film leaked into the results")
	}
}

// A regional-cinema enthusiast's taste (built from non-English genre/history
// signals the same way as any other) must be able to outrank mainstream
// popularity when it matches better.
func TestRegionalTasteCanOutrankPopularity(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Foreign": 4}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Action"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Foreign", "Drama"}, Popularity: 50},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "", 2)
	if picks[0].FilmID != 2 {
		t.Fatalf("real taste match should beat raw popularity: %+v", picks)
	}
}

// A user with literally no ratings or quiz answers must still get a result,
// never an error or an empty list, as long as candidates exist.
func TestUserWithNoRatingsStillGetsResults(t *testing.T) {
	picks, eligible := Rank(
		[]Candidate{{FilmID: 1, Genres: []string{"Drama"}, Popularity: 1}},
		Taste{GenreScore: map[string]int{}}, nil, Constraints{}, "", 3,
	)
	if eligible != 1 || len(picks) != 1 {
		t.Fatalf("expected the single candidate back: picks=%+v eligible=%d", picks, eligible)
	}
}

// A watchlisted film must be favored, and the reason surfaced.
func TestWatchlistedFilmIsFavoredAndExplained(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Drama"}, InWatchlist: false, Popularity: 1},
		{FilmID: 2, Genres: []string{"Drama"}, InWatchlist: true, Popularity: 2},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "", 2)
	if picks[0].FilmID != 2 {
		t.Fatalf("the watchlisted film should rank first: %+v", picks)
	}
	found := false
	for _, r := range picks[0].Reasons {
		if r == "already on your watchlist" {
			found = true
		}
	}
	if !found {
		t.Fatalf("missing the watchlist reason: %+v", picks[0].Reasons)
	}
}

// The "kids" context is a hard filter: an adult-genre film must never appear
// even if nothing else is eligible.
func TestKidsContextHardFiltersEvenWhenNothingElseQualifies(t *testing.T) {
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Horror"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"War"}, Popularity: 2},
	}
	picks, eligible := Rank(candidates, Taste{GenreScore: map[string]int{}}, nil, Constraints{Context: "kids"}, "", 3)
	if eligible != 0 || len(picks) != 0 {
		t.Fatalf("no candidate should qualify for kids context here, got eligible=%d picks=%+v", eligible, picks)
	}
}

// Diversity: three near-identical genre films must not all win; at most two
// share a primary genre among the final picks.
func TestDiversityCapsRepeatedPrimaryGenre(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Drama": 5}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Drama"}, Popularity: 1},
		{FilmID: 2, Genres: []string{"Drama"}, Popularity: 2},
		{FilmID: 3, Genres: []string{"Drama"}, Popularity: 3},
		{FilmID: 4, Genres: []string{"Comedy"}, Popularity: 4},
	}
	picks, _ := Rank(candidates, taste, nil, Constraints{}, "", 3)
	dramaCount := 0
	for _, p := range picks {
		if p.FilmID == 1 || p.FilmID == 2 || p.FilmID == 3 {
			dramaCount++
		}
	}
	if dramaCount > 2 {
		t.Fatalf("expected at most 2 Drama picks for variety, got %d: %+v", dramaCount, picks)
	}
	if len(picks) != 3 {
		t.Fatalf("diversity capping must still fill the remaining slot, got %+v", picks)
	}
}

// Never pad with irrelevant films: fewer eligible than requested means fewer
// picks, not arbitrary filler.
func TestNeverPadsWithFillerFilms(t *testing.T) {
	picks, eligible := Rank(
		[]Candidate{{FilmID: 1, Genres: []string{"Drama"}, Runtime: 200}},
		Taste{GenreScore: map[string]int{}}, nil, Constraints{MaxMinutes: 90}, "", 3,
	)
	if eligible != 0 || len(picks) != 0 {
		t.Fatalf("expected zero picks when nothing is eligible, got eligible=%d picks=%+v", eligible, picks)
	}
}

// GAP 18: FamilySafe is pure and conservative — a known rating resolves
// correctly, but anything outside the fixed, documented map (missing
// certification, unmapped region, policy off) never falls back to "safe".
func TestFamilySafeIsConservativeAboutUnknowns(t *testing.T) {
	if !FamilySafe("US", "PG-13", "") {
		t.Fatal("policy off must never filter anything")
	}
	if !FamilySafe("US", "G", "strict") {
		t.Fatal("G should pass strict")
	}
	if FamilySafe("US", "PG-13", "strict") {
		t.Fatal("PG-13 should not pass strict")
	}
	if !FamilySafe("US", "PG-13", "standard") {
		t.Fatal("PG-13 should pass standard")
	}
	if FamilySafe("US", "R", "standard") {
		t.Fatal("R must never pass any family policy")
	}
	if FamilySafe("US", "", "standard") {
		t.Fatal("a missing certification must be treated conservatively, not as safe")
	}
	if FamilySafe("US", "NOT-A-REAL-RATING", "standard") {
		t.Fatal("an unmapped certification string must be treated conservatively, not as safe")
	}
	if FamilySafe("ZZ", "G", "strict") {
		t.Fatal("a region with no certification data must be treated conservatively, not as safe")
	}
}

// Family Mode is a hard filter, like runtime and the kids context — a high
// taste score must never surface a film the policy excludes.
func TestFamilyModeHardFiltersCannotBeOutscored(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{"Action": 10}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Action"}, Certification: "R", Popularity: 1},
		{FilmID: 2, Genres: []string{"Action"}, Certification: "PG", Popularity: 2},
		{FilmID: 3, Genres: []string{"Action"}, Certification: "", Popularity: 3}, // unknown rating
	}
	picks, eligible := Rank(candidates, taste, nil,
		Constraints{FamilyPolicy: "standard", FamilyRegion: "US"}, "", 3)
	if eligible != 1 || len(picks) != 1 || picks[0].FilmID != 2 {
		t.Fatalf("expected only the PG film to survive family filtering, got eligible=%d picks=%+v", eligible, picks)
	}
}

// Family Mode and the kids-context genre filter are independent — turning
// one on doesn't accidentally disable or weaken the other.
func TestFamilyModeComposesWithKidsContext(t *testing.T) {
	taste := Taste{GenreScore: map[string]int{}}
	candidates := []Candidate{
		{FilmID: 1, Genres: []string{"Family"}, Certification: "G", Popularity: 1},
		{FilmID: 2, Genres: []string{"Family"}, Certification: "PG-13", Popularity: 2}, // fails strict
		{FilmID: 3, Genres: []string{"Horror"}, Certification: "G", Popularity: 3},     // fails kids genre filter
	}
	picks, eligible := Rank(candidates, taste, nil,
		Constraints{Context: "kids", FamilyPolicy: "strict", FamilyRegion: "US"}, "", 3)
	if eligible != 1 || len(picks) != 1 || picks[0].FilmID != 1 {
		t.Fatalf("expected both filters to apply together, got eligible=%d picks=%+v", eligible, picks)
	}
}

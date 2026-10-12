package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestSpoilerDisclosure(t *testing.T) {
	for _, layer := range []float64{1, 2, 3} {
		r := map[string]any{"safe": "safe", "watched": "PLOT_SECRET", "reflection": "DEEP_SECRET", "allowed_layer": layer}
		Disclose(r)
		b, _ := json.Marshal(r)
		if layer < 2 && strings.Contains(string(b), "PLOT_SECRET") {
			t.Fatal("plot leaked")
		}
		if layer < 3 && strings.Contains(string(b), "DEEP_SECRET") {
			t.Fatal("reflection leaked")
		}
		if r["safe"] != "safe" {
			t.Fatal("safe layer missing")
		}
	}
}
func TestRatingValidation(t *testing.T) {
	for _, n := range []float64{-.5, 0, 5.5, 4.2} {
		if Validate("timeline", Input{Rating: &n}) == nil {
			t.Errorf("accepted %v", n)
		}
	}
	for _, n := range []float64{.5, 1, 4.5, 5} {
		if e := Validate("timeline", Input{Rating: &n}); e != nil {
			t.Fatal(e)
		}
	}
}
func TestMalformedInput(t *testing.T) {
	for _, in := range []Input{{ID: "not-a-uuid"}, {Scene: strings.Repeat("x", 10001)}, {Emotion: strings.Repeat("x", 101)}} {
		if Validate("memories", in) == nil {
			t.Fatal("accepted malformed input")
		}
	}
}
func TestDiaryDate(t *testing.T) {
	if Validate("diary", Input{WatchedOn: "2025-02-30"}) == nil {
		t.Fatal("invalid calendar date accepted")
	}
}
func TestUsernameNormalization(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"Strike", "strike"},
		{"Strike_2026", "strike_2026"},
		{"  Padded  ", "padded"},
	} {
		if got := NormalizeUsername(c.in); got != c.want {
			t.Errorf("NormalizeUsername(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
func TestUsernameValidation(t *testing.T) {
	for _, u := range []string{"strike", "strike_2026", "abc", thirtyChars} {
		if e := ValidUsername(u); e != nil {
			t.Errorf("rejected valid username %q: %v", u, e)
		}
	}
	for _, u := range []string{"Strike", "ab", "strike@movies", "strike films", strings.Repeat("x", 31), "admin", "afterframe"} {
		if ValidUsername(u) == nil {
			t.Errorf("accepted invalid/reserved username %q", u)
		}
	}
}
func TestWriteNormalizesUsernameBeforeValidation(t *testing.T) {
	// Validate alone rejects uppercase; Write must normalize first so a user
	// typing "Strike" in the UI is not rejected by the authoritative server check.
	if Validate("me", Input{Username: "Strike"}) == nil {
		t.Fatal("Validate unexpectedly accepted unnormalized input; Write's normalize step would be redundant")
	}
	if e := Validate("me", Input{Username: NormalizeUsername("Strike")}); e != nil {
		t.Fatalf("normalized username rejected: %v", e)
	}
}
func TestUsernameSuggestionsAreHandleShaped(t *testing.T) {
	for _, s := range usernameSuggestions("strike") {
		if ValidUsername(s) != nil {
			t.Errorf("suggestion %q is not itself a valid username", s)
		}
	}
}

var thirtyChars = strings.Repeat("a", 30)

func TestDiffProvidersReportsVerifiedChangesOnly(t *testing.T) {
	changes := diffProviders([]string{"Netflix", "Hulu"}, []string{"Netflix", "Max"})
	if len(changes) != 2 {
		t.Fatalf("expected one addition and one removal, got %+v", changes)
	}
	byProvider := map[string]string{}
	for _, c := range changes {
		byProvider[c.provider] = c.change
	}
	if byProvider["Max"] != "added" || byProvider["Hulu"] != "removed" {
		t.Fatalf("wrong change classification: %+v", byProvider)
	}
	if _, ok := byProvider["Netflix"]; ok {
		t.Fatal("unchanged provider must not be reported as a change")
	}
	if len(diffProviders([]string{"Netflix"}, []string{"Netflix"})) != 0 {
		t.Fatal("identical snapshots must produce zero changes, never a false alert")
	}
}

func TestSaveQuizRejectsBeforeTouchingTheDatabase(t *testing.T) {
	// A nil-Pool Service would panic if these checks ever reached s.Transaction;
	// surviving this proves validation runs first.
	var s Service
	ctx := context.Background()
	if _, e := s.SaveQuiz(ctx, "user", nil); e == nil {
		t.Fatal("accepted an empty quiz submission")
	}
	if _, e := s.SaveQuiz(ctx, "user", []QuizAnswer{{FilmID: 999999999, Response: "like"}}); e == nil {
		t.Fatal("accepted a film outside the fixed quiz set")
	}
	if _, e := s.SaveQuiz(ctx, "user", []QuizAnswer{{FilmID: quizFilmIDs[0], Response: "meh"}}); e == nil {
		t.Fatal("accepted a response outside like/dislike/unseen")
	}
	dup := []QuizAnswer{
		{FilmID: quizFilmIDs[0], Response: "like"},
		{FilmID: quizFilmIDs[0], Response: "dislike"},
	}
	if _, e := s.SaveQuiz(ctx, "user", dup); e == nil {
		t.Fatal("accepted two responses for the same quiz film")
	}
}

func TestRegionPatternRejectsAnythingButATwoLetterCode(t *testing.T) {
	for _, r := range []string{"US", "GB", "IN"} {
		if !regionPattern.MatchString(r) {
			t.Errorf("rejected valid region %q", r)
		}
	}
	for _, r := range []string{"usa", "us", "", "U1", "UNITEDSTATES"} {
		if regionPattern.MatchString(r) {
			t.Errorf("accepted invalid region %q", r)
		}
	}
}

func TestViewingContextValidation(t *testing.T) {
	for _, c := range []string{"", "solo", "date_night", "friends", "family", "kids"} {
		if e := Validate("diary", validDiaryInput(func(in *Input) { in.ViewingContext = c })); e != nil {
			t.Errorf("rejected documented context %q: %v", c, e)
		}
	}
	if Validate("diary", validDiaryInput(func(in *Input) {
		in.ViewingContext = "office_party"
	})) == nil {
		t.Fatal("accepted a viewing context outside the fixed vocabulary")
	}
}

func TestReviewToneValidation(t *testing.T) {
	for _, tone := range []string{"", "insightful", "funny"} {
		if e := Validate("reviews", Input{Tone: tone}); e != nil {
			t.Errorf("rejected documented tone %q: %v", tone, e)
		}
	}
	if Validate("reviews", Input{Tone: "sarcastic"}) == nil {
		t.Fatal("accepted a review tone outside the fixed vocabulary")
	}
}

func validDiaryInput(extra func(*Input)) Input {
	in := Input{WatchedOn: "2024-10-10", RequestID: "11111111-1111-1111-1111-111111111111"}
	if extra != nil {
		extra(&in)
	}
	return in
}

func TestFeelingsAreOptionalAndRestricted(t *testing.T) {
	if e := Validate("diary", validDiaryInput(nil)); e != nil {
		t.Fatalf("a viewing with no feelings must be loggable: %v", e)
	}
	if e := Validate("diary", validDiaryInput(func(in *Input) {
		in.Feelings = []string{"comforted", "wrecked"}
	})); e != nil {
		t.Fatalf("multiple valid feelings rejected: %v", e)
	}
	if Validate("diary", validDiaryInput(func(in *Input) {
		in.Feelings = []string{"ecstatic"}
	})) == nil {
		t.Fatal("accepted a feeling outside the fixed vocabulary")
	}
}

func TestWatchlistIntentValidation(t *testing.T) {
	if e := Validate("watchlist", Input{Intent: ""}); e != nil {
		t.Fatalf("empty intent (no reason given) must be allowed: %v", e)
	}
	if e := Validate("watchlist", Input{Intent: "date_night"}); e != nil {
		t.Fatalf("documented intent rejected: %v", e)
	}
	if Validate("watchlist", Input{Intent: "because I said so"}) == nil {
		t.Fatal("accepted an intent outside the fixed vocabulary")
	}
	if Validate("watchlist", Input{Intent: "weekend", IntentNote: strings.Repeat("x", 201)}) == nil {
		t.Fatal("accepted an oversized intent note")
	}
}

func TestProgressStatusAndReasonValidation(t *testing.T) {
	if e := Validate("progress", Input{Status: "paused"}); e != nil {
		t.Fatalf("documented status rejected: %v", e)
	}
	if e := Validate("progress", Input{Status: "abandoned", Reason: "too_intense"}); e != nil {
		t.Fatalf("documented status+reason rejected: %v", e)
	}
	if e := Validate("progress", Input{Status: "abandoned"}); e != nil {
		t.Fatalf("abandonment reason must be optional: %v", e)
	}
	if Validate("progress", Input{Status: ""}) == nil {
		t.Fatal("accepted an empty status — progress always records something")
	}
	if Validate("progress", Input{Status: "finished"}) == nil {
		t.Fatal("accepted a status outside the fixed vocabulary (finishing is a real diary entry, not a progress status)")
	}
	if Validate("progress", Input{Status: "paused", Reason: "because"}) == nil {
		t.Fatal("accepted a reason outside the fixed vocabulary")
	}
	negative := int32(-1)
	if Validate("progress", Input{Status: "started", ProgressMinutes: &negative}) == nil {
		t.Fatal("accepted negative progress minutes")
	}
}

func TestCraftCategoryValidation(t *testing.T) {
	for _, c := range []string{
		"cinematography", "editing", "sound_design", "production_design",
		"direction", "performance", "scene_reference", "other",
	} {
		if e := Validate("craft", Input{Category: c}); e != nil {
			t.Fatalf("documented category %q rejected: %v", c, e)
		}
	}
	if Validate("craft", Input{Category: ""}) == nil {
		t.Fatal("accepted an empty category — every craft note needs one")
	}
	if Validate("craft", Input{Category: "lighting"}) == nil {
		t.Fatal("accepted a category outside the fixed vocabulary")
	}
	// Craft Mode is optional: validating a different area never requires a category.
	if e := Validate("diary", Input{WatchedOn: "2024-01-01", RequestID: "11111111-1111-1111-1111-111111111111"}); e != nil {
		t.Fatalf("an unrelated area must not demand a craft category: %v", e)
	}
}

func TestResurfaceExplanationIsHonestNeverFabricated(t *testing.T) {
	recent := time.Now().AddDate(0, 0, -5).Format("2006-01-02")
	if e := resurfaceExplanation(recent); e != "Not long ago, you watched this." {
		t.Fatalf("unexpected recent explanation: %q", e)
	}
	yearAgo := time.Now().AddDate(-2, 0, 0).Format("2006-01-02")
	if e := resurfaceExplanation(yearAgo); e != "2 years ago around this time, you watched this." {
		t.Fatalf("unexpected multi-year explanation: %q", e)
	}
	if e := resurfaceExplanation("not-a-date"); e != "A memory from an earlier chapter." {
		t.Fatalf("expected safe fallback for an unparseable date, got %q", e)
	}
}

func TestVisibilityValidation(t *testing.T) {
	for _, v := range []string{"", "private", "followers", "public"} {
		if e := Validate("diary", validDiaryInput(func(in *Input) { in.Visibility = v })); e != nil {
			t.Errorf("rejected documented visibility %q: %v", v, e)
		}
	}
	if Validate("diary", validDiaryInput(func(in *Input) {
		in.Visibility = "friends"
	})) == nil {
		t.Fatal("accepted \"friends\" — this app only has one-way follows, must use \"followers\"")
	}
}

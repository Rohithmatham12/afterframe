package taste

import "testing"

func TestBuildRatingSuppressesBelowMinSample(t *testing.T) {
	r := BuildRating(4.5, true, MinRatingSample-1, "afterframe_community")
	if r.Score != nil {
		t.Fatalf("expected a suppressed (nil) score below the minimum sample, got %v", *r.Score)
	}
	if r.SampleSize != MinRatingSample-1 {
		t.Fatal("sample size must still be reported even when the score is suppressed")
	}
}

func TestBuildRatingShowsAtOrAboveMinSample(t *testing.T) {
	r := BuildRating(4.5, true, MinRatingSample, "afterframe_community")
	if r.Score == nil || *r.Score != 4.5 {
		t.Fatalf("expected a real score at the minimum sample, got %v", r.Score)
	}
}

func TestBuildRatingNeverFabricatesWithNoRatings(t *testing.T) {
	r := BuildRating(0, false, 0, "afterframe_community")
	if r.Score != nil {
		t.Fatal("zero ratings must never produce a fabricated score")
	}
}

func TestValidTribeRejectsUnknownIDs(t *testing.T) {
	if !ValidTribe("horror_enthusiasts") {
		t.Fatal("a documented tribe was rejected")
	}
	if ValidTribe("made_up_tribe") {
		t.Fatal("an undocumented tribe ID was accepted")
	}
	if ValidTribe("") {
		t.Fatal("an empty tribe ID was accepted")
	}
}

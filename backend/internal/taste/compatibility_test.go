package taste

import "testing"

func TestNotEnoughDataNeverFabricatesAPercentage(t *testing.T) {
	r := BuildCompatibility(map[string]int{"Drama": 1}, map[string]int{"Drama": 1})
	if r.Overall != nil {
		t.Fatalf("one shared genre is too small a sample, got %v", *r.Overall)
	}
	if r.SampleSize != 1 {
		t.Fatalf("expected sample size 1, got %d", r.SampleSize)
	}
}

func TestOneSidedOpinionIsNotCountedAsDisagreement(t *testing.T) {
	// B has no opinion on Horror at all — that must not count as a conflict.
	r := BuildCompatibility(
		map[string]int{"Drama": 1, "Comedy": 1, "Horror": 1},
		map[string]int{"Drama": 1, "Comedy": 1},
	)
	for _, g := range r.Differing {
		if g == "Horror" {
			t.Fatal("a genre only one person opined on must not appear as a disagreement")
		}
	}
	if r.SampleSize != 2 {
		t.Fatalf("expected sample size 2 (Drama, Comedy only), got %d", r.SampleSize)
	}
}

func TestFullAgreementIsOneHundredPercent(t *testing.T) {
	a := map[string]int{"Drama": 2, "Horror": -3, "Comedy": 1}
	b := map[string]int{"Drama": 1, "Horror": -1, "Comedy": 2}
	r := BuildCompatibility(a, b)
	if r.Overall == nil || *r.Overall != 100 {
		t.Fatalf("expected 100%% agreement (same sign on every shared genre), got %v", r.Overall)
	}
	if len(r.Shared) != 2 { // Drama, Comedy
		t.Fatalf("expected 2 shared-favorite genres, got %+v", r.Shared)
	}
}

func TestFullDisagreementIsZeroPercent(t *testing.T) {
	a := map[string]int{"Horror": 5, "War": 2, "Western": 1}
	b := map[string]int{"Horror": -5, "War": -2, "Western": -1}
	r := BuildCompatibility(a, b)
	if r.Overall == nil || *r.Overall != 0 {
		t.Fatalf("expected 0%% agreement, got %v", r.Overall)
	}
	if len(r.Shared) != 0 {
		t.Fatalf("opposite-sign genres must never appear as shared favorites: %+v", r.Shared)
	}
	if len(r.Differing) != 3 {
		t.Fatalf("expected all 3 genres flagged as differing, got %+v", r.Differing)
	}
}

func TestMutualDislikeCountsAsAgreementNotASharedFavorite(t *testing.T) {
	r := BuildCompatibility(
		map[string]int{"Horror": -2, "Drama": 1, "Comedy": 1},
		map[string]int{"Horror": -3, "Drama": 1, "Comedy": 1},
	)
	if r.Overall == nil || *r.Overall != 100 {
		t.Fatalf("mutually disliking a genre is agreement, got %v", r.Overall)
	}
	for _, g := range r.Shared {
		if g == "Horror" {
			t.Fatal("a mutually DISLIKED genre must not be listed as a shared favorite")
		}
	}
}

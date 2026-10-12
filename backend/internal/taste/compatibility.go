package taste

import "sort"

// CompatibilityResult is deterministic and explainable: Overall is nil
// (never a fabricated number) until there's a real sample to back it.
type CompatibilityResult struct {
	Overall    *int     `json:"overall"` // percentage 0-100; nil means "not enough data"
	SampleSize int      `json:"sample_size"`
	Shared     []string `json:"shared"`    // genres both of you like
	Differing  []string `json:"differing"` // genres you disagree on
}

const minCompatibilitySample = 3

// BuildCompatibility compares two net genre-affinity maps (the same shape
// BuildTasteMap produces). Only genres where *both* people have an opinion
// count toward the sample — one person's silence is not disagreement.
func BuildCompatibility(a, b map[string]int) CompatibilityResult {
	genres := map[string]bool{}
	for g := range a {
		genres[g] = true
	}
	for g := range b {
		genres[g] = true
	}
	ordered := make([]string, 0, len(genres))
	for g := range genres {
		ordered = append(ordered, g)
	}
	sort.Strings(ordered)

	shared, differing := []string{}, []string{}
	agree, total := 0, 0
	for _, g := range ordered {
		av, bv := a[g], b[g]
		if av == 0 || bv == 0 {
			continue // one side has no opinion here — not part of the sample
		}
		total++
		switch {
		case av > 0 && bv > 0:
			shared = append(shared, g)
			agree++
		case av < 0 && bv < 0:
			agree++
		default:
			differing = append(differing, g)
		}
	}
	result := CompatibilityResult{SampleSize: total, Shared: shared, Differing: differing}
	if total >= minCompatibilitySample {
		pct := agree * 100 / total
		result.Overall = &pct
	}
	return result
}

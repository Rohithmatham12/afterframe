package service

import (
	"encoding/json"
	"strings"
	"testing"
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

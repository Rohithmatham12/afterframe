package taste

import "testing"

func TestThenNowUsesHistoryNotViewingCount(t *testing.T) {
	a, b := 3.0, 5.0
	events := []Opinion{{ID: "b", FilmID: 1, Rating: &b, CreatedAt: "2026-03-01"}, {ID: "a", FilmID: 1, Rating: &a, CreatedAt: "2025-01-01"}}
	c := Compare(events)
	if len(c) != 1 || *c[0].Change != 2 || c[0].Then.ID != "a" || c[0].Now.ID != "b" {
		t.Fatal(c)
	}
	if len(Compare(events[:1])) != 0 {
		t.Fatal("fabricated small-data insight")
	}
}

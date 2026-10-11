package memory

import (
	"testing"
	"time"
)

func TestWinterRecall(t *testing.T) {
	q := Interpret("what movie I watched last winter unsettled", "", "", time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC))
	if q.From != "2025-12-01" || q.To != "2026-02-28" || q.Text != "unsettled" {
		t.Fatalf("unexpected query %+v", q)
	}
}
func TestExplicitDatesWin(t *testing.T) {
	q := Interpret("college", "2024-01-01", "2024-12-31", time.Now())
	if q.From != "2024-01-01" || q.Text != "college" {
		t.Fatal(q)
	}
}

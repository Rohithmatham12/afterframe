package service

import (
	"context"
	"testing"
)

func TestImportRequestIDIsDeterministicNotRandom(t *testing.T) {
	a := importRequestID("user-1", 550, "2024-10-10")
	b := importRequestID("user-1", 550, "2024-10-10")
	if a != b {
		t.Fatal("re-importing the same (user, film, date) must derive the same request_id, or re-uploads will duplicate diary entries")
	}
	if importRequestID("user-2", 550, "2024-10-10") == a {
		t.Fatal("different users must never derive the same request_id")
	}
	if importRequestID("user-1", 551, "2024-10-10") == a {
		t.Fatal("different films must never derive the same request_id")
	}
	if importRequestID("user-1", 550, "2024-10-11") == a {
		t.Fatal("different dates must never derive the same request_id")
	}
}

func TestImportRejectsEmptyAndOversizedBatches(t *testing.T) {
	var s Service
	ctx := context.Background()
	if _, e := s.ImportDiary(ctx, "user", nil); e == nil {
		t.Fatal("accepted an empty import")
	}
	big := make([]ImportEntry, importEntryCap+1)
	if _, e := s.ImportDiary(ctx, "user", big); e == nil {
		t.Fatal("accepted a batch over the documented cap")
	}
}

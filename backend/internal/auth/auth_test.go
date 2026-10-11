package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVerifierFailsClosed(t *testing.T) {
	const id = "ec286fc3-c21f-46a6-8b1b-658715fabec7"
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("apikey") != "public-key" {
			t.Error("missing provider key")
		}
		switch r.Header.Get("Authorization") {
		case "Bearer valid":
			w.Write([]byte(`{"id":"` + id + `"}`))
		case "Bearer malformed":
			w.Write([]byte(`{"id":"not-a-uuid"}`))
		default:
			w.WriteHeader(401)
		}
	}))
	defer provider.Close()
	v := New(provider.URL, "public-key", true)
	for _, header := range []string{"", "Basic valid", "Bearer expired", "Bearer malformed"} {
		if _, err := v.Verify(context.Background(), header); err == nil {
			t.Fatalf("accepted %s", header)
		}
	}
	if got, err := v.Verify(context.Background(), "Bearer valid"); err != nil || got != id {
		t.Fatal(got, err)
	}
	provider.Close()
	if _, err := v.Verify(context.Background(), "Bearer valid"); err == nil {
		t.Fatal("provider outage accepted")
	}
}

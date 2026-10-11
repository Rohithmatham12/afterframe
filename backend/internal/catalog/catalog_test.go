package catalog

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProviderFailuresAndMissingMetadata(t *testing.T) {
	status := 429
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer server-only" {
			t.Error("missing credential")
		}
		w.WriteHeader(status)
		if status == 200 {
			w.Write([]byte(`{"id":1,"title":"Unknown"}`))
		}
	}))
	defer p.Close()
	c := New("server-only")
	c.Base = p.URL
	if _, err := c.Detail(context.Background(), 1); err == nil || !strings.Contains(err.Error(), "429") {
		t.Fatal("rate limit not surfaced", err)
	}
	status = 200
	film, err := c.Detail(context.Background(), 1)
	if err != nil || film.Title != "Unknown" || film.Poster != "" {
		t.Fatal(film, err)
	}
	p.Close()
	if _, err = c.Detail(context.Background(), 1); err == nil {
		t.Fatal("outage not surfaced")
	}
}

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

func TestAvailabilityIsRegionScopedAndSortedNeverPredictive(t *testing.T) {
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"results":{"US":{"flatrate":[{"provider_name":"Netflix"},{"provider_name":"Hulu"}]},"GB":{"flatrate":[{"provider_name":"BBC iPlayer"}]}}}`))
	}))
	defer p.Close()
	c := New("server-only")
	c.Base = p.URL
	a, err := c.Availability(context.Background(), 1, "us")
	if err != nil {
		t.Fatal(err)
	}
	if a.Source != "tmdb" {
		t.Fatalf("missing source attribution: %+v", a)
	}
	if len(a.Providers) != 2 || a.Providers[0] != "Hulu" || a.Providers[1] != "Netflix" {
		t.Fatalf("expected sorted [Hulu Netflix] for US, got %v", a.Providers)
	}
	gb, err := c.Availability(context.Background(), 1, "GB")
	if err != nil || len(gb.Providers) != 1 || gb.Providers[0] != "BBC iPlayer" {
		t.Fatalf("region scoping failed: %v %v", gb, err)
	}
	empty, err := c.Availability(context.Background(), 1, "FR")
	if err != nil || len(empty.Providers) != 0 {
		t.Fatalf("expected empty, not an error, for an unlisted region: %v %v", empty, err)
	}
}

// GAP 18: certification parsing prefers a theatrical (type 3) release when a
// region lists several, falls back to the first non-empty one otherwise, and
// never invents an entry for a region with no certification data at all.
func TestDetailParsesPerRegionCertifications(t *testing.T) {
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":1,"title":"Test Film","release_dates":{"results":[
			{"iso_3166_1":"US","release_dates":[{"certification":"","type":1},{"certification":"PG-13","type":3}]},
			{"iso_3166_1":"GB","release_dates":[{"certification":"12A","type":2}]},
			{"iso_3166_1":"FR","release_dates":[{"certification":"","type":3}]}
		]}}`))
	}))
	defer p.Close()
	c := New("server-only")
	c.Base = p.URL
	film, err := c.Detail(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if film.Certifications["US"] != "PG-13" {
		t.Fatalf("expected the theatrical (type 3) certification to win, got %q", film.Certifications["US"])
	}
	if film.Certifications["GB"] != "12A" {
		t.Fatalf("expected a fallback to the only available certification, got %q", film.Certifications["GB"])
	}
	if _, ok := film.Certifications["FR"]; ok {
		t.Fatal("a region with only an empty certification string must not produce an entry")
	}
	if _, ok := film.Certifications["DE"]; ok {
		t.Fatal("a region absent from the response must not produce an entry")
	}
}

// GAP 01: TMDB's own vote average/count, original language, and community
// reviews are parsed and kept entirely separate from anything Afterframe's
// own users write — never fabricated, never misattributed.
func TestDetailParsesTMDBVotesAndReviews(t *testing.T) {
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":1,"title":"Test Film","vote_average":8.4,"vote_count":12345,"original_language":"fr","reviews":{"results":[
			{"author":"CinemaFan22","content":"A real review from TMDB's community.","url":"https://www.themoviedb.org/review/abc","author_details":{"rating":9}},
			{"author":"NoRatingReviewer","content":"No numeric rating given.","url":"https://www.themoviedb.org/review/def","author_details":{"rating":null}}
		]}}`))
	}))
	defer p.Close()
	c := New("server-only")
	c.Base = p.URL
	film, err := c.Detail(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if film.VoteAverage != 8.4 || film.VoteCount != 12345 {
		t.Fatalf("expected TMDB's real vote average/count, got %v/%v", film.VoteAverage, film.VoteCount)
	}
	if film.OriginalLanguage != "fr" {
		t.Fatalf("expected original_language to be parsed, got %q", film.OriginalLanguage)
	}
	if len(film.TMDBReviews) != 2 {
		t.Fatalf("expected both real reviews parsed, got %d", len(film.TMDBReviews))
	}
	if film.TMDBReviews[0].Author != "CinemaFan22" || film.TMDBReviews[0].Rating == nil || *film.TMDBReviews[0].Rating != 9 {
		t.Fatalf("author/rating not mapped accurately: %+v", film.TMDBReviews[0])
	}
	if film.TMDBReviews[1].Rating != nil {
		t.Fatal("a review with no author rating must not get a fabricated one")
	}
}

func TestDetailHandlesZeroReviewsGracefully(t *testing.T) {
	p := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":1,"title":"No Reviews Yet"}`))
	}))
	defer p.Close()
	c := New("server-only")
	c.Base = p.URL
	film, err := c.Detail(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if film.TMDBReviews == nil || len(film.TMDBReviews) != 0 {
		t.Fatalf("zero reviews must be an empty slice, not nil or fabricated: %+v", film.TMDBReviews)
	}
}

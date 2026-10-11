package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeRejectsAmbiguousBodies(t *testing.T) {
	for _, body := range []string{`{"name":"ok"} {"name":"other"}`, `{"name":"ok","admin":true}`, `{"name":"` + strings.Repeat("x", 100) + `"}`, `null trailing`} {
		var out struct {
			Name string `json:"name"`
		}
		if decode(httptest.NewRecorder(), httptest.NewRequest("POST", "/", strings.NewReader(body)), &out, 64) == nil {
			t.Errorf("accepted invalid body %q", body)
		}
	}
	var out struct {
		Name string `json:"name"`
	}
	if err := decode(httptest.NewRecorder(), httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"ok"}`)), &out, 64); err != nil || out.Name != "ok" {
		t.Fatal(err)
	}
}
func TestRateLimitSeparatesAccounts(t *testing.T) {
	h := limits(0, 2, func(r *http.Request) string { return r.Header.Get("Test-User") })(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	for i, user := range []string{"a", "a", "a", "b"} {
		r := httptest.NewRequest("GET", "/", nil)
		r.Header.Set("Test-User", user)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		want := 204
		if i == 2 {
			want = 429
		}
		if w.Code != want {
			t.Fatalf("request %d: got %d want %d", i, w.Code, want)
		}
	}
}

// Package auth validates bearer access tokens with Supabase Auth's authoritative user endpoint.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"net/http"
	"strings"
	"time"
)

type Verifier struct {
	URL, Key, AdminKey string
	Client             *http.Client
}

func New(url, key string, direct bool) *Verifier {
	if !direct {
		url = strings.TrimRight(url, "/") + "/auth/v1"
	}
	return &Verifier{URL: strings.TrimRight(url, "/"), Key: key, Client: &http.Client{Timeout: 8 * time.Second}}
}
func (v *Verifier) Verify(ctx context.Context, header string) (string, error) {
	if !strings.HasPrefix(header, "Bearer ") || len(header) > 8192 {
		return "", errors.New("sign in required")
	}
	req, e := http.NewRequestWithContext(ctx, "GET", v.URL+"/user", nil)
	if e != nil {
		return "", e
	}
	req.Header.Set("Authorization", header)
	req.Header.Set("apikey", v.Key)
	res, e := v.Client.Do(req)
	if e != nil {
		return "", errors.New("authentication unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", errors.New("session expired or invalid")
	}
	var u struct {
		ID string `json:"id"`
	}
	if json.NewDecoder(res.Body).Decode(&u) != nil {
		return "", errors.New("invalid authentication response")
	}
	if _, e = uuid.Parse(u.ID); e != nil {
		return "", e
	}
	return u.ID, nil
}

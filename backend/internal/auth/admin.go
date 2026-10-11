package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

func LocalServiceToken(secret string) string {
	if secret == "" {
		return ""
	}
	enc := base64.RawURLEncoding.EncodeToString
	header := enc([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{"role": "service_role", "aud": "authenticated", "exp": time.Now().Add(24 * time.Hour).Unix()})
	payload := header + "." + enc(claims)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return payload + "." + enc(mac.Sum(nil))
}
func (v *Verifier) Delete(ctx context.Context, id string) error {
	if v.AdminKey == "" {
		return errors.New("account erasure requires server SUPABASE_SECRET_KEY configuration")
	}
	req, e := http.NewRequestWithContext(ctx, "DELETE", v.URL+"/admin/users/"+id, nil)
	if e != nil {
		return e
	}
	req.Header.Set("apikey", v.AdminKey)
	req.Header.Set("Authorization", "Bearer "+v.AdminKey)
	res, e := v.Client.Do(req)
	if e != nil {
		return errors.New("authentication provider unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 && res.StatusCode != 204 && res.StatusCode != 404 {
		return errors.New("authentication provider could not erase account")
	}
	return nil
}

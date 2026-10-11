// verify-hosted creates and deletes ONLY its own disposable hosted Auth user.
// Application data is written exclusively to the loopback local test database.
package main

import (
	"afterframe/internal/auth"
	"afterframe/internal/catalog"
	"afterframe/internal/httpapi"
	"afterframe/internal/service"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Println("FAIL:", err)
		os.Exit(1)
	}
}
func run() error {
	hosted, e := godotenv.Read("../.env")
	if e != nil {
		return fmt.Errorf("root environment unavailable")
	}
	local, e := godotenv.Read("../.env.local")
	if e != nil {
		return fmt.Errorf("local environment unavailable")
	}
	dbURL, _ := url.Parse(local["DATABASE_URL"])
	if dbURL == nil || dbURL.Hostname() != "127.0.0.1" {
		return fmt.Errorf("refusing non-loopback test database")
	}
	if hosted["SUPABASE_SECRET_KEY"] == "" {
		return fmt.Errorf("populate root .env SUPABASE_SECRET_KEY")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	pool, e := pgxpool.New(ctx, local["DATABASE_URL"])
	if e != nil {
		return fmt.Errorf("local database configuration failed")
	}
	admin := pool
	name := "afterframe_verify_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, e = admin.Exec(ctx, "CREATE DATABASE "+name); e != nil {
		admin.Close()
		return fmt.Errorf("isolated local database creation failed")
	}
	cfg, e := pgxpool.ParseConfig(local["DATABASE_URL"])
	if e != nil {
		return fmt.Errorf("local config parse failed")
	}
	cfg.ConnConfig.Database = name
	pool, e = pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		return fmt.Errorf("isolated database unavailable")
	}
	defer func() {
		pool.Close()
		cleanup, c := context.WithTimeout(context.Background(), 10*time.Second)
		defer c()
		admin.Exec(cleanup, "DROP DATABASE "+name+" WITH (FORCE)")
		admin.Close()
	}()
	files, _ := filepath.Glob("migrations/*.up.sql")
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("migration read failed")
		}
		if _, err = pool.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("isolated migration failed")
		}
	}

	verifier := auth.New(hosted["SUPABASE_URL"], hosted["SUPABASE_PUBLISHABLE_KEY"], false)
	verifier.AdminKey = hosted["SUPABASE_SECRET_KEY"]
	client := &http.Client{Timeout: 15 * time.Second}
	request := func(method, endpoint, key, token string, body any) (int, map[string]any, error) {
		b, _ := json.Marshal(body)
		req, e := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(b))
		if e != nil {
			return 0, nil, fmt.Errorf("invalid endpoint")
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("apikey", key)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		res, e := client.Do(req)
		if e != nil {
			return 0, nil, fmt.Errorf("HTTP request failed")
		}
		defer res.Body.Close()
		var out map[string]any
		json.NewDecoder(res.Body).Decode(&out)
		return res.StatusCode, out, nil
	}
	email := "afterframe-verification-" + uuid.NewString() + "@example.invalid"
	password := uuid.NewString() + "Aa!9"
	status, user, e := request("POST", verifier.URL+"/admin/users", verifier.AdminKey, verifier.AdminKey, map[string]any{"email": email, "password": password, "email_confirm": true, "user_metadata": map[string]string{"purpose": "afterframe-disposable-verification"}})
	if e != nil || status != 200 {
		return fmt.Errorf("disposable Auth creation status %d", status)
	}
	id, ok := user["id"].(string)
	if !ok {
		return fmt.Errorf("Auth returned no user identifier")
	}
	s := &service.Service{Pool: pool, Catalog: catalog.New(hosted["TMDB_READ_ACCESS_TOKEN"])}
	defer func() {
		cleanup, c := context.WithTimeout(context.Background(), 20*time.Second)
		defer c()
		if err := verifier.Delete(cleanup, id); err != nil {
			fmt.Println("CLEANUP REQUIRED: disposable hosted Auth deletion failed")
		}
		s.EraseAccount(cleanup, id)
	}()
	fmt.Println("PASS: disposable hosted Auth account created (no email sent)")
	status, session, e := request("POST", verifier.URL+"/token?grant_type=password", verifier.Key, "", map[string]string{"email": email, "password": password})
	token, _ := session["access_token"].(string)
	if e != nil || status != 200 || token == "" {
		return fmt.Errorf("disposable login status %d", status)
	}
	api := httptest.NewServer(httpapi.Handler(s, verifier, []string{"http://127.0.0.1:3000"}))
	defer api.Close()
	status, _, e = request("POST", api.URL+"/v1/diary", "", token, map[string]any{"film_id": 550, "watched_on": "2024-10-10", "rating": 4, "request_id": uuid.NewString(), "scene": "Disposable erasure verification", "private": true})
	if e != nil || status != 200 {
		return fmt.Errorf("real Go diary mutation status %d", status)
	}
	fmt.Println("PASS: hosted access token validated by Go; private test data saved only locally")
	status, _, e = request("POST", api.URL+"/v1/account-delete", "", token, map[string]string{"confirmation": "DELETE"})
	if e != nil || status != 200 {
		return fmt.Errorf("real Go erasure status %d", status)
	}
	var remains int
	if e = pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM profiles WHERE id=$1)+(SELECT count(*) FROM viewings WHERE user_id=$1)+(SELECT count(*) FROM memories WHERE user_id=$1)+(SELECT count(*) FROM opinions WHERE user_id=$1)", id).Scan(&remains); e != nil || remains != 0 {
		return fmt.Errorf("local erasure integrity failed")
	}
	var erased bool
	if e = pool.QueryRow(ctx, "SELECT auth_deleted FROM deleted_accounts WHERE user_id=$1", id).Scan(&erased); e != nil || !erased {
		return fmt.Errorf("hosted erasure retry remains pending")
	}
	status, _, _ = request("GET", verifier.URL+"/admin/users/"+id, verifier.AdminKey, verifier.AdminKey, nil)
	if status != 404 {
		return fmt.Errorf("hosted account absence status %d", status)
	}
	status, _, _ = request("POST", verifier.URL+"/token?grant_type=password", verifier.Key, "", map[string]string{"email": email, "password": password})
	if status == 200 {
		return fmt.Errorf("deleted user can still sign in")
	}
	status, _, _ = request("GET", api.URL+"/v1/me", "", token, nil)
	if status != 401 && status != 404 {
		return fmt.Errorf("deleted user still accesses API: %d", status)
	}
	fmt.Println("PASS: Go erased local personal data and hosted Auth account; login and stale-token access rejected")
	return nil
}

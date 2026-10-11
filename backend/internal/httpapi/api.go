package httpapi

import (
	"afterframe/internal/auth"
	"afterframe/internal/service"
	"context"
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/time/rate"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type userKey struct{}

func User(r *http.Request) string { u, _ := r.Context().Value(userKey{}).(string); return u }
func Handler(s *service.Service, a *auth.Verifier, origins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{AllowedOrigins: origins, AllowedMethods: []string{"GET", "POST", "DELETE", "OPTIONS"}, AllowedHeaders: []string{"Authorization", "Content-Type"}, MaxAge: 300}))
	r.Use(limits(30, 300, func(r *http.Request) string { ip, _, _ := net.SplitHostPort(r.RemoteAddr); return ip }))
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Referrer-Policy", "no-referrer")
			next.ServeHTTP(w, r)
		})
	})
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		if e := s.Pool.Ping(r.Context()); e != nil {
			reply(w, nil, e)
			return
		}
		reply(w, map[string]string{"status": "ok"}, nil)
	})
	r.Get("/v1/films", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		page := int(service.Int(q.Get("page")))
		if page < 1 {
			page = 1
		}
		if page > 500 || len(q.Get("q")) > 200 {
			reply(w, nil, service.ErrInvalid)
			return
		}
		v, e := s.Catalog.Search(r.Context(), q.Get("q"), q.Get("section"), page)
		reply(w, v, e)
	})
	r.Get("/v1/films/{id}", func(w http.ResponseWriter, r *http.Request) {
		v, e := s.Film(r.Context(), service.Int(chi.URLParam(r, "id")))
		reply(w, v, e)
	})
	r.Group(func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				u, e := a.Verify(r.Context(), r.Header.Get("Authorization"))
				if e != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(401)
					json.NewEncoder(w).Encode(map[string]string{"error": "Sign in again to continue"})
					return
				}
				if e = s.Ensure(r.Context(), u); e != nil {
					reply(w, nil, e)
					return
				}
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, u)))
			})
		})
		r.Use(limits(10, 100, User))
		r.Post("/v1/avatar", func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 256*1024)
			data, e := io.ReadAll(r.Body)
			if e != nil {
				reply(w, nil, service.ErrInvalid)
				return
			}
			reply(w, nil, s.Avatar(r.Context(), User(r), data))
		})
		r.Post("/v1/account-delete", func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				Confirmation string `json:"confirmation"`
			}
			if decode(w, r, &in, 1000) != nil || in.Confirmation != "DELETE" {
				reply(w, nil, service.ErrInvalid)
				return
			}
			if a.AdminKey == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(503)
				json.NewEncoder(w).Encode(map[string]string{"error": "Account deletion needs server SUPABASE_SECRET_KEY configuration. Your data has not been changed."})
				return
			}
			if e := s.EraseAccount(r.Context(), User(r)); e != nil {
				reply(w, nil, e)
				return
			}
			s.RetryErasures(r.Context(), a.Delete)
			reply(w, map[string]string{"status": "Account data erased. Authentication erasure will retry automatically if the provider is unavailable."}, nil)
		})
		r.Get("/v1/comments/{id}", func(w http.ResponseWriter, r *http.Request) {
			v, e := s.Comments(r.Context(), User(r), chi.URLParam(r, "id"))
			reply(w, v, e)
		})
		r.Get("/v1/{area}", func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			v, e := s.Read(r.Context(), User(r), chi.URLParam(r, "area"), service.Filter{ObjectID: q.Get("id"), TargetID: q.Get("user_id"), Query: q.Get("q"), Emotion: q.Get("emotion"), From: q.Get("from"), To: q.Get("to"), Month: q.Get("month"), FilmID: service.Int(q.Get("film_id")), Offset: int32(service.Int(q.Get("offset"))), Mine: q.Get("mine") == "true"})
			reply(w, v, e)
		})
		r.Post("/v1/{area}", func(w http.ResponseWriter, r *http.Request) {
			var in service.Input
			if e := decode(w, r, &in, 65536); e != nil {
				reply(w, nil, service.ErrInvalid)
				return
			}
			v, e := s.Write(r.Context(), User(r), chi.URLParam(r, "area"), in)
			reply(w, v, e)
		})
		r.Delete("/v1/{area}/{id}", func(w http.ResponseWriter, r *http.Request) {
			v, e := s.Delete(r.Context(), User(r), chi.URLParam(r, "area"), chi.URLParam(r, "id"))
			reply(w, v, e)
		})
	})
	return r
}

// decode accepts exactly one JSON value and rejects unknown fields and oversized input.
func decode(w http.ResponseWriter, r *http.Request, out any, limit int64) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		return err
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return service.ErrInvalid
	}
	return nil
}
func reply(w http.ResponseWriter, v any, e error) {
	w.Header().Set("Content-Type", "application/json")
	if e != nil {
		status := 500
		msg := "Unable to complete request"
		var pe *pgconn.PgError
		switch {
		case errors.Is(e, service.ErrInvalid):
			status = 400
			msg = e.Error()
		case errors.Is(e, pgx.ErrNoRows) || errors.Is(e, service.ErrForbidden):
			status = 404
			msg = "Not found or not permitted"
		case errors.As(e, &pe) && (pe.Code == "23505" || pe.Code == "23514" || pe.Code == "23503"):
			status = 409
			msg = "This change conflicts with an existing record or valid value"
		case strings.Contains(e.Error(), "provider"):
			status = 502
			msg = e.Error()
		}
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]string{"error": msg})
		return
	}
	json.NewEncoder(w).Encode(v)
}
func limits(perSecond rate.Limit, burst int, key func(*http.Request) string) func(http.Handler) http.Handler {
	type entry struct {
		lim  *rate.Limiter
		last time.Time
	}
	var mu sync.Mutex
	clients := map[string]entry{}
	overflow := rate.NewLimiter(perSecond, burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := key(r)
			mu.Lock()
			now := time.Now()
			if len(clients) > 10000 {
				for k, e := range clients {
					if now.Sub(e.last) > time.Minute*5 {
						delete(clients, k)
					}
				}
			}
			e, ok := clients[ip]
			if !ok {
				if len(clients) >= 10000 {
					e.lim = overflow
				} else {
					e.lim = rate.NewLimiter(perSecond, burst)
				}
			}
			e.last = now
			if ok || len(clients) < 10000 {
				clients[ip] = e
			}
			allowed := e.lim.Allow()
			mu.Unlock()
			if !allowed {
				w.Header().Set("Retry-After", "1")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{"error": "Too many requests. Try again shortly."})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

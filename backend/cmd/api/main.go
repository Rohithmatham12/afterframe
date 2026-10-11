package main

import (
	"afterframe/internal/auth"
	"afterframe/internal/catalog"
	"afterframe/internal/httpapi"
	"afterframe/internal/service"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	godotenv.Load("../.env")
	if os.Getenv("AFTERFRAME_LOCAL") == "1" {
		godotenv.Overload("../.env.local")
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	pool, e := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if e != nil {
		log.Fatal("Invalid database configuration")
	}
	defer pool.Close()
	if e = pool.Ping(ctx); e != nil {
		log.Fatal("Database unavailable")
	}
	s := &service.Service{Pool: pool, Catalog: catalog.New(os.Getenv("TMDB_READ_ACCESS_TOKEN"))}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	origins := os.Getenv("API_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000,http://127.0.0.1:3000"
	}
	verifier := auth.New(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_PUBLISHABLE_KEY"), os.Getenv("AUTH_DIRECT") == "true")
	verifier.AdminKey = os.Getenv("SUPABASE_SECRET_KEY")
	if os.Getenv("AFTERFRAME_LOCAL") == "1" {
		verifier.AdminKey = auth.LocalServiceToken(os.Getenv("LOCAL_JWT_SECRET"))
	}
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.RetryErasures(ctx, verifier.Delete)
			}
		}
	}()
	srv := &http.Server{Addr: ":" + port, Handler: httpapi.Handler(s, verifier, strings.Split(origins, ",")), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, c := context.WithTimeout(context.Background(), 10*time.Second)
		defer c()
		srv.Shutdown(shutdown)
	}()
	log.Println("Afterframe API listening on", port)
	if e = srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}

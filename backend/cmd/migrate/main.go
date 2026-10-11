package main

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"os"
	"path/filepath"
	"sort"
)

func main() {
	godotenv.Load("../.env")
	if os.Getenv("AFTERFRAME_LOCAL") == "1" {
		godotenv.Overload("../.env.local")
	}
	ctx := context.Background()
	c, e := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	if e != nil {
		panic("database connection failed")
	}
	defer c.Close(ctx)
	_, e = c.Exec(ctx, "CREATE TABLE IF NOT EXISTS afterframe_schema_migrations(version text PRIMARY KEY, applied_at timestamptz DEFAULT now())")
	if e != nil {
		panic(e)
	}
	files, _ := filepath.Glob("migrations/*.up.sql")
	sort.Strings(files)
	for _, p := range files {
		var exists bool
		c.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM afterframe_schema_migrations WHERE version=$1)", p).Scan(&exists)
		if exists {
			continue
		}
		b, _ := os.ReadFile(p)
		tx, e := c.Begin(ctx)
		if e != nil {
			panic(e)
		}
		if _, e = tx.Exec(ctx, string(b)); e != nil {
			tx.Rollback(ctx)
			panic(e)
		}
		if _, e = tx.Exec(ctx, "INSERT INTO afterframe_schema_migrations(version) VALUES($1)", p); e != nil {
			panic(e)
		}
		if e = tx.Commit(ctx); e != nil {
			panic(e)
		}
		fmt.Println("Applied", p)
	}
}

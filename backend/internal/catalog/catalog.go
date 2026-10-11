package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Film struct {
	ID       int64    `json:"id"`
	Title    string   `json:"title"`
	Year     string   `json:"year"`
	Poster   string   `json:"poster"`
	Backdrop string   `json:"backdrop"`
	Overview string   `json:"overview"`
	Genres   []string `json:"genres"`
	Director string   `json:"director"`
	Runtime  int      `json:"runtime"`
}
type movie struct {
	ID       int64                   `json:"id"`
	Title    string                  `json:"title"`
	Date     string                  `json:"release_date"`
	Poster   string                  `json:"poster_path"`
	Backdrop string                  `json:"backdrop_path"`
	Overview string                  `json:"overview"`
	Genres   []struct{ Name string } `json:"genres"`
	Runtime  int
	Credits  struct{ Crew []struct{ Name, Job string } }
}

func (m movie) film() Film {
	year := m.Date
	if len(year) > 4 {
		year = year[:4]
	}
	f := Film{ID: m.ID, Title: m.Title, Year: year, Poster: m.Poster, Backdrop: m.Backdrop, Overview: m.Overview, Genres: []string{}, Runtime: m.Runtime}
	for _, g := range m.Genres {
		f.Genres = append(f.Genres, g.Name)
	}
	for _, c := range m.Credits.Crew {
		if c.Job == "Director" {
			f.Director = c.Name
			break
		}
	}
	return f
}

type Client struct {
	Token, Base string
	HTTP        *http.Client
}

func New(token string) *Client {
	return &Client{token, "https://api.themoviedb.org/3", &http.Client{Timeout: 10 * time.Second}}
}
func (c *Client) get(ctx context.Context, path string, out any) error {
	if c.Token == "" {
		return errors.New("TMDB configuration required")
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", c.Base+path, nil)
	req.Header.Set("Authorization", "Bearer "+c.Token)
	res, e := c.HTTP.Do(req)
	if e != nil {
		return errors.New("movie provider unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("movie provider returned %d; please retry", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(out)
}
func (c *Client) Search(ctx context.Context, q, section string, page int) ([]Film, error) {
	path := "/movie/popular?page=" + strconv.Itoa(page)
	if section == "trending" {
		path = "/trending/movie/week?page=" + strconv.Itoa(page)
	}
	if section == "recent" {
		path = "/movie/now_playing?page=" + strconv.Itoa(page)
	}
	if q != "" {
		path = "/search/movie?include_adult=false&query=" + url.QueryEscape(q) + "&page=" + strconv.Itoa(page)
	}
	var r struct{ Results []movie }
	e := c.get(ctx, path, &r)
	films := []Film{}
	for _, m := range r.Results {
		films = append(films, m.film())
	}
	return films, e
}
func (c *Client) Detail(ctx context.Context, id int64) (Film, error) {
	var m movie
	e := c.get(ctx, "/movie/"+strconv.FormatInt(id, 10)+"?append_to_response=credits", &m)
	return m.film(), e
}

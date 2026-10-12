package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Credit struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type Film struct {
	Cast     []Credit `json:"cast_members"`
	Crew     []Credit `json:"crew"`
	ID       int64    `json:"id"`
	Title    string   `json:"title"`
	Year     string   `json:"year"`
	Poster   string   `json:"poster"`
	Backdrop string   `json:"backdrop"`
	Overview string   `json:"overview"`
	Genres   []string `json:"genres"`
	Director string   `json:"director"`
	Runtime  int      `json:"runtime"`
	// Certifications is a region->rating-string snapshot (e.g. "US":"PG-13"),
	// sourced from TMDB's release_dates data. Coverage is genuinely
	// incomplete for many films/regions — a missing entry means "unknown",
	// never "unrated"/"safe"; GAP 18's Family Mode treats unknown
	// conservatively (excluded), not permissively.
	Certifications map[string]string `json:"certifications"`
	// GAP 01: TMDB's own aggregate rating and community reviews, kept
	// strictly separate from Afterframe's native reviews — always labelled
	// as TMDB's, never presented as if Afterframe users wrote them.
	VoteAverage      float64      `json:"vote_average"`
	VoteCount        int          `json:"vote_count"`
	OriginalLanguage string       `json:"original_language"`
	TMDBReviews      []TMDBReview `json:"tmdb_reviews"`
}

// TMDBReview is a real review TMDB's own community left on a film — never
// fabricated, never attributed to an Afterframe account.
type TMDBReview struct {
	Author  string   `json:"author"`
	Content string   `json:"content"`
	Rating  *float64 `json:"rating"`
	URL     string   `json:"url"`
}

type movie struct {
	ID               int64                   `json:"id"`
	Title            string                  `json:"title"`
	Date             string                  `json:"release_date"`
	Poster           string                  `json:"poster_path"`
	Backdrop         string                  `json:"backdrop_path"`
	Overview         string                  `json:"overview"`
	Genres []struct{ Name string } `json:"genres"`
	// GenreIDs is what TMDB's list/discover endpoints send instead of full
	// Genres objects (only the single-movie Detail call returns names). Used
	// as a fallback in film() so a Discover/search card still gets a real
	// genre, not an empty list, without an extra per-card TMDB request.
	GenreIDs         []int `json:"genre_ids"`
	Runtime          int
	VoteAverage      float64 `json:"vote_average"`
	VoteCount        int     `json:"vote_count"`
	OriginalLanguage string  `json:"original_language"`
	Credits          struct {
		Cast []struct{ Name, Character string }
		Crew []struct{ Name, Job string }
	}
	ReleaseDates struct {
		Results []struct {
			Region  string `json:"iso_3166_1"`
			Entries []struct {
				Certification string `json:"certification"`
				Type          int    `json:"type"`
			} `json:"release_dates"`
		} `json:"results"`
	} `json:"release_dates"`
	Reviews struct {
		Results []struct {
			Author        string `json:"author"`
			Content       string `json:"content"`
			URL           string `json:"url"`
			AuthorDetails struct {
				Rating *float64 `json:"rating"`
			} `json:"author_details"`
		} `json:"results"`
	} `json:"reviews"`
}

func (m movie) film() Film {
	year := m.Date
	if len(year) > 4 {
		year = year[:4]
	}
	f := Film{
		Cast: []Credit{}, Crew: []Credit{}, ID: m.ID, Title: m.Title, Year: year,
		Poster: m.Poster, Backdrop: m.Backdrop, Overview: m.Overview, Genres: []string{},
		Runtime: m.Runtime, Certifications: map[string]string{},
		VoteAverage: m.VoteAverage, VoteCount: m.VoteCount, OriginalLanguage: m.OriginalLanguage,
		TMDBReviews: []TMDBReview{},
	}
	for _, r := range m.Reviews.Results {
		content := r.Content
		if len(content) > 2000 {
			content = content[:2000] + "…"
		}
		f.TMDBReviews = append(f.TMDBReviews, TMDBReview{
			Author: r.Author, Content: content, Rating: r.AuthorDetails.Rating, URL: r.URL,
		})
	}
	for _, r := range m.ReleaseDates.Results {
		// Prefer a theatrical (type 3) certification when a region lists
		// several release types; fall back to the first non-empty one.
		best := ""
		for _, e := range r.Entries {
			if e.Certification == "" {
				continue
			}
			if best == "" {
				best = e.Certification
			}
			if e.Type == 3 {
				best = e.Certification
				break
			}
		}
		if best != "" {
			f.Certifications[r.Region] = best
		}
	}
	for _, g := range m.Genres {
		f.Genres = append(f.Genres, g.Name)
	}
	if len(f.Genres) == 0 {
		for _, id := range m.GenreIDs {
			if name, ok := genreNameByID[id]; ok {
				f.Genres = append(f.Genres, name)
			}
		}
	}
	for _, c := range m.Credits.Cast {
		f.Cast = append(f.Cast, Credit{Name: c.Name, Role: c.Character})
	}
	for _, c := range m.Credits.Crew {
		f.Crew = append(f.Crew, Credit{Name: c.Name, Role: c.Job})
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
// GenreID is TMDB's official movie genre id for each name in Afterframe's
// fixed genre vocabulary (frontend/lib/vocab.ts GENRES). Used to pull
// genre-targeted candidates for Tonight Mode so a stated preference (e.g.
// Romance) can actually be matched by something in the candidate pool,
// instead of only drawing from generic popular/trending charts that may
// contain little or nothing in that genre on a given day.
var GenreID = map[string]int{
	"Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
	"Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
	"Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
	"Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
	"Thriller": 53, "War": 10752, "Western": 37,
}

// GenreOrder is GenreID's keys in a fixed order, so picking a "top liked
// genre" from a tied score is deterministic rather than map-iteration luck.
var GenreOrder = []string{
	"Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
	"Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
	"Romance", "Science Fiction", "Thriller", "War", "Western",
}

// genreNameByID is GenreID inverted — derived, not hand-duplicated, so the
// two can never drift out of sync.
var genreNameByID = func() map[int]string {
	m := make(map[int]string, len(GenreID))
	for name, id := range GenreID {
		m[id] = name
	}
	return m
}()

// SearchByGenre calls TMDB's discover endpoint for popularity-ordered films
// in a single genre — the targeted counterpart to Search's generic
// popular/trending charts.
func (c *Client) SearchByGenre(ctx context.Context, genreID int, page int) ([]Film, error) {
	path := "/discover/movie?sort_by=popularity.desc&with_genres=" + strconv.Itoa(genreID) + "&page=" + strconv.Itoa(page)
	var r struct{ Results []movie }
	e := c.get(ctx, path, &r)
	films := []Film{}
	for _, m := range r.Results {
		films = append(films, m.film())
	}
	return films, e
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
	e := c.get(ctx, "/movie/"+strconv.FormatInt(id, 10)+"?append_to_response=credits,release_dates,reviews", &m)
	return m.film(), e
}

// Availability is a point-in-time observation, never a predicted future date.
// Source is always attributed; callers must show it alongside provider names.
type Availability struct {
	Providers []string
	Source    string
}

// AvailabilityProvider lets a future verified-expiration provider (a paid
// partner feed, say) slot in without the watchlist or alert logic changing:
// anything implementing this interface can replace or sit alongside TMDB.
type AvailabilityProvider interface {
	Availability(ctx context.Context, filmID int64, region string) (Availability, error)
}

// Showtime is a single verified theatrical listing. GAP 23 requires any
// live showtime integration to come from a provider with appropriate API
// rights — no $0 provider currently qualifies (ticketing APIs like
// Fandango/AMC are paid partnerships; scraping a restricted ticketing site
// is explicitly forbidden by the spec), so this interface exists as the
// seam a future legitimate integration plugs into. Nothing in this codebase
// implements it today; group planning (service.go) runs entirely on
// manually agreed-upon plan slots instead, and is honest about that in its
// own responses rather than inventing showtimes.
type Showtime struct {
	Theater string
	Time    string // ISO 8601; never inferred or estimated
	Source  string
}
type ShowtimeProvider interface {
	Showtimes(ctx context.Context, filmID int64, region string) ([]Showtime, error)
}

// Availability calls TMDB's watch/providers endpoint, which is itself sourced
// from JustWatch. TMDB's terms require crediting JustWatch wherever this data
// is shown; see the attribution rendered in the frontend availability view.
func (c *Client) Availability(ctx context.Context, filmID int64, region string) (Availability, error) {
	var r struct {
		Results map[string]struct {
			Flatrate []struct {
				ProviderName string `json:"provider_name"`
			} `json:"flatrate"`
		} `json:"results"`
	}
	if e := c.get(ctx, "/movie/"+strconv.FormatInt(filmID, 10)+"/watch/providers", &r); e != nil {
		return Availability{}, e
	}
	names := []string{}
	for _, p := range r.Results[strings.ToUpper(region)].Flatrate {
		names = append(names, p.ProviderName)
	}
	sort.Strings(names)
	return Availability{Providers: names, Source: "tmdb"}, nil
}

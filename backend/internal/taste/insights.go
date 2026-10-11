package taste

import (
	"encoding/json"
	"sort"
)

type Opinion struct {
 UserID string `json:"user_id"`
 ViewingID *string `json:"viewing_id"`
 Kind string `json:"kind"`
	ID         string          `json:"id"`
	FilmID     int64           `json:"film_id"`
	Rating     *float64        `json:"rating"`
	Reflection string          `json:"reflection"`
	CreatedAt  string          `json:"created_at"`
	Film       json.RawMessage `json:"film"`
}
type Comparison struct {
	FilmID int64           `json:"film_id"`
	Film   json.RawMessage `json:"film"`
	Then   Opinion         `json:"then"`
	Now    Opinion         `json:"now"`
	Change *float64        `json:"change"`
	Count  int             `json:"count"`
}

func Compare(events []Opinion) []Comparison {
	groups := map[int64][]Opinion{}
	for _, e := range events {
		groups[e.FilmID] = append(groups[e.FilmID], e)
	}
	out := []Comparison{}
	for id, g := range groups {
		if len(g) < 2 {
			continue
		}
		sort.SliceStable(g, func(i, j int) bool {
			if g[i].CreatedAt == g[j].CreatedAt {
				return g[i].ID < g[j].ID
			}
			return g[i].CreatedAt < g[j].CreatedAt
		})
		first, last := g[0], g[len(g)-1]
		c := Comparison{FilmID: id, Film: last.Film, Then: first, Now: last, Count: len(g)}
		if first.Rating != nil && last.Rating != nil {
			delta := *last.Rating - *first.Rating
			c.Change = &delta
		}
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Now.CreatedAt > out[j].Now.CreatedAt })
	return out
}

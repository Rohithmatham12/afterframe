package taste

import (
	"encoding/json"
	"sort"
)

// QuizResponse mirrors one row of taste_quiz_responses joined with its film.
type QuizResponse struct {
	FilmID   int64           `json:"film_id"`
	Response string          `json:"response"`
	Film     json.RawMessage `json:"film"`
}

type GenreAffinity struct {
	Genre    string `json:"genre"`
	Score    int    `json:"score"`
	Liked    int    `json:"liked"`
	Disliked int    `json:"disliked"`
}

// TasteMap is an honest summary, not a prediction: Confidence reflects how
// little data backs it, and "unseen" responses never contribute a score in
// either direction — the one invariant this whole feature exists to protect.
type TasteMap struct {
	Genres     []GenreAffinity `json:"genres"`
	Liked      int             `json:"liked"`
	Disliked   int             `json:"disliked"`
	Unseen     int             `json:"unseen"`
	Confidence string          `json:"confidence"`
}

func BuildTasteMap(responses []QuizResponse) TasteMap {
	scores := map[string]*GenreAffinity{}
	m := TasteMap{}
	for _, r := range responses {
		switch r.Response {
		case "like":
			m.Liked++
		case "dislike":
			m.Disliked++
		default:
			m.Unseen++
			continue // never scored — "haven't seen" is not a dislike
		}
		var f struct {
			Genres []string `json:"genres"`
		}
		json.Unmarshal(r.Film, &f)
		for _, g := range f.Genres {
			a, ok := scores[g]
			if !ok {
				a = &GenreAffinity{Genre: g}
				scores[g] = a
			}
			if r.Response == "like" {
				a.Liked++
				a.Score++
			} else {
				a.Disliked++
				a.Score--
			}
		}
	}
	for _, a := range scores {
		m.Genres = append(m.Genres, *a)
	}
	sort.Slice(m.Genres, func(i, j int) bool {
		if m.Genres[i].Score != m.Genres[j].Score {
			return m.Genres[i].Score > m.Genres[j].Score
		}
		return m.Genres[i].Genre < m.Genres[j].Genre
	})
	answered := m.Liked + m.Disliked
	switch {
	case answered < 3:
		m.Confidence = "low"
	case answered < 8:
		m.Confidence = "medium"
	default:
		m.Confidence = "high"
	}
	return m
}

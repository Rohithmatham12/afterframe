package taste

import (
	"encoding/json"
	"testing"
)

func resp(filmID int64, response string, genres ...string) QuizResponse {
	b, _ := json.Marshal(struct {
		Genres []string `json:"genres"`
	}{genres})
	return QuizResponse{FilmID: filmID, Response: response, Film: b}
}

func TestUnseenNeverScoresEitherDirection(t *testing.T) {
	m := BuildTasteMap([]QuizResponse{
		resp(1, "like", "Drama"),
		resp(2, "unseen", "Drama"),
		resp(3, "unseen", "Horror"),
	})
	if m.Unseen != 2 || m.Liked != 1 || m.Disliked != 0 {
		t.Fatalf("wrong counts: %+v", m)
	}
	for _, g := range m.Genres {
		if g.Genre == "Horror" {
			t.Fatal("an unseen-only genre must not appear in scored affinities")
		}
	}
	drama := findGenre(m.Genres, "Drama")
	if drama == nil || drama.Score != 1 || drama.Liked != 1 || drama.Disliked != 0 {
		t.Fatalf("Drama should reflect only the single like, not the unseen response: %+v", drama)
	}
}

func TestGenreScoreNetsLikesAndDislikes(t *testing.T) {
	m := BuildTasteMap([]QuizResponse{
		resp(1, "like", "Comedy"),
		resp(2, "like", "Comedy"),
		resp(3, "dislike", "Comedy"),
	})
	comedy := findGenre(m.Genres, "Comedy")
	if comedy == nil || comedy.Score != 1 || comedy.Liked != 2 || comedy.Disliked != 1 {
		t.Fatalf("expected net score 1 (2 liked - 1 disliked): %+v", comedy)
	}
}

func TestConfidenceReflectsAnsweredCountNotTotalResponses(t *testing.T) {
	few := BuildTasteMap([]QuizResponse{resp(1, "like", "Drama"), resp(2, "unseen", "Drama")})
	if few.Confidence != "low" {
		t.Fatalf("one real answer plus an unseen must stay low confidence, got %q", few.Confidence)
	}
	var many []QuizResponse
	for i := int64(1); i <= 9; i++ {
		many = append(many, resp(i, "like", "Drama"))
	}
	if BuildTasteMap(many).Confidence != "high" {
		t.Fatal("9 answered responses should reach high confidence")
	}
}

func findGenre(gs []GenreAffinity, name string) *GenreAffinity {
	for i := range gs {
		if gs[i].Genre == name {
			return &gs[i]
		}
	}
	return nil
}

package taste

// Tribe is GAP 10: a fixed, product-curated regional or interest community,
// never user-created. There is no tribe-creation or moderation surface
// because there is no user-generated tribe content to moderate — joining
// only changes whose existing ratings get averaged together. Keep this list
// short and honest: add a tribe only when it's a real, recognizable
// community, not a guess at one.
type Tribe struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Kind  string `json:"kind"` // "regional" or "interest"
}

var Tribes = []Tribe{
	{ID: "telugu_cinema", Label: "Telugu cinema", Kind: "regional"},
	{ID: "tamil_cinema", Label: "Tamil cinema", Kind: "regional"},
	{ID: "malayalam_cinema", Label: "Malayalam cinema", Kind: "regional"},
	{ID: "korean_cinema", Label: "Korean cinema", Kind: "regional"},
	{ID: "japanese_cinema", Label: "Japanese cinema", Kind: "regional"},
	{ID: "french_cinema", Label: "French cinema", Kind: "regional"},
	{ID: "documentary_lovers", Label: "Documentary lovers", Kind: "interest"},
	{ID: "horror_enthusiasts", Label: "Horror enthusiasts", Kind: "interest"},
	{ID: "animation_fans", Label: "Animation fans", Kind: "interest"},
	{ID: "classic_film_buffs", Label: "Classic film buffs (pre-1980)", Kind: "interest"},
}

func ValidTribe(id string) bool {
	for _, t := range Tribes {
		if t.ID == id {
			return true
		}
	}
	return false
}

// MinRatingSample is how many eligible ratings a global or tribe score needs
// before it's shown at all — below this, the score is suppressed (nil), not
// a number computed from too little data. Sample size itself is still
// always reported, so "not enough data yet" stays honest and visible.
const MinRatingSample = 3

// Rating pairs a (possibly suppressed) average with the sample size it was
// computed from, plus a source label distinguishing "Afterframe's own
// community average" from anything else (TMDB's rating, say) that might
// ever be shown alongside it.
type Rating struct {
	Score      *float64 `json:"score"`
	SampleSize int      `json:"sample_size"`
	Source     string   `json:"source"`
}

// BuildRating never fabricates a score below MinRatingSample — it reports
// the real sample size either way, so the caller can say "not enough
// ratings yet (2)" instead of hiding the fact entirely.
func BuildRating(avg float64, hasAvg bool, sampleSize int, source string) Rating {
	r := Rating{SampleSize: sampleSize, Source: source}
	if hasAvg && sampleSize >= MinRatingSample {
		r.Score = &avg
	}
	return r
}

// Package spoilers owns disclosure rules for every review response surface.
package spoilers

func Disclose(r map[string]any) {
	layer, _ := r["allowed_layer"].(float64)
	if layer < 2 {
		delete(r, "watched")
	}
	if layer < 3 {
		delete(r, "reflection")
	}
}

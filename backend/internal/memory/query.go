// Package memory interprets a small, explicit set of recall phrases without AI.
package memory

import (
	"regexp"
	"strings"
	"time"
)

type Query struct{ Text, From, To string }

var filler = regexp.MustCompile(`(?i)\b(what|was|that|movie|film|films|movies|i|watched|show|me|find|which|the|a|an|it|made|feel|feeling)\b`)

func Interpret(text, from, to string, now time.Time) Query {
	q := Query{Text: strings.TrimSpace(text), From: from, To: to}
	lower := strings.ToLower(q.Text)
	if strings.Contains(lower, "last winter") && from == "" && to == "" {
		year := now.Year() - 1
		if now.Month() < 3 {
			year--
		}
		q.From = time.Date(year, 12, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
		q.To = time.Date(year+1, 3, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
		q.Text = regexp.MustCompile(`(?i)last winter`).ReplaceAllString(q.Text, "")
	}
	q.Text = strings.Join(strings.Fields(filler.ReplaceAllString(q.Text, "")), " ")
	return q
}

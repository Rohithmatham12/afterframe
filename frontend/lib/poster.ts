// GAP 16: pure, testable pieces of the review-poster generator. Canvas
// drawing itself lives in the React component (library.tsx) since jsdom has
// no real canvas to assert pixels against — this file holds everything that
// *can* be asserted deterministically.

// Truncates at a word boundary so long reviews cut off predictably, never
// mid-word, and always end with an explicit "…" so it's obvious it's cut.
export function truncateExcerpt(text: string, limit = 180): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export const POSTER_ASPECTS = [
  { value: 'square', label: 'Square', width: 1080, height: 1080 },
  { value: 'story', label: 'Story', width: 1080, height: 1920 },
] as const;

export type PosterAspect = (typeof POSTER_ASPECTS)[number]['value'];

export function aspectSize(aspect: PosterAspect) {
  return (
    POSTER_ASPECTS.find((a) => a.value === aspect) ?? POSTER_ASPECTS[0]
  );
}

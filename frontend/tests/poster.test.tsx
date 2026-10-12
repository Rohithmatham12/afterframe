import { test, expect } from 'vitest';
import { truncateExcerpt, aspectSize } from '../lib/poster';

test('short text is left untouched', () => {
  expect(truncateExcerpt('A tight, perfect little film.')).toBe(
    'A tight, perfect little film.'
  );
});

test('long text truncates at a word boundary with an ellipsis', () => {
  const text =
    'This film completely rearranged how I think about memory and grief, ' +
    'in a way that snuck up on me about halfway through the second act ' +
    'and never really let go afterward, even days later.';
  const result = truncateExcerpt(text, 80);
  expect(result.length).toBeLessThanOrEqual(81);
  expect(result.endsWith('…')).toBe(true);
  // Never cuts mid-word: strip the ellipsis and the remainder must not be a
  // prefix of any word mid-way through — i.e. it must end exactly where the
  // original text had a space.
  const withoutEllipsis = result.slice(0, -1);
  expect(text.startsWith(withoutEllipsis)).toBe(true);
  expect(text[withoutEllipsis.length]).toBe(' ');
});

test('truncation is deterministic for the same input and limit', () => {
  const text = 'x'.repeat(500);
  expect(truncateExcerpt(text, 180)).toBe(truncateExcerpt(text, 180));
});

test('whitespace is trimmed before measuring length', () => {
  expect(truncateExcerpt('  short  ')).toBe('short');
});

test('aspect sizes are fixed, supported presets, not arbitrary', () => {
  expect(aspectSize('square')).toEqual({
    value: 'square',
    label: 'Square',
    width: 1080,
    height: 1080,
  });
  expect(aspectSize('story').height).toBe(1920);
});

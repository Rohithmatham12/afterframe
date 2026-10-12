import { test, expect } from 'vitest';
import { parseLetterboxdDiary } from '../lib/letterboxd';

test('parses a standard Letterboxd diary.csv', () => {
  const csv = [
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
    '2024-10-11,Fight Club,1999,https://boxd.it/x,4.5,,,2020-01-15',
    '2024-10-12,The Matrix,1999,https://boxd.it/y,5,Yes,,2020-02-20',
  ].join('\n');
  const { rows, error } = parseLetterboxdDiary(csv);
  expect(error).toBe('');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual({
    title: 'Fight Club',
    year: '1999',
    watchedOn: '2020-01-15',
    rating: 4.5,
    rewatch: false,
  });
  expect(rows[1].rewatch).toBe(true);
  expect(rows[1].rating).toBe(5);
});

test('handles a quoted title with an embedded comma', () => {
  const csv = [
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
    '2024-10-11,"Dr. Strangelove, or How I Learned",1964,https://boxd.it/z,5,,,2020-03-01',
  ].join('\n');
  const { rows, error } = parseLetterboxdDiary(csv);
  expect(error).toBe('');
  expect(rows[0].title).toBe('Dr. Strangelove, or How I Learned');
});

test('rejects a file missing the expected columns', () => {
  const { error, rows } = parseLetterboxdDiary('Foo,Bar\n1,2');
  expect(error).not.toBe('');
  expect(rows).toHaveLength(0);
});

test('skips rows with no title', () => {
  const csv = [
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
    '2024-10-11,,1999,https://boxd.it/x,,,,2020-01-15',
  ].join('\n');
  const { rows } = parseLetterboxdDiary(csv);
  expect(rows).toHaveLength(0);
});

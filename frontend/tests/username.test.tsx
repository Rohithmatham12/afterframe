import { test, expect } from 'vitest';
import {
  normalizeUsername,
  usernameFormatError,
  suggestUsernameFrom,
  isPlaceholderUsername,
} from '../lib/username';

test('normalizes case and surrounding whitespace to the canonical handle', () => {
  expect(normalizeUsername('Strike')).toBe('strike');
  expect(normalizeUsername('  Strike_2026  ')).toBe('strike_2026');
});

test('accepts the documented valid shapes without complaint', () => {
  expect(usernameFormatError('Strike')).toBeNull();
  expect(usernameFormatError('Strike_2026')).toBeNull();
  expect(usernameFormatError('abc')).toBeNull();
});

test('gives a specific, actionable message instead of a generic format error', () => {
  expect(usernameFormatError('ab')).toBe('Use at least 3 characters.');
  expect(usernameFormatError('a'.repeat(31))).toBe('Use 30 characters or fewer.');
  expect(usernameFormatError('Strike@Movies')).toBe(
    'Usernames can contain letters, numbers, and underscores. Remove the @ symbol.'
  );
  expect(usernameFormatError('strike films')).toBe(
    'Usernames can only contain letters, numbers, and underscores.'
  );
});

test('derives a readable suggestion from profile metadata, never a raw id', () => {
  expect(suggestUsernameFrom('Alex Morgan')).toBe('alexmorgan');
  expect(suggestUsernameFrom('alex.morgan@gmail.com')).toBe('alexmorgangmailcom');
  expect(suggestUsernameFrom('')).toBe('');
});

test('flags the backend-generated placeholder handle and nothing else', () => {
  expect(isPlaceholderUsername('film_136f445995144c8994f7')).toBe(true);
  expect(isPlaceholderUsername('alexfilms')).toBe(false);
});

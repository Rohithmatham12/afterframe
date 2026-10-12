export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

// Client-side mirror of the backend's ValidUsername check. It exists only to give
// the user an immediate, specific message while typing; the server-side check in
// backend/internal/service/service.go is the one that actually guards storage.
export function usernameFormatError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length === 0) return 'Choose a username.';
  if (u.length < 3) return 'Use at least 3 characters.';
  if (u.length > 30) return 'Use 30 characters or fewer.';
  if (/[^a-z0-9_]/.test(u)) {
    return raw.includes('@')
      ? 'Usernames can contain letters, numbers, and underscores. Remove the @ symbol.'
      : 'Usernames can only contain letters, numbers, and underscores.';
  }
  return null;
}

// Derives a human-readable starting suggestion from Google/email profile metadata
// (e.g. "Alex Morgan" or "alex.morgan@gmail.com") so a new user is never asked to
// start from a raw database id. Purely a prefill the user can edit or reject.
export function suggestUsernameFrom(seed: string): string {
  const base = normalizeUsername(seed).replace(/[^a-z0-9]/g, '');
  return base.slice(0, 20);
}

// Matches the backend's server.Ensure() placeholder ("film_" + a stripped uuid).
// Never shown to the user as-is; it only flags that onboarding is still owed.
export const isPlaceholderUsername = (username: string) =>
  username.startsWith('film_');

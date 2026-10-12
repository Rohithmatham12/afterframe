// Mirrors the CHECK constraints in backend/migrations/000010_feelings_and_watchlist_intent.up.sql.
// Keep both lists in sync with the database; the server remains authoritative.
export const FEELINGS = [
  'comforted',
  'wrecked',
  'inspired',
  'energized',
  'nostalgic',
  'uneasy',
  'hopeful',
  'melancholic',
  'amused',
  'thoughtful',
  'frustrated',
  'calm',
  'amazed',
] as const;

export const WATCHLIST_INTENTS = [
  { value: '', label: 'No reason given' },
  { value: 'date_night', label: 'Date night' },
  { value: 'rainy_day', label: 'Rainy day' },
  { value: 'friends_recommended', label: 'Friends recommended' },
  { value: 'family_night', label: 'Family night' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'comfort_watch', label: 'Comfort watch' },
  { value: 'short_movie', label: 'Short movie' },
  { value: 'personal_recommendation', label: 'Personal recommendation' },
] as const;

export const intentLabel = (value: string) =>
  WATCHLIST_INTENTS.find((i) => i.value === value)?.label || value;

// Mirrors migration 000011_tone_and_context.up.sql.
export const VIEWING_CONTEXTS = [
  { value: '', label: 'Not specified' },
  { value: 'solo', label: 'Solo' },
  { value: 'date_night', label: 'Date night' },
  { value: 'friends', label: 'Friends' },
  { value: 'family', label: 'Family' },
  { value: 'kids', label: 'Kids' },
] as const;

export const contextLabel = (value: string) =>
  VIEWING_CONTEXTS.find((c) => c.value === value)?.label || value;

export const REVIEW_TONES = [
  { value: '', label: 'All' },
  { value: 'insightful', label: 'Insightful' },
  { value: 'funny', label: 'Funny' },
] as const;

// A small, common subset of TMDB/JustWatch region codes. Not exhaustive by
// design — callers can still type region query params directly against the
// API; this list is only for a convenient picker in the UI.
export const REGIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
] as const;

// The standard TMDB movie genre list, used only for the guest/couple
// preference picker in Tonight Mode (GAP 08) — a guest with no account can
// still express taste without a full quiz.
export const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western',
] as const;

export const toneLabel = (value: string) =>
  REVIEW_TONES.find((t) => t.value === value)?.label || value;

// Mirrors migration 000016_abandonment_tracking.up.sql's CHECK constraints.
export const PROGRESS_REASONS = [
  { value: '', label: 'No reason given' },
  { value: 'bored', label: 'Bored' },
  { value: 'not_in_the_mood', label: 'Not in the mood' },
  { value: 'too_intense', label: 'Too intense' },
  { value: 'interrupted', label: 'Interrupted' },
  { value: 'other', label: 'Other' },
] as const;

export const progressReasonLabel = (value: string) =>
  PROGRESS_REASONS.find((r) => r.value === value)?.label || value;

// Mirrors migration 000017_craft_mode.up.sql's CHECK constraint.
export const CRAFT_CATEGORIES = [
  { value: 'cinematography', label: 'Cinematography' },
  { value: 'editing', label: 'Editing' },
  { value: 'sound_design', label: 'Sound design' },
  { value: 'production_design', label: 'Production design' },
  { value: 'direction', label: 'Direction' },
  { value: 'performance', label: 'Performance' },
  { value: 'scene_reference', label: 'Scene reference' },
  { value: 'other', label: 'Other' },
] as const;

export const craftCategoryLabel = (value: string) =>
  CRAFT_CATEGORIES.find((c) => c.value === value)?.label || value;

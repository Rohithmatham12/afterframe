'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Film } from 'lucide-react';
import { api, result, type Models } from '@/lib/api';
import { normalizeUsername, usernameFormatError } from '@/lib/username';
export function go(route: string) {
  window.location.hash = route;
}
export function Poster({
  film,
  small = false,
}: {
  film: Models['Film'];
  small?: boolean;
}) {
  return (
    <button
      className={'poster ' + (small ? 'small' : '')}
      onClick={() => go('film/' + film.id)}
      aria-label={'Open ' + film.title}
    >
      {film.poster ? (
        <img
          src={'https://image.tmdb.org/t/p/w185' + film.poster}
          srcSet={`https://image.tmdb.org/t/p/w185${film.poster} 185w, https://image.tmdb.org/t/p/w342${film.poster} 342w`}
          sizes={small ? '64px' : '(max-width: 600px) 30vw, 180px'}
          width={342}
          height={513}
          alt={film.title + ' poster'}
          loading="lazy"
        />
      ) : (
        <span className="missing">
          <Film />
          <span>{film.title}</span>
        </span>
      )}
      {/* Only on the full-size card (a Discover/search grid tile) — small
          posters (reviews, diary, lists) are too tight for this and already
          carry their own context. vote_count gates it so an uncached or
          genuinely unrated film shows nothing rather than a fake "0.0". */}
      {!small && !!film.vote_count && (
        <span className="poster-rating">
          ★ {(film.vote_average ?? 0).toFixed(1)}
        </span>
      )}
      <span className="poster-caption">
        <strong>{film.title}</strong>
        <span>
          {film.year}
          {!small && film.genres[0] ? ' · ' + film.genres[0] : ''}
        </span>
      </span>
    </button>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Film size={28} />
      <h3>{title}</h3>
      <p>{children || 'Your next chapter starts with a film.'}</p>
      <button onClick={() => go('discover')}>Explore films</button>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      aria-labelledby="dialog-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
          )
        ).filter((el) => el.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Stars({ rating }: { rating: number | null }) {
  return (
    <span
      className="stars"
      aria-label={rating === null ? 'Unrated' : `${rating} out of 5 stars`}
    >
      {rating === null
        ? '—'
        : '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '')}
      <span className="sr-only">{rating}</span>
    </span>
  );
}
export function Rating({
  value,
  change,
}: {
  value: number | null;
  change: (v: number | null) => void;
}) {
  return (
    <label>
      Rating
      <select
        aria-label="Rating"
        value={value ?? ''}
        onChange={(e) => change(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Unrated</option>
        {Array.from({ length: 10 }, (_, i) => (i + 1) / 2).map((n) => (
          <option key={n} value={n}>
            {n} stars
          </option>
        ))}
      </select>
    </label>
  );
}
export const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please retry.';

// Live, server-authoritative username input shared by onboarding and account
// settings. Never relies on the browser's native `pattern` validation bubble
// ("Please match the requested format"), which cannot explain *why* input failed.
export function UsernameField({
  value,
  onChange,
  startingUsername,
  canSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  startingUsername?: string;
  canSubmit?: (ok: boolean) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'blocked'>(
    'idle'
  );
  const [note, setNote] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const normalized = normalizeUsername(value);
  const formatError = usernameFormatError(value);
  useEffect(() => {
    canSubmit?.(!formatError && status !== 'blocked' && status !== 'checking');
  }, [formatError, status, canSubmit]);
  useEffect(() => {
    if (formatError) {
      setStatus('idle');
      setNote(formatError);
      setSuggestions([]);
      return;
    }
    if (startingUsername && normalized === normalizeUsername(startingUsername)) {
      setStatus('idle');
      setNote('');
      setSuggestions([]);
      return;
    }
    let live = true;
    setStatus('checking');
    setNote('Checking availability…');
    const t = setTimeout(async () => {
      try {
        const r = result(
          await api.GET('/v1/username-available', {
            params: { query: { u: normalized } },
          })
        );
        if (!live) return;
        setStatus(r.available ? 'available' : 'blocked');
        setNote(r.available ? 'Available.' : r.reason || 'That username is taken.');
        setSuggestions(r.suggestions || []);
      } catch {
        if (live) setStatus('idle');
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // startingUsername intentionally excluded: it never changes after mount, so
    // including it would only add a needless re-run condition.
  }, [normalized, formatError]);
  return (
    <div className="stack">
      <label>
        Username
        <input
          aria-describedby="username-hint username-status"
          aria-invalid={status === 'blocked' || !!formatError}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <p className="muted" id="username-hint">
        3-30 characters: lowercase letters, numbers, and underscores. Shown as @
        {normalized || 'yourname'}.
      </p>
      <p
        className={status === 'blocked' || formatError ? 'error' : 'muted'}
        role="status"
        id="username-status"
      >
        {note}
      </p>
      {suggestions.length > 0 && (
        <div className="row">
          {suggestions.map((s) => (
            <button type="button" key={s} onClick={() => onChange(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

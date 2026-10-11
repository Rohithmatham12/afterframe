'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Film } from 'lucide-react';
import type { Models } from '@/lib/api';
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
      <span className="poster-caption">
        <strong>{film.title}</strong>
        <span>{film.year}</span>
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

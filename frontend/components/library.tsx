'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, result, type Models } from '@/lib/api';
import { Empty, Poster, Stars, UsernameField, go, message } from './ui';
import { MutationForm } from './forms';
import { isPlaceholderUsername } from '@/lib/username';
import {
  contextLabel,
  craftCategoryLabel,
  FEELINGS,
  GENRES,
  PROGRESS_REASONS,
  progressReasonLabel,
  REGIONS,
  VIEWING_CONTEXTS,
} from '@/lib/vocab';
import { parseLetterboxdDiary, type DiaryRow } from '@/lib/letterboxd';
import {
  aspectSize,
  POSTER_ASPECTS,
  truncateExcerpt,
  type PosterAspect,
} from '@/lib/poster';
import { LockKeyhole } from 'lucide-react';
import AccountControls from './account';
type Props = {
  refresh: () => void;
  edit: (kind: string, value: unknown) => void;
  notify: (s: string) => void;
};
// GAP 08: solo + guest-couple Tonight Mode. A real consent-based flow for a
// second *Afterframe account* isn't built — only a guest with hand-entered
// preferences, who never needs an account of their own.
function GenrePicker({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: string[];
  onChange: (g: string[]) => void;
}) {
  return (
    <div>
      <span className="muted">{label}</span>
      <div className="row" role="group" aria-label={label}>
        {GENRES.map((g) => {
          const on = selected.includes(g);
          return (
            <button
              type="button"
              key={g}
              aria-pressed={on}
              className={on ? 'chip selected' : 'chip'}
              onClick={() =>
                onChange(on ? selected.filter((x) => x !== g) : [...selected, g])
              }
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function TonightMode({
  profile,
}: {
  profile?: Models['Profile'] | null;
}) {
  const [maxMinutes, setMaxMinutes] = useState('');
  const [mood, setMood] = useState('');
  const [context, setContext] = useState('');
  const [guestOn, setGuestOn] = useState(false);
  const [guestLiked, setGuestLiked] = useState<string[]>([]);
  const [guestDisliked, setGuestDisliked] = useState<string[]>([]);
  const [partnerOn, setPartnerOn] = useState(false);
  const [partnerUsername, setPartnerUsername] = useState('');
  const [data, setData] = useState<Models['TonightResult'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    try {
      setData(
        await result(
          await api.POST('/v1/tonight', {
            body: {
              max_minutes: maxMinutes ? Number(maxMinutes) : undefined,
              mood: mood || undefined,
              context: context || undefined,
              guest: guestOn
                ? { liked_genres: guestLiked, disliked_genres: guestDisliked }
                : undefined,
              partner: partnerOn ? partnerUsername : undefined,
            },
          })
        )
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack tonight-mode">
      {profile?.family_policy && (
        <p className="chip">
          Family Mode is on ({profile.family_policy}, {profile.family_region}
          ) — picks are filtered to that policy. Manage this in Settings.
        </p>
      )}
      <div className="two-col">
        <label>
          Time you have <small>optional</small>
          <input
            type="number"
            min={1}
            placeholder="e.g. 90 minutes"
            value={maxMinutes}
            onChange={(e) => setMaxMinutes(e.target.value)}
          />
        </label>
        <label>
          Who&rsquo;s watching <small>optional</small>
          <select value={context} onChange={(e) => setContext(e.target.value)}>
            {VIEWING_CONTEXTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Mood <small>optional</small>
        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          <option value="">Not specified</option>
          {FEELINGS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={guestOn}
          onChange={(e) => {
            setGuestOn(e.target.checked);
            if (e.target.checked) setPartnerOn(false);
          }}
        />
        Watching with a guest who isn&rsquo;t on Afterframe
      </label>
      {guestOn && (
        <div className="stack">
          <p className="muted">
            No account needed for them — just a few genres.
          </p>
          <GenrePicker
            label="Guest likes"
            selected={guestLiked}
            onChange={setGuestLiked}
          />
          <GenrePicker
            label="Guest dislikes"
            selected={guestDisliked}
            onChange={setGuestDisliked}
          />
        </div>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={partnerOn}
          onChange={(e) => {
            setPartnerOn(e.target.checked);
            if (e.target.checked) setGuestOn(false);
          }}
        />
        Watching with a connected Afterframe partner
      </label>
      {partnerOn && (
        <div className="stack">
          <label>
            Partner&rsquo;s username
            <input
              value={partnerUsername}
              onChange={(e) => setPartnerUsername(e.target.value)}
              placeholder="their @username"
            />
          </label>
          <p className="muted">
            Needs an accepted taste-sharing connection — manage those from{' '}
            <button type="button" className="text-button" onClick={() => go('taste-partners')}>
              Taste partners
            </button>
            .
          </p>
        </div>
      )}
      <button className="primary" disabled={loading} onClick={run}>
        {loading ? 'Finding something…' : data ? 'Try again' : "Find tonight's film"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div className="tonight-results">
          {data.message && <p className="muted">{data.message}</p>}
          {data.picks.length === 0 ? (
            <Empty title="Nothing fits those filters">
              Try a longer time limit or a different mood.
            </Empty>
          ) : (
            <div className="film-grid">
              {data.picks.map((p) => (
                <div key={p.film.id}>
                  <Poster film={p.film} />
                  {p.reasons.length > 0 && (
                    <p className="muted">{p.reasons.join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// GAP 08 completion: real consent for sharing taste with another account.
// Nothing crosses the boundary until the invited side explicitly accepts —
// see backend's shared_taste() and the taste_share_respond RLS policy.
// GAP 15: the CSV is parsed entirely client-side (lib/letterboxd.ts); the
// server only ever sees already-typed rows, matches each to a real film,
// and is idempotent on re-upload (see backend/internal/service/import.go).
// GAP 20: unfinished films carry a meaningful preference signal, but an
// interruption is never automatically treated as a dislike — this only ever
// writes to viewing_progress, never to opinions/viewings, so it can't skew
// genre taste scoring on its own.
export function ProgressTracker({
  film,
  current,
  onSaved,
}: {
  film: Models['Film'];
  current: Models['Progress'] | undefined;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<'paused' | 'abandoned' | null>(null);
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(status: string, withDetails: boolean) {
    setSaving(true);
    setError('');
    try {
      await result(
        await api.POST('/v1/progress', {
          body: {
            film_id: film.id,
            status,
            progress_minutes:
              withDetails && minutes ? Number(minutes) : undefined,
            reason: withDetails ? reason : '',
          },
        })
      );
      setEditing(null);
      setMinutes('');
      setReason('');
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }

  const unresolved =
    current && (current.status === 'paused' || current.status === 'abandoned')
      ? current
      : undefined;

  if (unresolved && !editing) {
    const label = unresolved.status === 'paused' ? 'Paused' : 'Abandoned';
    return (
      <div className="stack chip">
        <span>
          {label}
          {unresolved.progress_minutes != null &&
            ` at ${unresolved.progress_minutes} min`}
          {unresolved.reason && ` · ${progressReasonLabel(unresolved.reason)}`}
        </span>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button disabled={saving} onClick={() => save('started', false)}>
            Resume
          </button>
          <button disabled={saving} onClick={() => setEditing('abandoned')}>
            Mark abandoned
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="stack">
        <label>
          Stopped at (minutes, optional)
          <input
            type="number"
            min={0}
            max={film.runtime || undefined}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label>
          Reason (optional)
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {PROGRESS_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button
            className="primary"
            disabled={saving}
            onClick={() => save(editing, true)}
          >
            Save
          </button>
          <button disabled={saving} onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="row">
      <button disabled={saving} onClick={() => save('started', false)}>
        Started watching
      </button>
      <button disabled={saving} onClick={() => setEditing('paused')}>
        Paused
      </button>
      <button disabled={saving} onClick={() => setEditing('abandoned')}>
        Abandoned
      </button>
    </div>
  );
}
// GAP 10: global vs tribe taste, side by side. Both scores carry a clear
// source label and a visible sample size; a score below the minimum
// sample is never shown as a number — "not enough ratings yet (N)"
// instead, so nothing here is ever fabricated from too little data.
export function FilmRatings({ filmID }: { filmID: number }) {
  const [tribes, setTribes] = useState<Models['Tribe'][]>([]);
  const [selected, setSelected] = useState('');
  const [ratings, setRatings] = useState<Models['FilmRatings'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .GET('/v1/tribes')
      .then(result)
      .then(setTribes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    api
      .GET('/v1/film-ratings', {
        params: { query: { film_id: filmID, tribe: selected || undefined } },
      })
      .then(result)
      .then((r) => live && setRatings(r))
      .catch((e) => live && setError(message(e)));
    return () => {
      live = false;
    };
  }, [filmID, selected]);

  const joined = tribes.filter((t) => t.joined);

  function describe(r: Models['Rating'] | null | undefined, name: string) {
    if (!r) return null;
    if (r.score == null)
      return `${name}: not enough ratings yet (${r.sample_size})`;
    return `${name}: ${r.score.toFixed(1)} (${r.sample_size} rating${r.sample_size === 1 ? '' : 's'})`;
  }

  if (error) return null;
  if (!ratings) return null;

  return (
    <div className="row">
      <span className="chip">{describe(ratings.global, 'Afterframe community')}</span>
      {ratings.tribe && (
        <span className="chip">
          {describe(
            ratings.tribe,
            tribes.find((t) => t.id === selected)?.label || 'Tribe'
          )}
        </span>
      )}
      {joined.length > 0 && (
        <label>
          <span className="sr-only">Compare against a tribe</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">No tribe comparison</option>
            {joined.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
// GAP 16: a one-tap, entirely client-side poster generator. Nothing here is
// ever uploaded — it draws to a local <canvas> and only leaves the device
// when the owner explicitly downloads or shares it, so a private/unlisted
// review is never exposed by this feature on its own.
export function PosterShare({
  review,
  done,
}: {
  review: Models['Review'];
  done: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<PosterAspect>('square');
  const [rating, setRating] = useState('');
  const [feeling, setFeeling] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const excerpt = truncateExcerpt(
    review.watched || review.reflection || review.safe || ''
  );

  useEffect(() => {
    let live = true;
    render().then(() => {
      if (!live) return;
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, rating, feeling]);

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image failed to load'));
      img.src = src;
    });
  }

  function wrapLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines - 1) break;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/…?$/, '…');
    }
    return lines;
  }

  async function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    setError('');
    const { width, height } = aspectSize(aspect);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Your browser has no canvas support — can’t render a poster here.');
      setRendering(false);
      return;
    }
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(0, 0, width, height);
    // Graceful fallback: a missing poster, or an image that fails to load
    // (including a CORS-tainted canvas), still produces a complete poster.
    let posterDrawn = false;
    if (review.film.poster) {
      try {
        const img = await loadImage(
          'https://image.tmdb.org/t/p/w780' + review.film.poster
        );
        const scale = Math.max(width / img.width, height / img.height);
        const w = img.width * scale,
          h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        posterDrawn = true;
      } catch {
        posterDrawn = false;
      }
    }
    if (!posterDrawn) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#2a1640');
      grad.addColorStop(1, '#120a1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    // A dark gradient over the lower half guarantees white text stays
    // readable regardless of what's underneath — the accessible-contrast
    // requirement, not left to chance per-poster.
    const overlay = ctx.createLinearGradient(0, height * 0.32, 0, height);
    overlay.addColorStop(0, 'rgba(10,6,16,0)');
    overlay.addColorStop(1, 'rgba(10,6,16,0.96)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    const pad = width * 0.07;
    const maxWidth = width - pad * 2;
    let y = height - pad;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(width * 0.028)}px system-ui, sans-serif`;
    ctx.fillText('afterframe', pad, pad + width * 0.028);

    if (feeling) {
      ctx.font = `${Math.round(width * 0.03)}px system-ui, sans-serif`;
      const label = feeling;
      const w = ctx.measureText(label).width + width * 0.045;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      const chipH = width * 0.065;
      roundRect(ctx, pad, y - chipH, w, chipH, chipH / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, pad + width * 0.022, y - chipH * 0.32);
      y -= chipH + width * 0.03;
    }

    ctx.font = `${Math.round(width * 0.036)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const excerptLines = excerpt
      ? wrapLines(ctx, excerpt, maxWidth, 6)
      : [];
    for (let i = excerptLines.length - 1; i >= 0; i--) {
      ctx.fillText(excerptLines[i], pad, y);
      y -= width * 0.05;
    }
    y -= width * 0.02;

    if (rating) {
      ctx.font = `${Math.round(width * 0.045)}px system-ui, sans-serif`;
      ctx.fillStyle = '#f5c518';
      const full = Math.floor(Number(rating));
      const half = Number(rating) - full >= 0.5;
      const stars = '★'.repeat(full) + (half ? '½' : '');
      ctx.fillText(stars || '½', pad, y);
      y -= width * 0.065;
    }

    ctx.font = `bold ${Math.round(width * 0.052)}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(review.film.title, pad, y);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Could not render an image.');
        setRendering(false);
        return;
      }
      setImageURL((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setRendering(false);
    });
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], 'afterframe-poster.png', {
          type: 'image/png',
        });
        await navigator.share({ files: [file], title: review.film.title });
      } catch {
        // User cancelled the native share sheet, or the browser rejected it —
        // either way, Download remains available right next to this button.
      }
    });
  }

  return (
    <div className="stack">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={'Poster preview for ' + review.film.title}
        style={{
          width: '100%',
          maxWidth: 280,
          borderRadius: 12,
          aspectRatio: `${aspectSize(aspect).width} / ${aspectSize(aspect).height}`,
        }}
      />
      <label>
        Aspect ratio
        <select
          value={aspect}
          onChange={(e) => setAspect(e.target.value as PosterAspect)}
        >
          {POSTER_ASPECTS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your rating (optional)
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">No rating shown</option>
          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
            <option key={n} value={n}>
              {n} stars
            </option>
          ))}
        </select>
      </label>
      <label>
        Feeling tag (optional)
        <select value={feeling} onChange={(e) => setFeeling(e.target.value)}>
          <option value="">No feeling shown</option>
          {FEELINGS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <a
          className="primary"
          href={imageURL || undefined}
          download={`afterframe-${review.film_id}-poster.png`}
          aria-disabled={!imageURL || rendering}
          onClick={(e) => {
            if (!imageURL || rendering) e.preventDefault();
          }}
        >
          Download image
        </a>
        {canShare && (
          <button disabled={!imageURL || rendering} onClick={share}>
            Share
          </button>
        )}
        <button onClick={done}>Close</button>
      </div>
    </div>
  );
}
export function LetterboxdImport() {
  const [rows, setRows] = useState<DiaryRow[] | null>(null);
  const [fileError, setFileError] = useState('');
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<{
    imported: number;
    skipped: Models['ImportSkip'][];
  } | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOutcome(null);
    const text = await file.text();
    const { rows: parsed, error } = parseLetterboxdDiary(text);
    setFileError(error);
    setRows(error ? null : parsed);
  }

  const usable = (rows || []).filter((r) => r.watchedOn);
  const missingDate = (rows || []).length - usable.length;

  async function doImport() {
    if (!rows) return;
    setImporting(true);
    const batchSize = 500;
    let imported = 0;
    const skipped: Models['ImportSkip'][] = [];
    for (let i = 0; i < usable.length; i += batchSize) {
      const batch = usable.slice(i, i + batchSize).map((r) => ({
        title: r.title,
        year: r.year,
        watched_on: r.watchedOn,
        rating: r.rating,
        rewatch: r.rewatch,
      }));
      try {
        const r = await result(
          await api.POST('/v1/import/letterboxd', { body: batch })
        );
        imported += r.imported;
        skipped.push(...r.skipped);
      } catch (e) {
        skipped.push(
          ...batch.map((b) => ({ title: b.title, reason: message(e) }))
        );
      }
    }
    setOutcome({ imported, skipped });
    setImporting(false);
  }

  return (
    <div className="stack">
      <p className="muted">
        Export your diary from Letterboxd (Settings → Import &amp; Export),
        unzip it, and upload the <code>diary.csv</code> file here. Films are
        matched by title and year; anything that doesn&rsquo;t confidently
        match is reported, not guessed. Re-uploading the same file is safe —
        it won&rsquo;t create duplicates.
      </p>
      <label>
        diary.csv
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
      </label>
      {fileError && (
        <p className="error" role="alert">
          {fileError}
        </p>
      )}
      {rows && !outcome && (
        <div className="stack">
          <p className="muted">
            {usable.length} viewing{usable.length === 1 ? '' : 's'} ready to
            import
            {missingDate > 0 &&
              ` (${missingDate} row${missingDate === 1 ? '' : 's'} skipped — no watched date in the export).`}
          </p>
          <div className="row">
            {usable.slice(0, 8).map((r, i) => (
              <span className="chip" key={i}>
                {r.title} {r.year && `(${r.year})`}
              </span>
            ))}
            {usable.length > 8 && (
              <span className="muted">+{usable.length - 8} more</span>
            )}
          </div>
          <button
            className="primary"
            disabled={importing || usable.length === 0}
            onClick={doImport}
          >
            {importing ? 'Importing…' : `Import ${usable.length} viewings`}
          </button>
        </div>
      )}
      {outcome && (
        <div className="stack">
          <p className="muted" role="status">
            Imported {outcome.imported} viewing
            {outcome.imported === 1 ? '' : 's'}.
            {outcome.skipped.length > 0 &&
              ` ${outcome.skipped.length} skipped.`}
          </p>
          {outcome.skipped.length > 0 && (
            <details>
              <summary>Skipped entries</summary>
              {outcome.skipped.map((s, i) => (
                <p key={i} className="muted">
                  {s.title}: {s.reason}
                </p>
              ))}
            </details>
          )}
          <button onClick={() => go('diary')}>View your diary</button>
        </div>
      )}
    </div>
  );
}
export function TastePartners() {
  const [shares, setShares] = useState<Models['TasteShare'][]>([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setShares(await result(await api.GET('/v1/taste-shares')));
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function send() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await result(
        await api.POST('/v1/taste-share', { body: { username } })
      );
      setNotice('Request sent.');
      setUsername('');
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    try {
      await result(
        await api.POST('/v1/taste-share-respond', { body: { id, accept } })
      );
      await load();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Connect with someone else&rsquo;s Afterframe account to use their
        real taste in Tonight Mode. Nothing is shared until they accept.
      </p>
      <div className="row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="their @username"
          aria-label="Partner's username"
        />
        <button className="primary" disabled={loading || !username} onClick={send}>
          Send request
        </button>
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {shares.length ? (
        <div className="stack">
          {shares.map((s) => (
            <div className="row" key={s.id}>
              <span>
                @{s.username} &middot;{' '}
                {s.direction === 'sent' ? 'you invited' : 'invited you'}
              </span>
              {s.status === 'pending' && s.direction === 'received' ? (
                <>
                  <button onClick={() => respond(s.id, true)}>Accept</button>
                  <button
                    className="text-button"
                    onClick={() => respond(s.id, false)}
                  >
                    Decline
                  </button>
                </>
              ) : (
                <>
                  <span className="chip">{s.status}</span>
                  {s.status === 'accepted' && (
                    <CompatibilityView partner={s.username} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No taste-sharing connections yet">
          Invite someone by their username to compare taste in Tonight Mode.
        </Empty>
      )}
    </div>
  );
}
// GAP 25: deterministic, explainable compatibility — never a fabricated
// percentage. backend/internal/taste/compatibility.go withholds `overall`
// entirely until there's a real sample; this just reflects that honestly.
function CompatibilityView({ partner }: { partner: string }) {
  const [data, setData] = useState<Models['Compatibility'] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setOpen(true);
    try {
      setData(
        await result(
          await api.GET('/v1/compatibility', { params: { query: { partner } } })
        )
      );
    } catch (e) {
      setError(message(e));
    }
  }

  if (!open) {
    return (
      <button type="button" className="text-button" onClick={load}>
        Compare taste
      </button>
    );
  }
  if (error) {
    return (
      <span className="muted" role="alert">
        {error}
      </span>
    );
  }
  if (!data) {
    return (
      <span className="muted" role="status">
        Comparing…
      </span>
    );
  }
  return (
    <span className="muted">
      {data.overall === null
        ? `Not enough shared answers yet (${data.sample_size} genre${data.sample_size === 1 ? '' : 's'} compared).`
        : `${data.overall}% taste agreement over ${data.sample_size} genre${data.sample_size === 1 ? '' : 's'}.`}
      {data.shared.length > 0 && ` You both like: ${data.shared.join(', ')}.`}
      {data.differing.length > 0 && ` You differ on: ${data.differing.join(', ')}.`}
    </span>
  );
}
// GAP 02: ~15 reproducible films, like/dislike/haven't-seen. "Haven't seen"
// is never treated as a dislike here or on the server — see
// backend/internal/taste/quiz.go, the real source of truth for that rule.
export function TasteQuiz({
  done,
  onSaved,
}: {
  done: () => void;
  onSaved?: () => void;
}) {
  const [films, setFilms] = useState<Models['Film'][] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tasteMap, setTasteMap] = useState<Models['TasteMap'] | null>(null);

  useEffect(() => {
    Promise.all([
      api.GET('/v1/quiz-films').then(result),
      api.GET('/v1/quiz').then(result),
    ])
      .then(([f, status]) => {
        setFilms(f);
        const prefill: Record<number, string> = {};
        for (const r of status.responses) prefill[r.film_id] = r.response;
        setAnswers(prefill);
      })
      .catch((e) => setError(message(e)));
  }, []);

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!films)
    return (
      <p className="loading" role="status">
        Loading your quiz…
      </p>
    );

  if (tasteMap) {
    return (
      <div className="stack">
        <h2>Your early taste map</h2>
        <p className="muted">
          {tasteMap.confidence === 'low'
            ? 'Early days — this will sharpen as you watch more.'
            : tasteMap.confidence === 'medium'
              ? 'A rough shape is forming.'
              : 'A clear early picture.'}{' '}
          {tasteMap.liked} liked · {tasteMap.disliked} disliked ·{' '}
          {tasteMap.unseen} haven&rsquo;t seen.
        </p>
        {tasteMap.genres.length > 0 ? (
          <div className="taste-bars">
            {tasteMap.genres.map((g) => (
              <div className="taste-bar-row" key={g.genre}>
                <span>{g.genre}</span>
                <div className="taste-bar">
                  <div
                    className={
                      'taste-bar-fill ' + (g.score >= 0 ? 'positive' : 'negative')
                    }
                    style={{ width: Math.min(100, Math.abs(g.score) * 20) + '%' }}
                  />
                </div>
                <span className="muted">
                  {g.score > 0 ? '+' : ''}
                  {g.score}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Answer a few more to see genre affinities.</p>
        )}
        <button className="primary" onClick={done}>
          See what&rsquo;s playing
        </button>
      </div>
    );
  }

  const film = films[index];
  const answered = Object.keys(answers).length;

  function pick(response: string) {
    setAnswers((a) => ({ ...a, [film.id]: response }));
    if (index < films!.length - 1) setIndex(index + 1);
  }

  return (
    <div className="stack taste-quiz">
      <p className="eyebrow">
        {index + 1} of {films.length} · {answered} answered
      </p>
      <h2>Let&rsquo;s find your kind of cinema.</h2>
      <Poster film={film} />
      <p className="muted">
        {film.title} <small>{film.year}</small>
      </p>
      <div className="row" role="group" aria-label="Your reaction to this film">
        <button
          aria-pressed={answers[film.id] === 'like'}
          onClick={() => pick('like')}
        >
          Like
        </button>
        <button
          aria-pressed={answers[film.id] === 'dislike'}
          onClick={() => pick('dislike')}
        >
          Dislike
        </button>
        <button
          aria-pressed={answers[film.id] === 'unseen'}
          onClick={() => pick('unseen')}
        >
          Haven&rsquo;t seen
        </button>
      </div>
      <div className="row">
        <button
          type="button"
          className="text-button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </button>
        {answered > 0 && (
          <button
            className="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError('');
              try {
                await result(
                  await api.POST('/v1/quiz', {
                    body: Object.entries(answers).map(([filmId, response]) => ({
                      film_id: Number(filmId),
                      response,
                    })),
                  })
                );
                onSaved?.();
                setTasteMap(await result(await api.GET('/v1/taste-map')));
              } catch (e) {
                setError(message(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Saving…' : 'Finish quiz'}
          </button>
        )}
        <button type="button" className="text-button" onClick={done}>
          I&rsquo;ll do this later
        </button>
      </div>
    </div>
  );
}
export function Onboarding({
  profile,
  suggestedUsername,
  suggestedName,
  done,
  skip,
}: {
  profile: Models['Profile'];
  suggestedUsername: string;
  suggestedName: string;
  done: () => void;
  skip: () => void;
}) {
  const [data, setData] = useState({
    username: suggestedUsername,
    name: profile.name || suggestedName,
  });
  const [usernameOk, setUsernameOk] = useState(false);
  return (
    <div className="stack">
      <p className="muted">
        Your username is public: it appears on reviews, lists, and your
        profile link. Your display name shows alongside it and can be changed
        anytime in Settings.
      </p>
      <MutationForm
        submit={async () =>
          result(
            await api.POST('/v1/me', {
              body: {
                username: data.username,
                name: data.name,
                bio: profile.bio,
                private: profile.private,
                resurface: profile.resurface,
              },
            })
          )
        }
        done={done}
        label="Continue"
        disabled={!usernameOk}
      >
        <label>
          Display name
          <input
            placeholder="Alex Morgan"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </label>
        <UsernameField
          value={data.username}
          onChange={(username) => setData({ ...data, username })}
          canSubmit={setUsernameOk}
        />
      </MutationForm>
      <button type="button" className="text-button" onClick={skip}>
        I&rsquo;ll do this later
      </button>
    </div>
  );
}
export function Diary({
  entries,
  ...p
}: Props & { entries: Models['Viewing'][] }) {
  return entries.length ? (
    <div className="diary">
      {entries.map((e) => (
        <article key={e.id}>
          <time>
            <strong>{e.watched_on.slice(8)}</strong>
            {new Date(e.watched_on + 'T12:00:00').toLocaleString('en', {
              month: 'short',
              year: 'numeric',
            })}
          </time>
          <Poster film={e.film} small />
          <div className="grow">
            <button
              className="title-link"
              onClick={() => go('film/' + e.film_id)}
            >
              {e.film.title}
            </button>
            <p className="muted">
              {e.film.year} {e.rewatch ? '· Rewatch' : ''}{' '}
              {e.private ? '· Private' : ''}{' '}
              {e.context ? '· ' + contextLabel(e.context) : ''}
            </p>
            <Stars rating={e.rating} />
            <p>{e.notes}</p>
            {e.feelings && e.feelings.length > 0 && (
              <div className="row">
                {e.feelings.map((feeling) => (
                  <span className="chip" key={feeling}>
                    {feeling}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="row">
            <button onClick={() => p.edit('log', e)}>Edit</button>
            <button
              className="text-button"
              onClick={async () => {
                if (
                  !confirm(
                    'Delete this viewing and its private memory? Opinion history is retained.'
                  )
                )
                  return;
                try {
                  result(
                    await api.DELETE('/v1/diary/{id}', {
                      params: { path: { id: e.id } },
                    })
                  );
                  p.refresh();
                } catch (x) {
                  p.notify(String(x));
                }
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="Your diary is waiting">
      Every viewing is a new entry. Start with the last film you watched.
    </Empty>
  );
}
export function Memories({
  memories,
  ...p
}: Props & { memories: Models['Memory'][] }) {
  return memories.length ? (
    <div className="memory-grid">
      {memories.map((m) => (
        <article className="memory-card" key={m.id}>
          <div className="row">
            <Poster film={m.film} small />
            <div>
              <span className="eyebrow">{m.watched_on} · Only you</span>
              <h3>{m.film.title}</h3>
              <span className="chip">{m.emotion || 'A moment remembered'}</span>
            </div>
          </div>
          <blockquote>{m.scene}</blockquote>
          <p>{m.context}</p>
          <small>{m.explanation}</small>
          <div className="row">
            <button onClick={() => p.edit('memory', m)}>Edit memory</button>
            <button
              className="text-button"
              onClick={async () => {
                if (!confirm('Permanently delete this memory?')) return;
                try {
                  result(
                    await api.DELETE('/v1/memories/{id}', {
                      params: { path: { id: m.id } },
                    })
                  );
                  p.refresh();
                } catch (x) {
                  p.notify(String(x));
                }
              }}
            >
              Delete memory
            </button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="A place for what stays with you">
      Add an optional memory when you log a film. Your moments, feelings, and
      viewing context remain private.
    </Empty>
  );
}
export function Timeline({
  opinions,
  comparisons,
  edit,
}: {
  opinions: Models['Opinion'][];
  comparisons: Models['Comparison'][];
  edit: Props['edit'];
}) {
  return opinions.length ? (
    <>
      <div className="comparison-grid">
        {comparisons.slice(0, 4).map(({ now, then }) => {
          return (
            <article key={now.film_id} className="comparison">
              <span className="eyebrow">Then me / Now me</span>
              <h3>{now.film.title}</h3>
              <div className="two-col">
                <div>
                  <small>{then.created_at.slice(0, 10)}</small>
                  <Stars rating={then.rating} />
                  <p>{then.reflection || 'First impression'}</p>
                </div>
                <div>
                  <small>{now.created_at.slice(0, 10)}</small>
                  <Stars rating={now.rating} />
                  <p>{now.reflection || 'A new perspective'}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="timeline">
        {opinions.map((o) => (
          <article key={o.id}>
            <span className="timeline-dot" />
            <time>{o.created_at.slice(0, 10)}</time>
            <div>
              <span className="eyebrow">{o.kind}</span>
              <h3>{o.film.title}</h3>
              <Stars rating={o.rating} />
              <p>{o.reflection || 'No written reflection'}</p>
              <button onClick={() => edit('opinion', o.film)}>
                Add a reflection
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  ) : (
    <Empty title="Let your taste evolve">
      Log a film, then revisit your opinion whenever it changes. A reflection
      never overwrites the past.
    </Empty>
  );
}
export function Lists({
  lists,
  userID,
  ...p
}: Props & { lists: Models['List'][]; userID?: string }) {
  return lists.length ? (
    <div className="lists-grid">
      {lists.map((l) => (
        <article className="list-card" key={l.id} id={'list-' + l.id}>
          <div className="list-posters">
            {l.items.slice(0, 4).map((f) => (
              <Poster key={f.id} film={f} small />
            ))}
          </div>
          <span className="eyebrow">
            By @{l.username} · {l.private ? 'Private' : 'Public'} ·{' '}
            {l.items.length} films
          </span>
          <h3>{l.title}</h3>
          <p>{l.description}</p>
          {l.ranked && (
            <ol>
              {l.items.map((f) => (
                <li key={f.id}>{f.title}</li>
              ))}
            </ol>
          )}
          <div className="row">
            <button
              aria-pressed={l.liked}
              onClick={async () => {
                try {
                  result(
                    await api.POST('/v1/list-like', {
                      body: { id: l.id, enabled: !l.liked },
                    })
                  );
                  p.refresh();
                } catch (e) {
                  p.notify(String(e));
                }
              }}
            >
              {l.liked ? 'Unlike' : 'Like'} · {l.likes}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  location.origin + location.pathname + '#lists/' + l.id
                );
                p.notify('List link copied');
              }}
            >
              Share list
            </button>
            {l.user_id === userID && (
              <>
                <button onClick={() => p.edit('list', l)}>Edit list</button>
                <button
                  onClick={async () => {
                    if (confirm('Delete this list?')) {
                      result(
                        await api.DELETE('/v1/lists/{id}', {
                          params: { path: { id: l.id } },
                        })
                      );
                      p.refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="Make a little collection">
      A favorite director. Rainy Sundays. Films that changed your mind.
    </Empty>
  );
}
export function People({
  people,
  ...p
}: Props & { people: Models['Person'][] }) {
  return (
    <div className="people-grid">
      {people.map((person) => (
        <article key={person.id} className="person">
          <div className="avatar">
            {(person.name || person.username).slice(0, 1).toUpperCase()}
          </div>
          <h3>
            <a href={'#profile/' + person.id}>
              {person.name || person.username}
            </a>
          </h3>
          <p className="muted">@{person.username}</p>
          <p>{person.bio || 'A life in films, still unfolding.'}</p>
          <small>
            {person.films} viewings · {person.followers} followers
          </small>
          <div className="row">
            <button
              onClick={async () => {
                try {
                  result(
                    await api.POST('/v1/follow', {
                      body: {
                        target_id: person.id,
                        enabled: !person.following,
                      },
                    })
                  );
                  p.refresh();
                } catch (x) {
                  p.notify(String(x));
                }
              }}
            >
              {person.following ? 'Unfollow' : 'Follow'}
            </button>
            <button
              className="text-button"
              onClick={async () => {
                if (
                  confirm(
                    'Block this person? Your content will be hidden from each other.'
                  )
                ) {
                  result(
                    await api.POST('/v1/block', {
                      body: { target_id: person.id },
                    })
                  );
                  p.refresh();
                }
              }}
            >
              Block
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
// GAP 17: Craft Mode is entirely optional — nothing here ever touches a
// review or opinion. `notes` is either "all notes for one film" (own +
// others' public ones, each carrying `username`) when rendered on a film
// page, or "my own notes across every film" (each carrying `film`) when
// rendered on the personal search page; a note never carries both.
export function CraftNotes({
  notes,
  refresh,
  notify,
  edit,
  userID,
}: {
  notes: Models['CraftNote'][];
  refresh: () => void;
  notify: (s: string) => void;
  edit: (n: Models['CraftNote']) => void;
  userID?: string;
}) {
  async function reveal(filmID: number) {
    try {
      await result(
        await api.POST('/v1/reveal', { body: { film_id: filmID, layer: 2 } })
      );
      refresh();
    } catch (e) {
      notify(message(e));
    }
  }
  async function remove(id: string) {
    if (!confirm('Delete this craft note?')) return;
    try {
      await result(
        await api.DELETE('/v1/craft/{id}', { params: { path: { id } } })
      );
      refresh();
    } catch (e) {
      notify(message(e));
    }
  }
  return notes.length ? (
    <div className="stack">
      {notes.map((n) => {
        const owner = userID === n.user_id;
        const hidden = n.spoiler && !owner && !n.allowed_spoiler;
        return (
          <article className="craft-note" key={n.id}>
            <div className="row">
              {n.film && <Poster film={n.film} small />}
              <div className="grow">
                <span className="eyebrow">
                  {craftCategoryLabel(n.category)}
                  {n.username && ' · @' + n.username}
                  {n.private && owner && ' · Private'}
                </span>
                {n.film && <h3>{n.film.title}</h3>}
                {hidden ? (
                  <div className="spoiler-gate">
                    <LockKeyhole size={18} />
                    <span>This note contains spoilers for this film.</span>
                    <button onClick={() => reveal(n.film_id)}>
                      Reveal spoilers
                    </button>
                  </div>
                ) : (
                  <>
                    {n.scene && <p className="review-text">{n.scene}</p>}
                    <p className="review-text">{n.body}</p>
                  </>
                )}
              </div>
            </div>
            {owner && (
              <div className="row">
                <button onClick={() => edit(n)}>Edit note</button>
                <button className="text-button" onClick={() => remove(n.id)}>
                  Delete note
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  ) : (
    <Empty title="Nothing here yet">
      Craft Mode is entirely optional — add a note on any film page when
      something about how it was made stands out to you.
    </Empty>
  );
}
// GAP 23: group theatrical planning. No $0-cost showtime provider exists
// (see backend/internal/catalog.ShowtimeProvider), so every plan runs on
// manually agreed-upon slots the group proposes themselves — never a
// scraped or invented showtime, never a booking confirmation.
export function TheatricalPlans() {
  const [plans, setPlans] = useState<Models['TheatricalPlan'][]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .GET('/v1/theatrical-plans')
      .then(result)
      .then(setPlans)
      .catch((e) => setError(message(e)));
  }, []);
  return (
    <div className="stack">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {plans.length ? (
        plans.map((p) => (
          <button
            key={p.id}
            className="craft-note"
            style={{ textAlign: 'left', width: '100%' }}
            onClick={() => go('plan/' + p.id)}
          >
            <div className="row">
              {p.film && <Poster film={p.film} small />}
              <div>
                <span className="eyebrow">
                  {p.status === 'planning'
                    ? 'Planning'
                    : p.status === 'decided'
                      ? 'Decided'
                      : 'Cancelled'}
                </span>
                {p.film && <h3>{p.film.title}</h3>}
                {p.note && <p className="muted">{p.note}</p>}
              </div>
            </div>
          </button>
        ))
      ) : (
        <Empty title="No plans yet">
          Start one from any film&rsquo;s page with &ldquo;Plan a group
          outing.&rdquo;
        </Empty>
      )}
    </div>
  );
}
export function PlanDetail({
  planID,
  userID,
  notify,
}: {
  planID: string;
  userID?: string;
  notify: (s: string) => void;
}) {
  const [plan, setPlan] = useState<Models['TheatricalPlan'] | null>(null);
  const [slots, setSlots] = useState<Models['PlanSlot'][]>([]);
  const [participants, setParticipants] = useState<
    Models['PlanParticipant'][]
  >([]);
  const [error, setError] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await result(
        await api.GET('/v1/theatrical-plans/{id}', {
          params: { path: { id: planID } },
        })
      );
      setPlan(d.plan);
      setSlots(d.slots);
      setParticipants(d.participants);
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planID]);

  async function act(f: () => Promise<unknown>) {
    setBusy(true);
    try {
      await f();
      await load();
    } catch (e) {
      notify(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!plan) return null;

  const isCreator = userID === plan.creator_id;
  const me = participants.find((p) => p.user_id === userID);
  const canVote = isCreator || me?.status === 'joined';
  const canRespond = !isCreator && me?.status === 'invited';
  const searchURL =
    'https://www.google.com/search?q=' +
    encodeURIComponent(
      (plan.film?.title || '') + ' showtimes near me'
    );

  return (
    <div className="stack">
      <div className="row">
        {plan.film && <Poster film={plan.film} small />}
        <div>
          <span className="eyebrow">
            {plan.status === 'planning'
              ? 'Planning'
              : plan.status === 'decided'
                ? 'Decided'
                : 'Cancelled'}
          </span>
          {plan.film && <h2>{plan.film.title}</h2>}
          {plan.note && <p className="muted">{plan.note}</p>}
        </div>
      </div>

      <div className="spoiler-gate">
        <span>
          Afterframe doesn&rsquo;t have a licensed showtime provider, so
          live showtimes aren&rsquo;t shown here — this is a manual planning
          space. Check real showtimes yourself before you go.
        </span>
        <a href={searchURL} target="_blank" rel="noreferrer">
          Find showtimes
        </a>
      </div>

      <h3>Proposed times</h3>
      {slots.length ? (
        <div className="stack">
          {slots.map((s) => (
            <div className="row" key={s.id}>
              <span className={s.id === plan.decided_slot_id ? 'chip' : ''}>
                {s.label}
                {s.id === plan.decided_slot_id && ' — decided'}
              </span>
              <span className="muted">{s.votes} vote{s.votes === 1 ? '' : 's'}</span>
              {canVote && plan.status === 'planning' && (
                <button
                  disabled={busy}
                  aria-pressed={s.voted}
                  onClick={() =>
                    act(() =>
                      api.POST('/v1/theatrical-plans/{id}/vote', {
                        params: { path: { id: planID } },
                        body: { slot_id: s.id, on: !s.voted },
                      })
                    )
                  }
                >
                  {s.voted ? 'Voted' : 'Vote'}
                </button>
              )}
              {isCreator && plan.status === 'planning' && (
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api.POST('/v1/theatrical-plans/{id}/decide', {
                        params: { path: { id: planID } },
                        body: { slot_id: s.id },
                      })
                    )
                  }
                >
                  Decide this one
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No proposed times yet.</p>
      )}
      {isCreator && plan.status === 'planning' && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slotLabel) return;
            act(async () => {
              await result(
                await api.POST('/v1/theatrical-plans/{id}/slots', {
                  params: { path: { id: planID } },
                  body: { label: slotLabel },
                })
              );
              setSlotLabel('');
            });
          }}
        >
          <label>
            <span className="sr-only">Proposed time</span>
            <input
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              placeholder="e.g. Friday 7:30pm"
            />
          </label>
          <button disabled={busy || !slotLabel}>Add time</button>
        </form>
      )}

      <h3>Who&rsquo;s in</h3>
      <div className="stack">
        {participants.map((p) => (
          <div className="row" key={p.user_id}>
            <span>@{p.username}</span>
            <span className="muted">{p.status}</span>
          </div>
        ))}
      </div>
      {canRespond && (
        <div className="row">
          <button
            disabled={busy}
            onClick={() =>
              act(() =>
                api.POST('/v1/theatrical-plans/{id}/respond', {
                  params: { path: { id: planID } },
                  body: { accept: true },
                })
              )
            }
          >
            Accept
          </button>
          <button
            disabled={busy}
            onClick={() =>
              act(() =>
                api.POST('/v1/theatrical-plans/{id}/respond', {
                  params: { path: { id: planID } },
                  body: { accept: false },
                })
              )
            }
          >
            Decline
          </button>
        </div>
      )}
      {isCreator && plan.status === 'planning' && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteUsername) return;
            act(async () => {
              await result(
                await api.POST('/v1/theatrical-plans/{id}/invite', {
                  params: { path: { id: planID } },
                  body: { username: inviteUsername },
                })
              );
              setInviteUsername('');
            });
          }}
        >
          <label>
            <span className="sr-only">Invite by username</span>
            <input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="username to invite"
            />
          </label>
          <button disabled={busy || !inviteUsername}>Invite</button>
        </form>
      )}
      {isCreator && plan.status === 'planning' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            if (!confirm('Cancel this plan?')) return;
            act(() =>
              api.POST('/v1/theatrical-plans/{id}/decide', {
                params: { path: { id: planID } },
                body: { cancel: true },
              })
            );
          }}
        >
          Cancel plan
        </button>
      )}
    </div>
  );
}
export function Settings({
  profile,
  done,
  signOut,
}: {
  profile: Models['Profile'];
  done: () => void;
  signOut: () => Promise<void>;
}) {
  const [data, setData] = useState(profile);
  const [usernameOk, setUsernameOk] = useState(true);
  return (
    <div className="settings">
      <MutationForm submit={signOut} done={() => {}} label="Sign out">
        <p className="muted">Signed in as {profile.name || profile.username}</p>
      </MutationForm>
      {isPlaceholderUsername(profile.username) && (
        <p className="notice">
          You&rsquo;re still using a generated username. Pick one below so
          people see a name, not an id.
        </p>
      )}
      <MutationForm
        submit={async () =>
          result(
            await api.POST('/v1/me', {
              body: {
                username: data.username,
                name: data.name,
                bio: data.bio,
                private: data.private,
                resurface: data.resurface,
                notify_availability: data.notify_availability,
                family_policy: data.family_policy,
                family_region: data.family_region,
              },
            })
          )
        }
        done={done}
        label="Save profile"
        disabled={!usernameOk}
      >
        <UsernameField
          value={data.username}
          onChange={(username) => setData({ ...data, username })}
          startingUsername={profile.username}
          canSubmit={setUsernameOk}
        />
        <label>
          Display name
          <input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </label>
        <label>
          Bio
          <textarea
            value={data.bio}
            onChange={(e) => setData({ ...data, bio: e.target.value })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={data.private}
            onChange={(e) => setData({ ...data, private: e.target.checked })}
          />
          Make my profile and social activity private
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={data.resurface}
            onChange={(e) => setData({ ...data, resurface: e.target.checked })}
          />
          Resurface my older memories privately
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={data.notify_availability}
            onChange={(e) =>
              setData({ ...data, notify_availability: e.target.checked })
            }
          />
          Notify me when a watchlisted film&rsquo;s streaming availability
          changes
        </label>
        <label>
          Family Mode
          <select
            value={data.family_policy}
            onChange={(e) =>
              setData({ ...data, family_policy: e.target.value })
            }
          >
            <option value="">Off</option>
            <option value="standard">
              Standard — general and teen audiences
            </option>
            <option value="strict">Strict — youngest audiences only</option>
          </select>
        </label>
        {data.family_policy && (
          <label>
            Region for certification data
            <select
              value={data.family_region}
              onChange={(e) =>
                setData({ ...data, family_region: e.target.value })
              }
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {data.family_policy && (
          <p className="muted">
            Family Mode filters Tonight Mode by certification data for your
            chosen region. Certification data is best-effort and genuinely
            incomplete for many films — anything without a clear, mapped
            rating is excluded, never assumed safe. This is a discovery
            filter, not a parental-control or child-account system.
          </p>
        )}
        <p className="muted">
          Memory Vault is always private. Your memories are never sent to an AI
          provider.
        </p>
      </MutationForm>
      <button onClick={() => go('quiz')}>
        {profile.quiz_completed_at
          ? 'Retake the taste quiz'
          : 'Take the taste quiz'}
      </button>
      <button onClick={() => go('taste-partners')}>Taste partners</button>
      <button onClick={() => go('import')}>Import from Letterboxd</button>
      <TribePicker />
      <MutedAccounts />
      <AccountControls done={done} />
    </div>
  );
}
// GAP 10: tribes are a fixed, product-curated list — no tribe-creation UI,
// since there's no user-generated tribe content to moderate. Membership is
// opt-in and never shown to anyone else: a regional/linguistic tribe can
// itself be a sensitive personal-identity signal.
function TribePicker() {
  const [tribes, setTribes] = useState<Models['Tribe'][]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      setTribes(await result(await api.GET('/v1/tribes')));
    } finally {
      setLoaded(true);
    }
  }

  if (!loaded) {
    return (
      <button type="button" className="text-button" onClick={load}>
        Show tribes
      </button>
    );
  }
  return (
    <div className="stack">
      <p className="muted">
        Tribes are optional and private — only you see which ones
        you&rsquo;ve joined. Joining one lets you compare a film&rsquo;s
        rating against that community&rsquo;s, alongside the global
        average.
      </p>
      <div className="row" role="group" aria-label="Tribes">
        {tribes.map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={t.joined}
            className={t.joined ? 'chip selected' : 'chip'}
            onClick={async () => {
              await result(
                await api.POST('/v1/tribes', {
                  body: { tribe: t.id, enabled: !t.joined },
                })
              );
              load();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
// GAP 14: muting is one-directional and private — unmuting here is the only
// way back, since a muted account is never told and can't see the mute.
function MutedAccounts() {
  const [muted, setMuted] = useState<Models['Profile'][]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      setMuted(await result(await api.GET('/v1/muted')));
    } finally {
      setLoaded(true);
    }
  }

  if (!loaded) {
    return (
      <button type="button" className="text-button" onClick={load}>
        Show muted accounts
      </button>
    );
  }
  if (muted.length === 0) {
    return <p className="muted">No muted accounts.</p>;
  }
  return (
    <div className="stack">
      <p className="muted">Muted accounts</p>
      {muted.map((p) => (
        <div className="row" key={p.id}>
          <span>@{p.username}</span>
          <button
            className="text-button"
            onClick={async () => {
              await result(
                await api.POST('/v1/mute', {
                  body: { target_id: p.id, enabled: false },
                })
              );
              load();
            }}
          >
            Unmute
          </button>
        </div>
      ))}
    </div>
  );
}

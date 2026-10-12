'use client';
import { useState, type FormEvent } from 'react';
import { api, result, type Models } from '@/lib/api';
import { supabase } from '@/lib/auth';
import { Rating, go, message } from './ui';
import {
  FEELINGS,
  VIEWING_CONTEXTS,
  REVIEW_TONES,
  CRAFT_CATEGORIES,
  VISIBILITY_OPTIONS,
} from '@/lib/vocab';
type Mutation = Models['Mutation'];
export function AuthForm({ done }: { done: () => void }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget),
      email = String(d.get('email')),
      password = String(d.get('password'));
    try {
      if (mode === 'reset') {
        const r = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + location.pathname,
        });
        if (r.error) throw r.error;
        setError('Check your email for the recovery link.');
      } else {
        const r =
          mode === 'signup'
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        if (r.data.session) done();
        else setError('Check your email to confirm your account.');
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      <p className="muted">A home for the films that stay with you.</p>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      {mode !== 'reset' && (
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
          />
        </label>
      )}
      <p role="status">{error}</p>
      <button className="primary" disabled={busy}>
        {busy
          ? 'Working…'
          : mode === 'signup'
            ? 'Create account'
            : mode === 'reset'
              ? 'Send recovery email'
              : 'Sign in'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signup' ? 'login' : 'signup');
          setError('');
        }}
      >
        {mode === 'signup'
          ? 'Already a member? Sign in'
          : 'New here? Create account'}
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => setMode('reset')}
      >
        Forgot password?
      </button>
      {process.env.NEXT_PUBLIC_AUTH_DIRECT !== 'true' ? (
        <button
          type="button"
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: location.origin + location.pathname },
            });
            if (error) setError(error.message);
          }}
        >
          Continue with Google
        </button>
      ) : (
        <small>
          Google OAuth is configured separately for the hosted Supabase project.
          This local test environment uses email.
        </small>
      )}
    </form>
  );
}
export function LogForm({
  film,
  entry,
  done,
}: {
  film: Models['Film'];
  entry?: Models['Viewing'];
  done: () => void;
}) {
  const [data, setData] = useState<Mutation>({
    film_id: film.id,
    watched_on: entry?.watched_on || new Date().toLocaleDateString('en-CA'),
    rating: entry?.rating ?? null,
    notes: entry?.notes || '',
    rewatch: entry?.rewatch || false,
    visibility: entry?.visibility || 'private',
    request_id: crypto.randomUUID(),
    id: entry?.id,
    scene: '',
    emotion: '',
    context: '',
    feelings: entry?.feelings || [],
    viewing_context: entry?.context || '',
  });
  return (
    <MutationForm
      submit={async () => result(await api.POST('/v1/diary', { body: data }))}
      done={done}
      label="Save viewing"
    >
      <p className="eyebrow">
        {film.title} · {film.year}
      </p>
      <div className="two-col">
        <label>
          Watched on
          <input
            aria-label="Watched on"
            type="date"
            required
            value={data.watched_on}
            onChange={(e) => setData({ ...data, watched_on: e.target.value })}
          />
        </label>
        <Rating
          value={data.rating ?? null}
          change={(rating) => setData({ ...data, rating })}
        />
      </div>
      <label>
        Who was this for? <small>optional</small>
        <select
          value={data.viewing_context}
          onChange={(e) =>
            setData({ ...data, viewing_context: e.target.value })
          }
        >
          {VIEWING_CONTEXTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Diary notes
        <textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
          placeholder="Anything you want to remember about this watch"
        />
      </label>
      <div>
        <span className="muted">
          How did it leave you feeling? <small>optional</small>
        </span>
        <div className="row" role="group" aria-label="Feelings">
          {FEELINGS.map((feeling) => {
            const selected = (data.feelings || []).includes(feeling);
            return (
              <button
                type="button"
                key={feeling}
                aria-pressed={selected}
                className={selected ? 'chip selected' : 'chip'}
                onClick={() =>
                  setData({
                    ...data,
                    feelings: selected
                      ? (data.feelings || []).filter((f) => f !== feeling)
                      : [...(data.feelings || []), feeling],
                  })
                }
              >
                {feeling}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row">
        <label className="check">
          <input
            type="checkbox"
            checked={data.rewatch}
            onChange={(e) => setData({ ...data, rewatch: e.target.checked })}
          />
          A rewatch
        </label>
      </div>
      <label>
        Who can see this
        <select
          value={data.visibility}
          onChange={(e) => setData({ ...data, visibility: e.target.value })}
        >
          {VISIBILITY_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>
          Add a private memory <span>optional</span>
        </summary>
        <p className="muted">
          Just for you. Capture the little things that make a film yours.
        </p>
        <label>
          A moment that stayed
          <input
            value={data.scene}
            onChange={(e) => setData({ ...data, scene: e.target.value })}
          />
        </label>
        <label>
          A feeling
          <input
            value={data.emotion}
            onChange={(e) => setData({ ...data, emotion: e.target.value })}
          />
        </label>
        <label>
          Where you were, who you were with
          <textarea
            value={data.context}
            onChange={(e) => setData({ ...data, context: e.target.value })}
          />
        </label>
      </details>
    </MutationForm>
  );
}
export function MutationForm({
  children,
  submit,
  done,
  label = 'Save',
  disabled = false,
}: {
  children: React.ReactNode;
  submit: () => Promise<unknown>;
  done: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || disabled) return;
        setBusy(true);
        setError('');
        try {
          await submit();
          done();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy || disabled}>
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
export function ReviewForm({
  film,
  review,
  done,
}: {
  film: Models['Film'];
  review?: Models['Review'];
  done: () => void;
}) {
  const [data, setData] = useState<Mutation>({
    id: review?.id,
    film_id: film.id,
    safe: review?.safe || '',
    watched: review?.watched || '',
    reflection: review?.reflection || '',
    tone: review?.tone || '',
  });
  return (
    <MutationForm
      submit={async () => result(await api.POST('/v1/reviews', { body: data }))}
      done={done}
      label="Publish review"
    >
      <p>{film.title}</p>
      <label>
        Before watching · spoiler-safe
        <textarea
          required
          value={data.safe}
          onChange={(e) => setData({ ...data, safe: e.target.value })}
          placeholder="The mood, the performances, why someone should see it…"
        />
      </label>
      <small>
        Keep plot details out of this section. Author labels are not a guarantee
        of spoiler-free writing.
      </small>
      <label>
        After watching · plot discussion
        <textarea
          value={data.watched}
          onChange={(e) => setData({ ...data, watched: e.target.value })}
        />
      </label>
      <label>
        After reflection · deeper interpretation
        <textarea
          value={data.reflection}
          onChange={(e) => setData({ ...data, reflection: e.target.value })}
        />
      </label>
      <label>
        How would you describe this review? <small>optional</small>
        <select
          value={data.tone}
          onChange={(e) => setData({ ...data, tone: e.target.value })}
        >
          {REVIEW_TONES.filter((t) => t.value !== '').map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="">Not specified</option>
        </select>
      </label>
    </MutationForm>
  );
}
export function OpinionForm({
  film,
  done,
}: {
  film: Models['Film'];
  done: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null),
    [reflection, setReflection] = useState('');
  return (
    <MutationForm
      submit={async () =>
        result(
          await api.POST('/v1/timeline', {
            body: { film_id: film.id, rating, reflection, kind: 'reflection' },
          })
        )
      }
      done={done}
      label="Save reflection"
    >
      <p>
        Changed your mind about <strong>{film.title}</strong>? Your earlier
        opinion stays in your history. No rewatch required.
      </p>
      <Rating value={rating} change={setRating} />
      <label>
        What changed?
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
        />
      </label>
    </MutationForm>
  );
}
export function MemoryForm({
  memory,
  done,
}: {
  memory: Models['Memory'];
  done: () => void;
}) {
  const [data, setData] = useState<Mutation>({
    viewing_id: memory.viewing_id,
    scene: memory.scene,
    emotion: memory.emotion,
    context: memory.context,
  });
  return (
    <MutationForm
      submit={async () =>
        result(await api.POST('/v1/memories', { body: data }))
      }
      done={done}
    >
      <label>
        Moment
        <textarea
          aria-label="Moment"
          value={data.scene}
          onChange={(e) => setData({ ...data, scene: e.target.value })}
        />
      </label>
      <label>
        Feeling
        <input
          value={data.emotion}
          onChange={(e) => setData({ ...data, emotion: e.target.value })}
        />
      </label>
      <label>
        Personal context
        <textarea
          value={data.context}
          onChange={(e) => setData({ ...data, context: e.target.value })}
        />
      </label>
    </MutationForm>
  );
}
export function CraftNoteForm({
  film,
  note,
  done,
}: {
  film: Models['Film'];
  note?: Models['CraftNote'];
  done: () => void;
}) {
  const [data, setData] = useState<Mutation>({
    id: note?.id,
    film_id: film.id,
    category: note?.category || '',
    scene: note?.scene || '',
    body: note?.body || '',
    spoiler: note?.spoiler || false,
    private: note ? note.private : true,
  });
  return (
    <MutationForm
      submit={async () => result(await api.POST('/v1/craft', { body: data }))}
      done={done}
      label="Save note"
      disabled={!data.category}
    >
      <p>{film.title}</p>
      <label>
        Category
        <select
          value={data.category}
          onChange={(e) => setData({ ...data, category: e.target.value })}
        >
          <option value="" disabled>
            Choose one…
          </option>
          {CRAFT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Scene (optional)
        <input
          value={data.scene}
          onChange={(e) => setData({ ...data, scene: e.target.value })}
          placeholder="e.g. the hallway fight, 00:42"
        />
      </label>
      <label>
        Observation
        <textarea
          value={data.body}
          onChange={(e) => setData({ ...data, body: e.target.value })}
          placeholder="What stood out — the choice, the technique, why it works…"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={data.spoiler}
          onChange={(e) => setData({ ...data, spoiler: e.target.checked })}
        />
        This note contains spoilers
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={data.private}
          onChange={(e) => setData({ ...data, private: e.target.checked })}
        />
        Private (only visible to you)
      </label>
    </MutationForm>
  );
}
// GAP 23: creating a plan always goes straight to its detail page, where
// the "no live showtimes" notice and manual-slots flow live.
export function CreatePlanForm({
  film,
  done,
}: {
  film: Models['Film'];
  done: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <MutationForm
      submit={async () => {
        const plan = await result(
          await api.POST('/v1/theatrical-plans', {
            body: { film_id: film.id, note },
          })
        );
        go('plan/' + plan.id);
        return plan;
      }}
      done={done}
      label="Create plan"
    >
      <p>{film.title}</p>
      <label>
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who's in, what night works, anything else to add…"
        />
      </label>
    </MutationForm>
  );
}
export function ListForm({
  list,
  done,
}: {
  list?: Models['List'];
  done: () => void;
}) {
  const [data, setData] = useState<Mutation>({
    id: list?.id,
    title: list?.title || '',
    description: list?.description || '',
    private: list?.private || false,
    ranked: list?.ranked || false,
  });
  const [items, setItems] = useState<Models['Film'][]>(list?.items || []),
    [query, setQuery] = useState(''),
    [films, setFilms] = useState<Models['Film'][]>([]),
    [error, setError] = useState('');
  return (
    <MutationForm
      submit={async () =>
        result(
          await api.POST('/v1/lists', {
            body: { ...data, film_ids: items.map((x) => x.id) },
          })
        )
      }
      done={done}
      label="Save list"
    >
      <label>
        List title
        <input
          required
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
      </label>
      <div className="row">
        <label className="check">
          <input
            type="checkbox"
            checked={data.private}
            onChange={(e) => setData({ ...data, private: e.target.checked })}
          />
          Private
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={data.ranked}
            onChange={(e) => setData({ ...data, ranked: e.target.checked })}
          />
          Ranked
        </label>
      </div>
      <label>
        Find a film for this list
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={async () => {
          try {
            setFilms(
              result(
                await api.GET('/v1/films', { params: { query: { q: query } } })
              )
            );
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        Search films for list
      </button>
      {error && <p role="alert">{error}</p>}
      <div className="list-search">
        {films.slice(0, 5).map((f) => (
          <button
            type="button"
            key={f.id}
            disabled={items.some((x) => x.id === f.id)}
            onClick={() => setItems([...items, f])}
          >
            Add {f.title} ({f.year})
          </button>
        ))}
      </div>
      <ol>
        {items.map((f, i) => (
          <li key={f.id} className="list-edit-row">
            <span>
              {i + 1}. {f.title}
            </span>
            <button
              type="button"
              disabled={i === 0}
              aria-label={'Move ' + f.title + ' up'}
              onClick={() => {
                const n = [...items];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                setItems(n);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={'Remove ' + f.title}
              onClick={() => setItems(items.filter((x) => x.id !== f.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </MutationForm>
  );
}

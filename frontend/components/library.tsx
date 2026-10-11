'use client';
import { useState } from 'react';
import { api, result, type Models } from '@/lib/api';
import { Empty, Poster, Stars, go } from './ui';
import { MutationForm } from './forms';
import AccountControls from './account';
type Props = {
  refresh: () => void;
  edit: (kind: string, value: unknown) => void;
  notify: (s: string) => void;
};
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
              {e.private ? '· Private' : ''}
            </p>
            <Stars rating={e.rating} />
            <p>{e.notes}</p>
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
export function Settings({
  profile,
  done,
}: {
  profile: Models['Profile'];
  done: () => void;
}) {
  const [data, setData] = useState(profile);
  return (
    <div className="settings">
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
              },
            })
          )
        }
        done={done}
        label="Save profile"
      >
        <label>
          Username
          <input
            required
            pattern="[a-z0-9_]{3,30}"
            value={data.username}
            onChange={(e) => setData({ ...data, username: e.target.value })}
          />
        </label>
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
        <p className="muted">
          Memory Vault is always private. Your memories are never sent to an AI
          provider.
        </p>
      </MutationForm>
      <AccountControls done={done} />
    </div>
  );
}

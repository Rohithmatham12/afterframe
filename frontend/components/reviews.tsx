'use client';
import { useState } from 'react';
import { LockKeyhole, Heart, MessageCircle } from 'lucide-react';
import { api, result, type Models } from '@/lib/api';
import { Empty, Poster, message } from './ui';
export function Reviews({
  reviews,
  refresh,
  notify,
  userID,
  edit,
}: {
  reviews: Models['Review'][];
  refresh: () => void;
  notify: (s: string) => void;
  userID?: string;
  edit: (r: Models['Review']) => void;
}) {
  return reviews.length ? (
    <div className="reviews">
      {reviews.map((r) => (
        <Review
          key={r.id}
          review={r}
          refresh={refresh}
          notify={notify}
          owner={userID === r.user_id}
          edit={() => edit(r)}
        />
      ))}
    </div>
  ) : (
    <Empty title="Start a conversation">
      Write a spoiler-safe review, or follow someone whose taste you trust.
    </Empty>
  );
}
function Review({
  review: r,
  refresh,
  notify,
  owner,
  edit,
}: {
  review: Models['Review'];
  refresh: () => void;
  notify: (s: string) => void;
  owner: boolean;
  edit: () => void;
}) {
  const [comments, setComments] = useState<Models['Comment'][] | null>(null),
    [body, setBody] = useState(''),
    [layer, setLayer] = useState(1);
  async function act(f: () => Promise<unknown>) {
    try {
      await f();
      refresh();
    } catch (e) {
      notify(message(e));
    }
  }
  return (
    <article className="review">
      <Poster film={r.film} small />
      <div className="grow">
        <span className="eyebrow">
          @{r.username} · {new Date(r.created_at).toLocaleDateString()}
        </span>
        <h3>
          {r.film.title} <small>{r.film.year}</small>
        </h3>
        <span className="chip safe">
          <LockKeyhole size={12} />
          Before watching
        </span>
        <p className="review-text">{r.safe}</p>
        {r.watched !== undefined ? (
          <section>
            <span className="eyebrow">After watching</span>
            <p className="review-text">
              {r.watched || 'No post-watch discussion yet.'}
            </p>
          </section>
        ) : (
          <div className="spoiler-gate">
            <LockKeyhole size={18} />
            <span>There’s more here. Save the story for later.</span>
            <button
              onClick={() => {
                if (
                  confirm(
                    'Reveal plot details for this film? This preference will be saved.'
                  )
                )
                  act(async () =>
                    result(
                      await api.POST('/v1/reveal', {
                        body: { film_id: r.film_id, layer: 2 },
                      })
                    )
                  );
              }}
            >
              Reveal spoilers
            </button>
          </div>
        )}
        {r.reflection !== undefined ? (
          <section>
            <span className="eyebrow">After reflection</span>
            <p className="review-text">
              {r.reflection || 'Room for another perspective.'}
            </p>
          </section>
        ) : (
          r.allowed_layer >= 2 && (
            <button
              onClick={() =>
                act(async () =>
                  result(
                    await api.POST('/v1/reveal', {
                      body: { film_id: r.film_id, layer: 3 },
                    })
                  )
                )
              }
            >
              Open deeper reflection
            </button>
          )
        )}
        <div className="review-actions">
          <button
            aria-pressed={r.liked}
            onClick={() =>
              act(async () =>
                result(
                  await api.POST('/v1/like', {
                    body: { id: r.id, enabled: !r.liked },
                  })
                )
              )
            }
          >
            <Heart size={16} fill={r.liked ? 'currentColor' : 'none'} />
            {r.likes}
          </button>
          <button
            onClick={async () => {
              try {
                setComments(
                  result(
                    await api.GET('/v1/comments/{id}', {
                      params: { path: { id: r.id } },
                    })
                  )
                );
              } catch (e) {
                notify(message(e));
              }
            }}
          >
            <MessageCircle size={16} />
            Discussion
          </button>
          {owner && (
            <>
              <button onClick={edit}>Edit review</button>
              <button
                onClick={() => {
                  if (confirm('Delete this review?'))
                    act(async () =>
                      result(
                        await api.DELETE('/v1/reviews/{id}', {
                          params: { path: { id: r.id } },
                        })
                      )
                    );
                }}
              >
                Delete review
              </button>
            </>
          )}
          <button
            className="text-button"
            onClick={() => {
              const reason = prompt('Why are you reporting this review?');
              if (reason)
                act(async () => {
                  result(
                    await api.POST('/v1/report', {
                      body: { subject: r.id, reason },
                    })
                  );
                  notify('Report submitted for review');
                });
            }}
          >
            Report
          </button>
        </div>
        {comments && (
          <section className="discussion">
            {comments.map((c) => (
              <p key={c.id}>
                <strong>@{c.username}</strong> <small>Layer {c.layer}</small>
                <br />
                {c.body}
              </p>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await act(async () =>
                  result(
                    await api.POST('/v1/comments', {
                      body: { id: r.id, body, layer },
                    })
                  )
                );
                setBody('');
                setComments(
                  result(
                    await api.GET('/v1/comments/{id}', {
                      params: { path: { id: r.id } },
                    })
                  )
                );
              }}
            >
              <label>
                Comment
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <label>
                Discussion layer
                <select
                  value={layer}
                  onChange={(e) => setLayer(Number(e.target.value))}
                >
                  {Array.from({ length: r.allowed_layer }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {
                          [
                            'Before watching',
                            'After watching',
                            'After reflection',
                          ][n - 1]
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
              <button>Post comment</button>
            </form>
          </section>
        )}
      </div>
    </article>
  );
}

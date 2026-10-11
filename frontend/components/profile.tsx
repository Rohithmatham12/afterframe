'use client';
import { useEffect, useState } from 'react';
import { api, result, type Models } from '@/lib/api';
import { Poster, Stars, message } from './ui';
export default function ProfileView({
  id,
  notify,
}: {
  id: string;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<Models['ProfileDetails'] | null>(null),
    [network, setNetwork] = useState<Models['Profile'][]>([]);
  useEffect(() => {
    api
      .GET('/v1/profile', { params: { query: { user_id: id } } })
      .then(result)
      .then(setData)
      .catch((e) => notify(message(e)));
  }, [id, notify]);
  if (!data) return <p role="status">Loading profile…</p>;
  return (
    <>
      <section className="person">
        <div className="avatar">
          {data.avatar ? (
            <img src={data.avatar} alt="" />
          ) : (
            data.username[0].toUpperCase()
          )}
        </div>
        <h2>{data.name || data.username}</h2>
        <p>@{data.username}</p>
        <p>{data.bio}</p>
        <div className="row">
          <span>{data.viewings} viewings</span>
          {(['followers', 'following'] as const).map((kind) => (
            <button
              key={kind}
              onClick={async () => {
                try {
                  setNetwork(
                    result(
                      await api.GET(
                        kind === 'followers'
                          ? '/v1/followers'
                          : '/v1/following',
                        { params: { query: { user_id: id } } }
                      )
                    )
                  );
                } catch (e) {
                  notify(message(e));
                }
              }}
            >
              {data[kind]} {kind}
            </button>
          ))}
        </div>
        {network.map((p) => (
          <a className="network-link" key={p.id} href={'#profile/' + p.id}>
            @{p.username}{' '}
          </a>
        ))}
      </section>
      <h2>Recent diary</h2>
      <div className="film-grid">
        {data.diary.map((v) => (
          <article key={v.id}>
            <Poster film={v.film} />
            <Stars rating={v.rating} />
            <small>{v.watched_on}</small>
            <p>{v.notes}</p>
          </article>
        ))}
      </div>
    </>
  );
}

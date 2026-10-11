'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Compass,
  Film,
  History,
  List,
  LockKeyhole,
  Plus,
  Search,
  Settings as SettingsIcon,
  Users,
  Vault,
  LogOut,
} from 'lucide-react';
import { api, result, setToken, type Models } from '@/lib/api';
import { supabase } from '@/lib/auth';
import dynamic from 'next/dynamic';
const AuthForm = dynamic(() => import('./forms').then((m) => m.AuthForm));
const ListForm = dynamic(() => import('./forms').then((m) => m.ListForm));
const LogForm = dynamic(() => import('./forms').then((m) => m.LogForm));
const MemoryForm = dynamic(() => import('./forms').then((m) => m.MemoryForm));
const OpinionForm = dynamic(() => import('./forms').then((m) => m.OpinionForm));
const ReviewForm = dynamic(() => import('./forms').then((m) => m.ReviewForm));
const Diary = dynamic(() => import('./library').then((m) => m.Diary));
const Lists = dynamic(() => import('./library').then((m) => m.Lists));
const Memories = dynamic(() => import('./library').then((m) => m.Memories));
const People = dynamic(() => import('./library').then((m) => m.People));
const Settings = dynamic(() => import('./library').then((m) => m.Settings));
const Timeline = dynamic(() => import('./library').then((m) => m.Timeline));
const Reviews = dynamic(() => import('./reviews').then((m) => m.Reviews));
const ProfileView = dynamic(() => import('./profile'));
import { Empty, Modal, Poster, go, message } from './ui';
type Dialog = { kind: string; value?: unknown } | null;
const navigation = [
  ['discover', 'Discover', Compass],
  ['diary', 'Your diary', Film],
  ['watchlist', 'Watchlist', Bookmark],
  ['lists', 'Lists', List],
  ['feed', 'Following', Users],
  ['memories', 'Memory Vault', Vault],
  ['timeline', 'Taste Timeline', History],
] as const;
const titles: Record<string, [string, string]> = {
  discover: [
    'A world worth watching.',
    'Find your next favorite. Keep what stays with you.',
  ],
  diary: [
    'Your life, in films.',
    'Every viewing, every rewatch, every little revelation.',
  ],
  watchlist: [
    'For another night.',
    'A little anticipation is part of the experience.',
  ],
  lists: ['Good films, together.', 'Collections with a point of view.'],
  feed: ['In good company.', 'What the people you follow are thinking about.'],
  memories: [
    'Some films never leave.',
    'Your private collection of moments, feelings, and places.',
  ],
  timeline: [
    'You’re allowed to change.',
    'Your opinions evolve. Your history stays.',
  ],
  people: [
    'Find your kind of film people.',
    'Different perspectives. A shared love of cinema.',
  ],
  notifications: [
    'The conversation continues.',
    'Real activity from your film community.',
  ],
  settings: [
    'Make yourself at home.',
    'Your profile, your privacy, your preferences.',
  ],
};
export default function Cinema({
  initialFilms = [],
}: {
  initialFilms?: Models['Film'][];
}) {
  const [route, setRoute] = useState('discover'),
    [session, setSession] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [profile, setProfile] = useState<Models['Profile'] | null>(null),
    [dialog, setDialog] = useState<Dialog>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [section, setSection] = useState('popular'),
    [page, setPage] = useState(1),
    [month, setMonth] = useState('');
  const [films, setFilms] = useState<Models['Film'][]>(initialFilms),
    [film, setFilm] = useState<Models['Film'] | null>(null),
    [diary, setDiary] = useState<Models['Viewing'][]>([]),
    [memories, setMemories] = useState<Models['Memory'][]>([]),
    [resurfaced, setResurfaced] = useState<Models['Memory'][]>([]),
    [opinions, setOpinions] = useState<Models['Opinion'][]>([]),
    [comparisons, setComparisons] = useState<Models['Comparison'][]>([]),
    [filmState, setFilmState] = useState<Models['FilmState'] | null>(null),
    [reviews, setReviews] = useState<Models['Review'][]>([]),
    [lists, setLists] = useState<Models['List'][]>([]),
    [people, setPeople] = useState<Models['Person'][]>([]),
    [notifications, setNotifications] = useState<Models['Notification'][]>([]);
  const area = route.split('/')[0],
    routeID = route.split('/')[1];
  const refresh = () => setRevision((n) => n + 1);
  const notify = useCallback((s: string) => setToast(s), []);
  const edit = (kind: string, value?: unknown) => setDialog({ kind, value });
  const done = () => {
    setDialog(null);
    setToast('Saved. A little more of your story.');
    refresh();
  };
  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    const hash = () => {
      if (location.hash === '#main') {
        document.getElementById('main')?.focus();
        return;
      }
      setReviews([]);
      setFilm(null);
      setFilmState(null);
      setRoute(location.hash.slice(1) || 'discover');
      setQuery('');
      setSearch('');
      setPage(1);
      window.scrollTo(0, 0);
    };
    hash();
    window.addEventListener('hashchange', hash);
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '');
      setSession(data.session?.user.id || null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setToken(s?.access_token || '');
      if (!s) {
        setDiary([]);
        setMemories([]);
        setResurfaced([]);
        setOpinions([]);
        setComparisons([]);
        setReviews([]);
        setLists([]);
        setPeople([]);
        setNotifications([]);
        setFilmState(null);
      }
      setSession(s?.user.id || null);
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setDialog({ kind: 'password' });
    });
    return () => {
      window.removeEventListener('hashchange', hash);
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (session)
      api
        .GET('/v1/me')
        .then(result)
        .then(setProfile)
        .catch((e) => setError(message(e)));
    else setProfile(null);
  }, [session, revision]);
  useEffect(() => {
    let live = true;
    if (!ready) return;
    setLoading(area !== 'discover' || films.length === 0);
    setError('');
    async function load() {
      if (area === 'discover') {
        const data = result(
          await api.GET('/v1/films', {
            params: { query: { q: search, section, page } },
          })
        );
        if (live) setFilms(data);
      } else if (area === 'film') {
        const data = result(
          await api.GET('/v1/films/{id}', { params: { path: { id: routeID } } })
        );
        if (live) setFilm(data);
        if (session) {
          const [r, t, c, state] = await Promise.all([
            api.GET('/v1/reviews', {
              params: { query: { film_id: Number(routeID) } },
            }),
            api.GET('/v1/timeline', {
              params: { query: { film_id: Number(routeID) } },
            }),
            api.GET('/v1/insights', {
              params: { query: { film_id: Number(routeID) } },
            }),
            api.GET('/v1/film-state', {
              params: { query: { film_id: Number(routeID) } },
            }),
          ]);
          if (live) {
            setReviews(result(r));
            setOpinions(result(t));
            setComparisons(result(c));
            setFilmState(result(state));
          }
        }
      } else if (session) {
        switch (area) {
          case 'diary': {
            const d = result(
              await api.GET('/v1/diary', {
                params: { query: { month, offset: (page - 1) * 50 } },
              })
            );
            if (live) setDiary(d);
            break;
          }
          case 'watchlist': {
            const d = result(
              await api.GET('/v1/watchlist', {
                params: { query: { offset: (page - 1) * 50 } },
              })
            );
            if (live) setFilms(d.map((x) => x.film));
            break;
          }
          case 'memories': {
            const [d, r] = await Promise.all([
              api.GET('/v1/memories', { params: { query: { q: search } } }),
              api.GET('/v1/resurface'),
            ]);
            if (live) {
              setMemories(result(d));
              setResurfaced(result(r));
            }
            break;
          }
          case 'timeline': {
            const [d, c] = await Promise.all([
              api.GET('/v1/timeline'),
              api.GET('/v1/insights'),
            ]);
            if (live) {
              setOpinions(result(d));
              setComparisons(result(c));
            }
            break;
          }
          case 'lists': {
            const d = result(
              await api.GET('/v1/lists', {
                params: {
                  query: {
                    id: routeID || '',
                    offset: routeID ? 0 : (page - 1) * 30,
                  },
                },
              })
            );
            if (live) setLists(d);
            break;
          }
          case 'feed': {
            const d = result(
              await api.GET('/v1/feed', {
                params: { query: { offset: (page - 1) * 30 } },
              })
            );
            if (live) setReviews(d);
            break;
          }
          case 'people': {
            const d = result(
              await api.GET('/v1/people', { params: { query: { q: search } } })
            );
            if (live) setPeople(d.filter((x) => x.id !== session));
            break;
          }
          case 'notifications': {
            const d = result(await api.GET('/v1/notifications'));
            if (live) setNotifications(d);
            break;
          }
        }
      }
    }
    load()
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [area, routeID, session, ready, revision, search, section, page, month]);
  function requireAuth(kind: string, value?: unknown) {
    if (!session) edit('auth');
    else edit(kind, value);
  }
  const props = { refresh, edit, notify };
  const protectedArea = !['discover', 'film', 'credits'].includes(area);
  const title = titles[area] || ['A little perspective.', ''];
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#discover">
          <span className="brand-mark">a</span>afterframe
          <span className="brand-period">.</span>
        </a>
        <div className="top-links">
          <a href="#discover">Films</a>
          <a href="#people">People</a>
          <a href="#lists">Lists</a>
        </div>
        <div className="top-actions">
          <details className="mobile-menu">
            <summary>More</summary>
            <nav aria-label="More navigation">
              <a href="#people">People</a>
              <a href="#feed">Following</a>
              <a href="#lists">Lists</a>
              <a href="#settings">Settings</a>
              {session && (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    go('discover');
                  }}
                >
                  Sign out
                </button>
              )}
            </nav>
          </details>
          {session ? (
            <>
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => go('notifications')}
              >
                <Bell size={19} />
              </button>
              <button
                className="avatar small"
                aria-label="Profile and settings"
                onClick={() => go('settings')}
              >
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="" />
                ) : (
                  (profile?.name || profile?.username || 'A')
                    .slice(0, 1)
                    .toUpperCase()
                )}
              </button>
            </>
          ) : (
            <button onClick={() => edit('auth')}>Sign in</button>
          )}
          <button
            className="primary log-button"
            onClick={() => {
              if (!session) edit('auth');
              else {
                go('discover');
                notify('Choose a film to log your viewing.');
              }
            }}
          >
            <Plus size={17} />
            Log a film
          </button>
        </div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <span className="eyebrow">Your picture of cinema</span>
          <nav aria-label="Main navigation">
            {navigation.map(([key, label, Icon], i) => (
              <a
                key={key}
                className={
                  (area === key ? 'active ' : '') + (i === 5 ? 'nav-break' : '')
                }
                href={'#' + key}
              >
                <Icon size={19} />
                {label}
                {key === 'memories' && <span className="new-dot" />}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <p>
              Not just what you watched.
              <br />
              <em>What you felt.</em>
            </p>
            <a href="#settings">
              <SettingsIcon size={17} />
              Settings
            </a>
            <a href="#credits">
              About & credits <ArrowUpRight size={14} />
            </a>
            {session && (
              <button
                className="text-button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  go('discover');
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            )}
          </div>
        </aside>
        <main id="main" tabIndex={-1}>
          {area === 'discover' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE NEXT CHAPTER</span>
                  <h1>{title[0]}</h1>
                  <p>{title[1]}</p>
                </div>
                <span className="edition">
                  A FILM JOURNAL
                  <br />
                  MADE PERSONAL
                </span>
              </div>
              {!search && films[0] && (
                <section className="hero">
                  {films[0].backdrop && (
                    <img
                      src={
                        'https://image.tmdb.org/t/p/w780' + films[0].backdrop
                      }
                      alt=""
                      fetchPriority="high"
                      width={1280}
                      height={720}
                    />
                  )}
                  <div className="hero-shade" />
                  <div className="hero-copy">
                    <span className="eyebrow">
                      IN THE SPOTLIGHT · {films[0].year}
                    </span>
                    <h2>{films[0].title}</h2>
                    <p>
                      {films[0].overview.slice(0, 180)}
                      {films[0].overview.length > 180 ? '…' : ''}
                    </p>
                    <button
                      className="light-button"
                      onClick={() => go('film/' + films[0].id)}
                    >
                      Meet the film <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <span className="hero-note">Stories worth sitting with.</span>
                </section>
              )}
            </>
          )}
          {area !== 'discover' && area !== 'film' && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {area === 'memories'
                    ? 'ONLY YOU · ALWAYS PRIVATE'
                    : 'YOUR AFTERFRAME'}
                </span>
                <h1>{title[0]}</h1>
                <p>{title[1]}</p>
              </div>
              {area === 'lists' && session && (
                <button className="primary" onClick={() => edit('list')}>
                  <Plus size={16} />
                  Create list
                </button>
              )}
            </div>
          )}
          {protectedArea && !session ? (
            <div className="welcome">
              <LockKeyhole />
              <h2>Your story starts here.</h2>
              <p>
                Sign in to keep a diary, remember the details, and find your
                film people.
              </p>
              <button className="primary" onClick={() => edit('auth')}>
                Sign in or create account
              </button>
            </div>
          ) : (
            <>
              {['discover', 'memories', 'people'].includes(area) && (
                <div className="toolbar">
                  {area === 'discover' && (
                    <div
                      className="tabs"
                      role="group"
                      aria-label="Film discovery category"
                    >
                      {['popular', 'trending', 'recent'].map((s) => (
                        <button
                          key={s}
                          aria-pressed={section === s}
                          onClick={() => {
                            setSection(s);
                            setPage(1);
                          }}
                        >
                          {s === 'popular'
                            ? 'Popular this week'
                            : s === 'trending'
                              ? 'Trending'
                              : 'Now playing'}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="search">
                    <Search size={18} />
                    <span className="sr-only">
                      {area === 'memories'
                        ? 'Search your memories'
                        : area === 'people'
                          ? 'Search people'
                          : 'Search films'}
                    </span>
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder={
                        area === 'memories'
                          ? 'A feeling, a scene, a half-remembered night…'
                          : area === 'people'
                            ? 'Find a film person…'
                            : 'Find a film…'
                      }
                    />
                  </label>
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                  <button onClick={refresh}>Retry</button>
                </div>
              )}
              {loading && (
                <p className="loading" role="status">
                  Finding your next frame…
                </p>
              )}
              {(area === 'discover' || area === 'watchlist') && !loading && (
                <>
                  {films.length ? (
                    <div className="film-grid">
                      {films.map((f) => (
                        <div key={f.id}>
                          <Poster film={f} />
                          {area === 'watchlist' && (
                            <button
                              className="text-button"
                              onClick={async () => {
                                try {
                                  result(
                                    await api.POST('/v1/watchlist', {
                                      body: { film_id: f.id, enabled: false },
                                    })
                                  );
                                  refresh();
                                } catch (e) {
                                  notify(message(e));
                                }
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !error && (
                      <Empty
                        title={
                          search
                            ? 'No films found'
                            : 'A few good films for later'
                        }
                      />
                    )
                  )}
                </>
              )}
              {area === 'discover' && !search && (
                <section className="feature-strip">
                  <a href="#memories">
                    <Vault />
                    <div>
                      <span className="eyebrow">MEMORY VAULT</span>
                      <h3>Remember more than the title.</h3>
                      <p>The scene. The feeling. The person beside you.</p>
                    </div>
                    <ArrowUpRight />
                  </a>
                  <a href="#timeline">
                    <History />
                    <div>
                      <span className="eyebrow">TASTE TIMELINE</span>
                      <h3>A new you. A different film.</h3>
                      <p>Keep the past. Make room for a new perspective.</p>
                    </div>
                    <ArrowUpRight />
                  </a>
                </section>
              )}
              {area === 'film' && film && (
                <>
                  <section className="film-detail">
                    <Poster film={film} />
                    <div>
                      <span className="eyebrow">
                        {film.year} · {film.runtime || '—'} MINUTES
                      </span>
                      <h1>{film.title}</h1>
                      <p className="director">
                        {film.director ? 'Directed by ' + film.director : ''}
                      </p>
                      <div className="row">
                        {film.genres.map((g) => (
                          <span className="chip" key={g}>
                            {g}
                          </span>
                        ))}
                      </div>
                      <p>{film.overview}</p>
                      <details>
                        <summary>Cast &amp; crew</summary>
                        <h2>Cast</h2>
                        {film.cast_members?.map((c, i) => (
                          <p key={i}>
                            <strong>{c.name}</strong> · {c.role}
                          </p>
                        ))}
                        <h2>Crew</h2>
                        {film.crew?.map((c, i) => (
                          <p key={i}>
                            <strong>{c.name}</strong> · {c.role}
                          </p>
                        ))}
                      </details>
                      {session && filmState && (
                        <p className="chip">
                          Your current rating: {filmState.rating ?? 'Unrated'} ·{' '}
                          {filmState.viewings} viewings
                        </p>
                      )}
                      <div className="row">
                        <button
                          className="primary"
                          onClick={() => requireAuth('log', film)}
                        >
                          <Plus size={16} />
                          Log this film
                        </button>
                        <button
                          onClick={async () => {
                            if (!session) {
                              edit('auth');
                              return;
                            }
                            try {
                              result(
                                await api.POST('/v1/watchlist', {
                                  body: {
                                    film_id: film.id,
                                    enabled: true,
                                    private: profile?.private || false,
                                  },
                                })
                              );
                              notify('Added to your watchlist');
                            } catch (e) {
                              notify(message(e));
                            }
                          }}
                        >
                          <Bookmark size={16} />
                          Watchlist
                        </button>
                        <button onClick={() => requireAuth('review', film)}>
                          Write review
                        </button>
                        <button onClick={() => requireAuth('opinion', film)}>
                          Reflect
                        </button>
                      </div>
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>A little perspective</h2>
                    <span className="chip safe">
                      <LockKeyhole size={14} />
                      Spoiler-safe by default
                    </span>
                  </div>
                  {session ? (
                    <>
                      <Reviews
                        reviews={reviews}
                        refresh={refresh}
                        notify={notify}
                        userID={session}
                        edit={(r) => edit('review', r)}
                      />
                      {opinions.length > 0 && (
                        <>
                          <h2>Your opinion history</h2>
                          <Timeline
                            opinions={opinions}
                            comparisons={comparisons}
                            edit={edit}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <button onClick={() => edit('auth')}>
                      Sign in to join the discussion
                    </button>
                  )}
                </>
              )}
              {area === 'diary' && (
                <>
                  <div className="toolbar">
                    <label>
                      Month
                      <input
                        type="month"
                        value={month}
                        onChange={(e) => {
                          setMonth(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <span className="muted">
                      Viewing dates stay in the day you chose.
                    </span>
                  </div>
                  <Diary entries={diary} {...props} />
                </>
              )}
              {area === 'memories' && (
                <>
                  {!search && resurfaced.length > 0 && (
                    <section>
                      <div className="section-heading">
                        <h2>Memories, revisited</h2>
                        <span className="eyebrow">FROM AN EARLIER CHAPTER</span>
                      </div>
                      <Memories memories={resurfaced} {...props} />
                    </section>
                  )}
                  <div className="section-heading">
                    <h2>
                      {search ? 'What came back' : 'Your memory collection'}
                    </h2>
                    <small>Full-text & fuzzy search · No AI processing</small>
                  </div>
                  <Memories memories={memories} {...props} />
                </>
              )}
              {area === 'timeline' && (
                <Timeline
                  opinions={opinions}
                  comparisons={comparisons}
                  edit={edit}
                />
              )}
              {area === 'lists' && (
                <Lists lists={lists} userID={session || undefined} {...props} />
              )}
              {area === 'people' && <People people={people} {...props} />}
              {area === 'feed' && (
                <>
                  <div className="toolbar">
                    <span>Thoughts from your circle, safely shared.</span>
                    <button onClick={() => go('people')}>
                      Find people <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <Reviews
                    reviews={reviews}
                    refresh={refresh}
                    notify={notify}
                    userID={session || undefined}
                    edit={(r) => edit('review', r)}
                  />
                </>
              )}
              {area === 'profile' && (
                <ProfileView key={routeID} id={routeID} notify={notify} />
              )}
              {area === 'settings' && profile && (
                <Settings
                  key={profile.id}
                  profile={profile}
                  signOut={async () => {
                    const { error } = await supabase.auth.signOut();
                    if (error) throw error;
                    go('discover');
                  }}
                  done={() => {
                    refresh();
                    notify('Profile saved');
                  }}
                />
              )}
              {area === 'notifications' && (
                <>
                  <button
                    onClick={async () => {
                      result(await api.POST('/v1/notifications', { body: {} }));
                      refresh();
                    }}
                  >
                    Mark all read
                  </button>
                  {notifications.length ? (
                    notifications.map((n) => (
                      <article className="notification" key={n.id}>
                        <Bell size={18} />
                        <div>
                          <strong>@{n.username}</strong>{' '}
                          {n.kind === 'follow'
                            ? 'started following you'
                            : n.kind === 'review_like'
                              ? 'liked your review'
                              : 'joined your discussion'}
                          <p className="muted">
                            {new Date(n.created_at).toLocaleString()} ·{' '}
                            {n.read ? 'Read' : 'New'}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty title="A quiet moment">
                      Notifications appear when someone follows you, likes a
                      review, or joins a discussion.
                    </Empty>
                  )}
                </>
              )}
              {area === 'credits' && (
                <section className="prose">
                  <h2>Afterframe</h2>
                  <p>Your movies. Your memories. Your evolving perspective.</p>
                  <h3>Movie data</h3>
                  <p>
                    This product uses the TMDB API but is not endorsed or
                    certified by TMDB.
                  </p>
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Movie data and imagery provided by TMDB ↗
                  </a>
                  <h3>Your memories are yours</h3>
                  <p>
                    Memory Vault uses PostgreSQL full-text and fuzzy matching.
                    No paid AI providers receive your entries. Results match
                    your own words and never invent memories.
                  </p>
                  <h3>Spoiler visibility</h3>
                  <p>
                    Unwatched readers receive the author’s safe introduction.
                    Marking a film watched opens post-watch discussion. Deeper
                    reflections require an explicit reveal. Authors are
                    responsible for writing safe introductions.
                  </p>
                </section>
              )}
              {['discover', 'diary', 'feed', 'watchlist', 'lists'].includes(
                area
              ) &&
                !routeID && (
                  <div className="pagination">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {page}</span>
                    <button onClick={() => setPage((n) => n + 1)}>Next</button>
                  </div>
                )}
            </>
          )}
          <footer>
            <span className="brand small-brand">afterframe.</span>
            <p>Keep the feeling. Find the next film.</p>
            <a href="#credits">TMDB & privacy</a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === 'auth'
              ? 'Welcome to Afterframe'
              : dialog.kind === 'log'
                ? 'Another frame in your story'
                : dialog.kind === 'review'
                  ? 'A review with room to unfold'
                  : dialog.kind === 'memory'
                    ? 'Keep the details'
                    : dialog.kind === 'opinion'
                      ? 'A new perspective'
                      : dialog.kind === 'password'
                        ? 'Set a new password'
                        : 'A collection of your own'
          }
          close={() => setDialog(null)}
        >
          {dialog.kind === 'auth' && (
            <AuthForm
              done={() => {
                setDialog(null);
                go('settings');
              }}
            />
          )}
          {dialog.kind === 'log' &&
            (() => {
              const v = dialog.value as Models['Viewing'] | Models['Film'];
              return (
                <LogForm
                  film={'film' in v ? v.film : v}
                  entry={'film' in v ? v : undefined}
                  done={done}
                />
              );
            })()}
          {dialog.kind === 'review' &&
            (() => {
              const v = dialog.value as Models['Review'] | Models['Film'];
              return (
                <ReviewForm
                  film={'film' in v ? v.film : v}
                  review={'film' in v ? v : undefined}
                  done={done}
                />
              );
            })()}
          {dialog.kind === 'opinion' && (
            <OpinionForm film={dialog.value as Models['Film']} done={done} />
          )}
          {dialog.kind === 'memory' && (
            <MemoryForm memory={dialog.value as Models['Memory']} done={done} />
          )}
          {dialog.kind === 'list' && (
            <ListForm
              list={dialog.value as Models['List'] | undefined}
              done={done}
            />
          )}
          {dialog.kind === 'password' && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const password = String(
                  new FormData(e.currentTarget).get('password')
                );
                const { error } = await supabase.auth.updateUser({ password });
                if (error) notify(error.message);
                else done();
              }}
            >
              <label>
                New password
                <input name="password" type="password" minLength={8} required />
              </label>
              <button className="primary">Update password</button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

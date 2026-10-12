'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  Clapperboard,
  Compass,
  Film,
  History,
  List,
  LockKeyhole,
  Moon,
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
const Onboarding = dynamic(() =>
  import('./library').then((m) => m.Onboarding)
);
const Timeline = dynamic(() => import('./library').then((m) => m.Timeline));
const TasteQuiz = dynamic(() =>
  import('./library').then((m) => m.TasteQuiz)
);
const TonightMode = dynamic(() =>
  import('./library').then((m) => m.TonightMode)
);
const TastePartners = dynamic(() =>
  import('./library').then((m) => m.TastePartners)
);
const ProgressTracker = dynamic(() =>
  import('./library').then((m) => m.ProgressTracker)
);
const PosterShare = dynamic(() =>
  import('./library').then((m) => m.PosterShare)
);
const CraftNotes = dynamic(() =>
  import('./library').then((m) => m.CraftNotes)
);
const CraftNoteForm = dynamic(() =>
  import('./forms').then((m) => m.CraftNoteForm)
);
const CreatePlanForm = dynamic(() =>
  import('./forms').then((m) => m.CreatePlanForm)
);
const TheatricalPlans = dynamic(() =>
  import('./library').then((m) => m.TheatricalPlans)
);
const PlanDetail = dynamic(() =>
  import('./library').then((m) => m.PlanDetail)
);
const FilmRatings = dynamic(() =>
  import('./library').then((m) => m.FilmRatings)
);
const LetterboxdImport = dynamic(() =>
  import('./library').then((m) => m.LetterboxdImport)
);
const Reviews = dynamic(() => import('./reviews').then((m) => m.Reviews));
const ProfileView = dynamic(() => import('./profile'));
import { Empty, Modal, Poster, go, message } from './ui';
import { isPlaceholderUsername, suggestUsernameFrom } from '@/lib/username';
import { WATCHLIST_INTENTS, REVIEW_TONES, REGIONS } from '@/lib/vocab';
type Dialog = { kind: string; value?: unknown } | null;
const navigation = [
  ['discover', 'Discover', Compass],
  ['tonight', 'Tonight', Moon],
  ['diary', 'Your diary', Film],
  ['watchlist', 'Watchlist', Bookmark],
  ['lists', 'Lists', List],
  ['feed', 'Following', Users],
  ['memories', 'Memory Vault', Vault],
  ['timeline', 'Taste Timeline', History],
  ['craft', 'Craft notes', Clapperboard],
  ['plans', 'Group plans', CalendarDays],
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
  quiz: ['Let’s find your kind of cinema.', 'About a minute. Fully optional.'],
  tonight: [
    'What do you feel like tonight?',
    'A few picks, explained — not an endless scroll.',
  ],
  'taste-partners': [
    'Share taste, not just activity.',
    'Nothing crosses over until they say yes.',
  ],
  import: [
    'Bring your history with you.',
    'Your Letterboxd diary, matched and merged — never duplicated.',
  ],
  craft: [
    'For the people who notice the edit.',
    'Cinematography, sound, performance — entirely optional, always searchable.',
  ],
  plans: [
    'Movie night starts with a plan.',
    'Propose times, invite people, vote. No live showtimes — honestly so.',
  ],
};
// Reads only trustworthy, user-provided profile metadata Google/Supabase already
// hands back on sign-in. Used solely to prefill onboarding; never applied silently.
function notificationText(kind: string): string {
  switch (kind) {
    case 'follow':
      return 'started following you';
    case 'review_like':
      return 'liked your review';
    case 'taste_share_invite':
      return 'wants to share taste for Tonight Mode';
    case 'taste_share_accepted':
      return 'accepted your taste-sharing request';
    case 'taste_share_declined':
      return 'declined your taste-sharing request';
    case 'plan_invite':
      return 'invited you to plan a group outing';
    default:
      return 'joined your discussion';
  }
}
function suggestionFrom(
  user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined
) {
  const meta = user?.user_metadata || {};
  const name =
    typeof meta.full_name === 'string'
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : '';
  return { username: suggestUsernameFrom(name || user?.email?.split('@')[0] || ''), name };
}
// GAP 24 (free-tier only): current region streaming availability, sourced
// from TMDB's watch/providers endpoint (itself JustWatch data). Never shows
// a predicted departure date — only an observed snapshot and its freshness.
function StreamingAvailability({ filmId }: { filmId: number }) {
  const [region, setRegion] = useState('US');
  const [data, setData] = useState<Models['StreamingAvailability'] | null>(
    null
  );
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api
      .GET('/v1/availability', { params: { query: { film_id: filmId, region } } })
      .then(result)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [filmId, region]);
  return (
    <div className="availability">
      <div className="row">
        <span className="muted">Where to watch</span>
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="muted" role="status">
          {error}
        </p>
      )}
      {data && (
        <>
          {data.providers.length ? (
            <div className="row">
              {data.providers.map((p) => (
                <span className="chip" key={p}>
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No streaming listing found for this region.</p>
          )}
          <p className="muted">
            {data.stale ? 'Last confirmed' : 'Checked'}{' '}
            {new Date(data.fetched_at).toLocaleDateString()}. Streaming data
            by{' '}
            <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
              JustWatch
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
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
    [month, setMonth] = useState(''),
    [watchlistIntent, setWatchlistIntent] = useState(''),
    [reviewTone, setReviewTone] = useState(''),
    [suggested, setSuggested] = useState({ username: '', name: '' });
  const onboardPrompted = useRef(false);
  const [films, setFilms] = useState<Models['Film'][]>(initialFilms),
    [film, setFilm] = useState<Models['Film'] | null>(null),
    [diary, setDiary] = useState<Models['Viewing'][]>([]),
    [memories, setMemories] = useState<Models['Memory'][]>([]),
    [resurfaced, setResurfaced] = useState<Models['Memory'][]>([]),
    [opinions, setOpinions] = useState<Models['Opinion'][]>([]),
    [comparisons, setComparisons] = useState<Models['Comparison'][]>([]),
    [filmState, setFilmState] = useState<Models['FilmState'] | null>(null),
    [progress, setProgress] = useState<Models['Progress'][]>([]),
    [craftNotes, setCraftNotes] = useState<Models['CraftNote'][]>([]),
    [reviews, setReviews] = useState<Models['Review'][]>([]),
    [lists, setLists] = useState<Models['List'][]>([]),
    [people, setPeople] = useState<Models['Person'][]>([]),
    [watchlistItems, setWatchlistItems] = useState<Models['Watch'][]>([]),
    [availabilityAlerts, setAvailabilityAlerts] = useState<
      Models['AvailabilityAlert'][]
    >([]),
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
      setProgress([]);
      setCraftNotes([]);
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
      setSuggested(suggestionFrom(data.session?.user));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setToken(s?.access_token || '');
      setSuggested(suggestionFrom(s?.user));
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
        setProgress([]);
        setCraftNotes([]);
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
        .then((p) => {
          setProfile(p);
          // A fresh sign-up/sign-in already redirects to #settings, which shows
          // its own placeholder-username notice inline; only pop the onboarding
          // modal for a *returning* session landing somewhere else, so the two
          // username prompts never stack on top of each other.
          if (
            !onboardPrompted.current &&
            isPlaceholderUsername(p.username) &&
            location.hash.slice(1) !== 'settings' &&
            sessionStorage.getItem('af_onboarding_dismissed') !== '1'
          ) {
            onboardPrompted.current = true;
            setDialog({ kind: 'onboarding' });
          }
        })
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
          const [r, t, c, state, prog, craft] = await Promise.all([
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
            api.GET('/v1/progress'),
            api.GET('/v1/craft', {
              params: { query: { film_id: Number(routeID) } },
            }),
          ]);
          if (live) {
            setReviews(result(r));
            setOpinions(result(t));
            setComparisons(result(c));
            setFilmState(result(state));
            setProgress(result(prog));
            setCraftNotes(result(craft));
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
                params: {
                  query: { offset: (page - 1) * 50, emotion: watchlistIntent },
                },
              })
            );
            if (live) setWatchlistItems(d);
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
          case 'craft': {
            const d = result(
              await api.GET('/v1/craft', { params: { query: { q: search } } })
            );
            if (live) setCraftNotes(d);
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
                params: {
                  query: { offset: (page - 1) * 30, emotion: reviewTone },
                },
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
            const [d, a] = await Promise.all([
              api.GET('/v1/notifications'),
              api.GET('/v1/availability-alerts'),
            ]);
            if (live) {
              setNotifications(result(d));
              setAvailabilityAlerts(result(a));
            }
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
  }, [
    area,
    routeID,
    session,
    ready,
    revision,
    search,
    section,
    page,
    month,
    watchlistIntent,
    reviewTone,
  ]);
  function requireAuth(kind: string, value?: unknown) {
    // A signed-out tap on "Log this film"/"Write review"/etc. must not lose
    // what the visitor was trying to do — remember it so AuthForm's done
    // callback can reopen the real action instead of always landing on
    // Settings (which is still correct for a plain, unprompted "Sign in").
    if (!session) edit('auth', { kind, value });
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
                  (area === key ? 'active ' : '') + (i === 6 ? 'nav-break' : '')
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
              {session &&
                profile &&
                !profile.quiz_completed_at &&
                sessionStorage.getItem('af_quiz_dismissed') !== '1' && (
                  <p className="notice">
                    Take the 60-second taste quiz so Discover can start
                    reflecting what you actually like.{' '}
                    <button onClick={() => go('quiz')}>Take the quiz</button>{' '}
                    <button
                      className="text-button"
                      onClick={() => {
                        sessionStorage.setItem('af_quiz_dismissed', '1');
                        refresh();
                      }}
                    >
                      Not now
                    </button>
                  </p>
                )}
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
              {['discover', 'memories', 'people', 'craft'].includes(area) && (
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
                          : area === 'craft'
                            ? 'Search your craft notes'
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
                            : area === 'craft'
                              ? 'A technique, a scene, a film title…'
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
              {area === 'discover' && !loading && (
                <>
                  {films.length ? (
                    <div className="film-grid">
                      {films.map((f) => (
                        <div key={f.id}>
                          <Poster film={f} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    !error && (
                      <Empty
                        title={search ? 'No films found' : 'Nothing here yet'}
                      />
                    )
                  )}
                </>
              )}
              {area === 'watchlist' && !loading && (
                <>
                  <div className="row" role="group" aria-label="Filter by reason saved">
                    {WATCHLIST_INTENTS.map((i) => (
                      <button
                        type="button"
                        key={i.value}
                        aria-pressed={watchlistIntent === i.value}
                        className={
                          watchlistIntent === i.value ? 'chip selected' : 'chip'
                        }
                        onClick={() => {
                          setWatchlistIntent(i.value);
                          setPage(1);
                        }}
                      >
                        {i.value === '' ? 'All' : i.label}
                      </button>
                    ))}
                  </div>
                  {watchlistItems.length ? (
                    <div className="film-grid">
                      {watchlistItems.map((w) => (
                        <div key={w.film.id}>
                          <Poster film={w.film} />
                          <label>
                            Saved for
                            <select
                              value={w.intent}
                              onChange={async (e) => {
                                try {
                                  result(
                                    await api.POST('/v1/watchlist', {
                                      body: {
                                        film_id: w.film.id,
                                        enabled: true,
                                        private: w.private,
                                        intent: e.target.value,
                                        intent_note: w.intent_note,
                                      },
                                    })
                                  );
                                  refresh();
                                } catch (e) {
                                  notify(message(e));
                                }
                              }}
                            >
                              {WATCHLIST_INTENTS.map((i) => (
                                <option key={i.value} value={i.value}>
                                  {i.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                result(
                                  await api.POST('/v1/watchlist', {
                                    body: { film_id: w.film.id, enabled: false },
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    !error && (
                      <Empty
                        title={
                          watchlistIntent
                            ? 'Nothing saved for that reason yet'
                            : 'Save films for the right moment'
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
                        {!!film.vote_count && (
                          <span className="chip tmdb-source">
                            TMDB rating: {(film.vote_average ?? 0).toFixed(1)}/10 (
                            {film.vote_count.toLocaleString()} votes)
                          </span>
                        )}
                      </div>
                      <p>{film.overview}</p>
                      {!!film.tmdb_reviews?.length && (
                        <details>
                          <summary>
                            TMDB community reviews ({film.tmdb_reviews.length}
                            )
                          </summary>
                          <p className="muted tmdb-source">
                            These are reviews TMDB&rsquo;s own community
                            wrote — not Afterframe users. See
                            Afterframe&rsquo;s own reviews further down this
                            page.
                          </p>
                          {film.tmdb_reviews.map((r, i) => (
                            <article key={i} className="tmdb-review">
                              <span className="eyebrow">
                                TMDB community review · {r.author}
                                {r.rating != null && ` · ${r.rating}/10`}
                              </span>
                              <p className="review-text">{r.content}</p>
                              {r.url && (
                                <a href={r.url} target="_blank" rel="noreferrer">
                                  Read on TMDB
                                </a>
                              )}
                            </article>
                          ))}
                        </details>
                      )}
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
                      {session && <FilmRatings filmID={film.id} />}
                      {session && (
                        <ProgressTracker
                          film={film}
                          current={progress.find((p) => p.film_id === film.id)}
                          onSaved={refresh}
                        />
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
                          aria-pressed={!!filmState?.watchlisted}
                          onClick={async () => {
                            if (!session) {
                              edit('auth');
                              return;
                            }
                            const onList = !!filmState?.watchlisted;
                            try {
                              result(
                                await api.POST('/v1/watchlist', {
                                  body: {
                                    film_id: film.id,
                                    enabled: !onList,
                                    private: profile?.private || false,
                                  },
                                })
                              );
                              setFilmState((s) =>
                                s ? { ...s, watchlisted: !onList } : s
                              );
                              notify(
                                onList
                                  ? 'Removed from your watchlist'
                                  : 'Added to your watchlist'
                              );
                            } catch (e) {
                              notify(message(e));
                            }
                          }}
                        >
                          <Bookmark
                            size={16}
                            fill={filmState?.watchlisted ? 'currentColor' : 'none'}
                          />
                          {filmState?.watchlisted ? 'On your watchlist' : 'Watchlist'}
                        </button>
                        <button onClick={() => requireAuth('review', film)}>
                          Write review
                        </button>
                        <button onClick={() => requireAuth('opinion', film)}>
                          Reflect
                        </button>
                        <button onClick={() => requireAuth('plan', film)}>
                          Plan a group outing
                        </button>
                      </div>
                      {session && <StreamingAvailability filmId={film.id} />}
                    </div>
                  </section>
                  {session && (
                    <>
                      <div className="section-heading">
                        <h2>Craft notes</h2>
                        <button onClick={() => edit('craft', { film })}>
                          Add craft note
                        </button>
                      </div>
                      <CraftNotes
                        notes={craftNotes}
                        refresh={refresh}
                        notify={notify}
                        userID={session}
                        edit={(n) =>
                          edit('craft', { film: n.film || film, note: n })
                        }
                      />
                    </>
                  )}
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
                        share={(r) => edit('poster', r)}
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
              {area === 'plans' && <TheatricalPlans />}
              {area === 'plan' && (
                <PlanDetail
                  planID={routeID}
                  userID={session || undefined}
                  notify={notify}
                />
              )}
              {area === 'craft' && (
                <CraftNotes
                  notes={craftNotes}
                  refresh={refresh}
                  notify={notify}
                  userID={session || undefined}
                  edit={(n) =>
                    n.film && edit('craft', { film: n.film, note: n })
                  }
                />
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
                  <div className="row" role="group" aria-label="Filter reviews">
                    {REVIEW_TONES.map((t) => (
                      <button
                        type="button"
                        key={t.value}
                        aria-pressed={reviewTone === t.value}
                        className={
                          reviewTone === t.value ? 'chip selected' : 'chip'
                        }
                        onClick={() => {
                          setReviewTone(t.value);
                          setPage(1);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Reviews
                    reviews={reviews}
                    refresh={refresh}
                    notify={notify}
                    userID={session || undefined}
                    edit={(r) => edit('review', r)}
                    share={(r) => edit('poster', r)}
                  />
                </>
              )}
              {area === 'profile' && (
                <ProfileView key={routeID} id={routeID} notify={notify} />
              )}
              {area === 'quiz' &&
                (session ? (
                  <TasteQuiz done={() => go('discover')} onSaved={refresh} />
                ) : (
                  <p className="muted">
                    <button onClick={() => edit('auth')}>Sign in</button> to
                    take the taste quiz.
                  </p>
                ))}
              {area === 'tonight' &&
                (session ? (
                  <TonightMode profile={profile} />
                ) : (
                  <p className="muted">
                    <button onClick={() => edit('auth')}>Sign in</button> to
                    use Tonight Mode.
                  </p>
                ))}
              {area === 'taste-partners' &&
                (session ? (
                  <TastePartners />
                ) : (
                  <p className="muted">
                    <button onClick={() => edit('auth')}>Sign in</button> to
                    manage taste partners.
                  </p>
                ))}
              {area === 'import' &&
                (session ? (
                  <LetterboxdImport />
                ) : (
                  <p className="muted">
                    <button onClick={() => edit('auth')}>Sign in</button> to
                    import a Letterboxd diary.
                  </p>
                ))}
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
                      try {
                        result(
                          await api.POST('/v1/notifications', { body: {} })
                        );
                        refresh();
                      } catch (e) {
                        notify(message(e));
                      }
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
                          {notificationText(n.kind)}
                          {n.kind === 'taste_share_invite' && (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => go('taste-partners')}
                              >
                                Respond
                              </button>
                            </>
                          )}
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
                  {availabilityAlerts.length > 0 && (
                    <>
                      <div className="section-heading">
                        <h2>Availability changes</h2>
                        <button
                          onClick={async () => {
                            try {
                              result(
                                await api.POST('/v1/availability-alerts', {
                                  body: {},
                                })
                              );
                              refresh();
                            } catch (e) {
                              notify(message(e));
                            }
                          }}
                        >
                          Mark all read
                        </button>
                      </div>
                      {availabilityAlerts.map((a) => (
                        <article className="notification" key={a.id}>
                          <Bell size={18} />
                          <div>
                            <strong>{a.film.title}</strong>{' '}
                            {a.change === 'added'
                              ? 'is now available on ' + a.provider
                              : 'is no longer listed on ' + a.provider}{' '}
                            ({a.region})
                            <p className="muted">
                              {new Date(a.created_at).toLocaleString()} ·{' '}
                              {a.read ? 'Read' : 'New'}
                            </p>
                          </div>
                        </article>
                      ))}
                    </>
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
            dialog.kind === 'auth' || dialog.kind === 'onboarding'
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
                        : dialog.kind === 'poster'
                          ? 'Share this one'
                          : dialog.kind === 'craft'
                            ? 'A craft observation'
                            : dialog.kind === 'plan'
                              ? 'Plan a group outing'
                              : 'A collection of your own'
          }
          close={() => {
            if (dialog.kind === 'onboarding')
              sessionStorage.setItem('af_onboarding_dismissed', '1');
            setDialog(null);
          }}
        >
          {dialog.kind === 'auth' && (
            <AuthForm
              done={() => {
                const pending = dialog.value as
                  | { kind: string; value?: unknown }
                  | undefined;
                if (pending?.kind) {
                  // The visitor came here mid-action (e.g. "Log this
                  // film") — reopen that, not the generic onboarding
                  // popup, which would otherwise steal the dialog right
                  // back from them on this same profile-load tick.
                  onboardPrompted.current = true;
                  setDialog({ kind: pending.kind, value: pending.value });
                } else {
                  setDialog(null);
                  go('settings');
                }
              }}
            />
          )}
          {dialog.kind === 'onboarding' && profile && (
            <Onboarding
              profile={profile}
              suggestedUsername={suggested.username}
              suggestedName={suggested.name}
              done={() => {
                setDialog(null);
                setToast('Saved. Welcome in.');
                refresh();
              }}
              skip={() => {
                sessionStorage.setItem('af_onboarding_dismissed', '1');
                setDialog(null);
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
          {dialog.kind === 'poster' && (
            <PosterShare
              review={dialog.value as Models['Review']}
              done={() => setDialog(null)}
            />
          )}
          {dialog.kind === 'craft' &&
            (() => {
              const v = dialog.value as {
                film: Models['Film'];
                note?: Models['CraftNote'];
              };
              return (
                <CraftNoteForm film={v.film} note={v.note} done={done} />
              );
            })()}
          {dialog.kind === 'plan' && (
            <CreatePlanForm
              film={dialog.value as Models['Film']}
              done={() => setDialog(null)}
            />
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

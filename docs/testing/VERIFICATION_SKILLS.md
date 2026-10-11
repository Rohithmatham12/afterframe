# Verification skill execution ledger

All fifteen local verification skill files were schema-validated (skill-validation.txt). The following commands executed their shared procedure against the running app: Go unit/race/Testcontainers, frontend Vitest/build/lint, Playwright rounds 1–3 and expanded regression. This ledger records coverage, not automatic blanket PASS.

| Skill | Executed evidence | Remaining scope |
|---|---|---|
| auth | signup/login/logout/invalid login/local deletion | Hosted email confirmation (Google OAuth and local recovery now pass) |
| film-catalog | TMDB search/detail, provider failure unit tests, credits build | Full discovery filters, degraded UI audit |
| film-logging | five film logs, ratings, rewatch, concurrent idempotency integration | Additional device/input combinations |
| diary | persisted history, edit, ownership integration | Larger historical datasets |
| reviews | layered publish, likes/comments, API filtering | Broader abuse/moderation workflows |
| watchlist | add two, logging removes atomically | Ordering/privacy browser matrix |
| lists | ranked creation/reorder, ownership/duplicate integration | Larger shared-list datasets |
| profiles | onboarding/edit, private visibility, avatar/erasure | Full profile/network edge cases |
| social-feed | follow/feed/block, safe payloads | Unfollow/multi-tab/large graph |
| notifications | actual follow/like/comment notifications; no spoiler preview | Production delivery/load behavior |
| account-privacy | private profile, memory isolation, blocking, actual local erasure | Production deployment configuration (hosted erasure and outage retry now pass) |
| memory-vault | exact/fuzzy/private/edit/delete/resurface | Exhaustive natural-language phrasing and large corpus |
| taste-timeline | history/reflection/then-now/persistence/rewatch | Broad long-history datasets |
| spoiler-safe-discovery | unwatched/watched/deeper reveal, API/DOM persistence | Every preview and explicit unwatched reveal surface |
| pwa-and-responsive-ui | five widths, mobile personas, offline fallback, axe | Installed-device lifecycle, manual assistive technology |

Missing items remain release work. A passing scenario does not prove the entire feature specification.

Final release-final.log records 13 passing journeys, including review/list/diary/social/recovery edges and keyboard reflow. OAUTH_VERIFICATION.md records real Google and hosted erasure verification. release-query-audit.log covers provider-outage retry and large local fixtures. Remaining cells describe limits, not failures of the executed scenarios.

# Scaling assessment for quiz APIs

## Current stack
- Hosting/runtime: Vercel serverless functions.
- Database: Postgres via `@vercel/postgres`.

## 1) Shared state in serverless
Status: **Partly at risk**.

- Rate limiting currently uses in-memory maps per instance (`requestBuckets`).
- Guest progress in quiz quest also uses in-memory maps (`guestProgressStore`).

Impact:
- In serverless, users can hit different warm instances, causing inconsistent limits/progress.
- Horizontal scaling does not share this state.

Recommendation:
- Move rate limiting and guest progress to shared storage (Redis/KV or Postgres table).

## 2) Random question selection patterns
Status: **Needs optimization as dataset grows**.

- `/api/quiz/start` currently fetches candidate IDs and samples in application code.
- `/api/quiz/quest` uses `COUNT + OFFSET + LIMIT` for random candidate retrieval.

Impact:
- These patterns can become expensive with larger tables/high offsets.

Recommendation:
- Keep sampling logic deterministic but reduce DB work:
  - avoid large OFFSET scans,
  - use indexed candidate windows/id-ranges,
  - or precomputed candidate sets when appropriate.

## 3) Database connections in serverless
Status: **Configurable, monitor closely**.

- Shared pool exists per runtime and supports env tuning (`DB_POOL_MAX`, timeouts).

Impact:
- Burst scale-out can still produce many total DB connections across instances.

Recommendation:
- Verify effective pooling strategy (managed pooling/PgBouncer where relevant).
- Tune pool max/timeouts based on production telemetry.

## 4) Caching quiz data
Status: **Opportunity**.

- Categories and some metadata are read often and likely change infrequently.

Recommendation:
- Add cache layer (edge/server cache or Redis/KV) for:
  - categories list,
  - aggregate overview metadata,
  - low-churn question metadata.
- Invalidate on content changes.

## 5) Measure before architecture changes
Status: **Strongly recommended before stack migration**.

Track at minimum:
- Endpoint latency p50/p95/p99 for `/api/quiz/start`, `/api/quiz/quest`, `/api/quiz/answer`.
- Query latency + rows examined for top DB queries.
- Error rate and timeout rate.
- DB connection usage during bursts.

## Bottom line
The current concerns are valid and relevant.
Most risk appears in implementation choices (state locality, query patterns, caching, connection pressure), not necessarily the base stack itself.

A pragmatic path is to address these bottlenecks first, then re-evaluate whether Vercel + Postgres still meets SLO/cost targets.

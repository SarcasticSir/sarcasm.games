# Scaling assessment for quiz APIs

## Current stack
- Hosting/runtime: Vercel serverless functions.
- Database: Postgres (Supabase) via the `pg` driver.

## 1) Shared state in serverless
Status: **Improved, with fallback risk**.

- Rate limiting writes to shared Postgres table `quiz_rate_limits` and only falls back to in-memory buckets if shared storage is unavailable.
- Guest quest progress is stored in Postgres table `quiz_guest_progress`.

Impact:
- Under normal operation, multi-instance consistency is preserved through shared tables.
- If DB access fails, in-memory rate-limit fallback can become instance-local and temporarily inconsistent.

Recommendation:
- Keep shared-table path as primary and monitor fallback frequency.
- Add alerting for fallback events to detect DB/connectivity issues.

## 2) Random question selection patterns
Status: **Partly improved, `/start` still scales with candidate count**.

- `/api/quiz/start` currently fetches candidate IDs and samples in application code.
- `/api/quiz/quest` uses random pivot within min/max id bounds and then fetches nearest eligible row.

Impact:
- `/start` can become expensive as dataset grows because candidate IDs are materialized before sampling.
- `/quest` avoids `OFFSET`, but can still degrade with sparse IDs and filter skew.

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

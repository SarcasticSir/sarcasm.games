# Quiz Scaling Test Matrix

This document defines the reproducible dataset and traffic profiles used by all scaling tests.

## 1) Fixed test environment settings

Use the same settings across all benchmark runs unless a test explicitly targets environment variance.

| Area | Standard setting |
| --- | --- |
| Runtime | Node.js 20 LTS |
| Deployment model | Serverless functions, minimum 1 warm instance before test |
| Region | Single region per run (same region for app and database) |
| Database | Postgres with connection pooling enabled |
| Isolation | No unrelated load on database during benchmark window |
| Time sync | All hosts NTP-synced |
| Logging | Structured logs enabled with request ID and endpoint tags |

## 2) Dataset profiles

Each profile is a snapshot and should be regenerated from seed scripts before major test cycles.

| Profile ID | Questions | Categories | Distribution | Notes |
| --- | ---: | ---: | --- | --- |
| DS-1K | 1,000 | 20 | Even | Baseline sanity profile |
| DS-5K | 5,000 | 40 | Even + mild skew | Mid-scale profile |
| DS-10K | 10,000 | 60 | Mixed skew | SLO target profile |
| DS-50K | 50,000 | 120 | High skew | Stress profile |

### Category distribution variants

Run each dataset profile with these variants:

1. **EVEN**: categories as close to equal size as possible.
2. **SKEW-80/20**: 20% categories hold ~80% of questions.
3. **LONG-TAIL**: top categories large, many categories very small.

### User answer history variants

Run these history states to test growth in `user_answers`:

| History ID | Avg answers per active user | Purpose |
| --- | ---: | --- |
| UA-COLD | 0-10 | New/returning mixed traffic |
| UA-WARM | 100-300 | Realistic ongoing usage |
| UA-HOT | 1,000+ | Large historical footprint |

## 3) Traffic profiles

Use a fixed endpoint mix unless a test explicitly targets one endpoint.

| Traffic ID | Concurrency | Request pattern | Endpoint mix (`start/quest/answer`) |
| --- | ---: | --- | --- |
| TR-SMOKE | 20 | Steady 10 min | 20% / 50% / 30% |
| TR-TARGET | 200 | Steady 30 min | 20% / 50% / 30% |
| TR-BURST | 50 -> 300 -> 50 | 2 min burst, 10 min settle | 20% / 50% / 30% |
| TR-STRESS | 400+ | Ramp + hold 20 min | 20% / 50% / 30% |

## 4) Required capture per run

For every dataset + traffic combination, record:

- p50/p95/p99 for `quiz/start`, `quiz/quest`, `quiz/answer`
- endpoint error rate and timeout rate
- database active connections / wait count / timeout count
- top 5 query patterns by total execution time
- application instance count over time (if available)

## 5) Run naming convention

Use a deterministic run ID:

`<date>-<dataset>-<distribution>-<history>-<traffic>-<git_sha>`

Example:

`2026-03-14-DS-10K-SKEW-80_20-UA-WARM-TR-TARGET-a1b2c3d`

## 6) Exit criteria for valid benchmark runs

A run is valid only when all are true:

- test completed full planned duration
- no external incidents impacted app/database region
- deployment version fixed during run
- dataset snapshot hash recorded
- observability pipeline collected complete metrics

If a run is invalid, mark as `DISCARDED` and rerun.

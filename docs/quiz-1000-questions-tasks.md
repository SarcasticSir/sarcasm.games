# Quiz 1000+ Questions - Task Backlog

This backlog translates the scaling plan into concrete implementation and validation tasks.

## Milestone 1 - Baseline and observability

- [x] **QZ-001: Define test environments and dataset profiles**
  - Create standard profiles for 1k, 5k, 10k, and 50k questions.
  - Define category skew scenarios and `user_answers` growth scenarios.
  - Document fixed runtime/database settings used during tests.
  - **Done when:** a reproducible test matrix exists in docs and can be reused by all later load tests.
  - Deliverable: `docs/quiz-scaling-test-matrix.md` with standardized environment, dataset, and traffic profiles.

- [ ] **QZ-002: Add endpoint-level latency and error instrumentation**
  - Track p50/p95/p99 latency for `quiz/start`, `quiz/quest`, `quiz/answer`.
  - Track endpoint error rate and timeout rate.
  - Include dimensions for instance/environment when available.
  - **Done when:** dashboard or queryable metrics exist for all three endpoints.

- [ ] **QZ-003: Add database query telemetry for hot paths**
  - Capture query execution time and rows scanned/returned for critical quiz queries.
  - Tag queries by endpoint and query purpose.
  - **Done when:** it is possible to compare query cost before/after optimizations.

- [ ] **QZ-004: Record baseline SLO performance under load**
  - Run baseline tests for minimum load profile and target load profile.
  - Save p95 latency, error rate, and DB connection behavior snapshots.
  - **Done when:** baseline report is stored in docs and used as benchmark.

## Milestone 2 - Serverless correctness and shared state

- [ ] **QZ-101: Inventory in-memory correctness-critical state**
  - Identify all runtime-local state that can break across instances.
  - Include rate limiting, guest progress, and session consistency.
  - **Done when:** all stateful risks are listed with current owner and endpoint impact.

- [ ] **QZ-102: Implement shared rate-limit store**
  - Move rate-limit state from local memory to Redis/KV/Postgres.
  - Add TTL strategy for stale key cleanup.
  - **Done when:** rate limiting behaves consistently across multiple warm instances.

- [ ] **QZ-103: Implement shared guest-progress store**
  - Move guest quiz progress to shared store with expiry policy.
  - Define consistency semantics for concurrent requests.
  - **Done when:** guest progress is preserved when requests hit different instances.

- [ ] **QZ-104: Multi-instance correctness test suite**
  - Simulate users hitting multiple warm serverless instances.
  - Verify no double-advance, no lost progress, no inconsistent rate-limit behavior.
  - **Done when:** correctness tests pass across repeated multi-instance runs.

## Milestone 3 - Query scalability

- [ ] **QZ-201: Map and rank hot queries by total cost**
  - Identify top query patterns for `start`, `quest`, and `answer`.
  - Rank by cumulative latency and frequency.
  - **Done when:** optimization priority list is documented.

- [ ] **QZ-202: Replace full-candidate ID fetch in `quiz/start`**
  - Remove patterns that fetch large candidate sets into application memory.
  - Introduce scalable candidate selection strategy.
  - **Done when:** query work remains stable as dataset size increases.

- [ ] **QZ-203: Replace `COUNT + OFFSET` random selection in `quiz/quest`**
  - Replace with a strategy that avoids high-offset scan costs.
  - Validate fairness/randomness remains acceptable.
  - **Done when:** latency growth is sub-linear under dataset expansion scenarios.

- [ ] **QZ-204: Index review and creation for quiz hot paths**
  - Add/adjust indexes based on actual query predicates/order.
  - Remove redundant indexes if they increase write cost without value.
  - **Done when:** `EXPLAIN (ANALYZE, BUFFERS)` confirms no avoidable full scans on hot paths.

- [ ] **QZ-205: Query-plan regression checks**
  - Store representative `EXPLAIN (ANALYZE, BUFFERS)` outputs.
  - Re-run after schema/query changes.
  - **Done when:** query plans remain within acceptable cost envelopes.

## Milestone 4 - Database connection strategy

- [ ] **QZ-301: Validate pool settings per environment**
  - Review pool max, idle timeout, acquisition timeout, and retry strategy.
  - Align settings to realistic serverless fan-out.
  - **Done when:** pool settings are explicitly documented and justified.

- [ ] **QZ-302: Run connection pressure tests at 1x, 2x, 3x expected peak**
  - Simulate concurrency bursts and sustained load.
  - Record active connections, waiting clients, and timeout events.
  - **Done when:** no saturation is observed at 3x expected peak load.

- [ ] **QZ-303: Define DB connection alarms and runbook actions**
  - Add alerts for connection usage thresholds and timeout spikes.
  - Define immediate mitigation steps.
  - **Done when:** on-call can execute runbook without ad-hoc decisions.

## Milestone 5 - Caching low-churn metadata

- [ ] **QZ-401: Select cache candidates and ownership**
  - Confirm low-churn datasets: categories, overview aggregates, category counts.
  - Define invalidation owner/event source for each.
  - **Done when:** caching scope and ownership are documented.

- [ ] **QZ-402: Implement cache with TTL + explicit invalidation**
  - Add cache keys, TTL values, and invalidation triggers.
  - Ensure cache failures degrade safely.
  - **Done when:** cache hit rate and correctness can be observed in metrics.

- [ ] **QZ-403: Validate cache impact under load**
  - Compare DB CPU/query volume with and without cache.
  - Confirm SLO gains without masking inefficient core queries.
  - **Done when:** measurable DB offload is demonstrated in load test reports.

## Milestone 6 - Dataset and traffic scale validation

- [ ] **QZ-501: Build repeatable load scripts for traffic scenarios**
  - Cover steady load, ramp-up, burst, and burst-then-idle.
  - Include endpoint mix for `start`, `quest`, `answer`.
  - **Done when:** scripts can be executed consistently in CI or staging.

- [ ] **QZ-502: Run dataset scale suite (1k/5k/10k/50k)**
  - Execute full load profile for each dataset size.
  - Include uneven category distribution variants.
  - **Done when:** comparative report shows scaling behavior across dataset sizes.

- [ ] **QZ-503: Run concurrent-session scale suite**
  - Increase active sessions to and beyond target (200+).
  - Measure SLO adherence and error budgets.
  - **Done when:** target concurrency meets SLO and error constraints.

- [ ] **QZ-504: Validate burst handling across multiple instances**
  - Trigger parallel bursts to force serverless scale-out.
  - Verify correctness and stability during warm-up and cool-down windows.
  - **Done when:** no correctness regressions or saturation events are observed.

## Milestone 7 - Capacity model and release gate

- [ ] **QZ-601: Define concrete capacity model values (X/Y/Z/A/B/C)**
  - X concurrent sessions
  - Y `quest` requests/minute
  - Z `answer` requests/minute
  - A total questions
  - B categories
  - C average user progress
  - **Done when:** values are approved and used as planning baseline.

- [ ] **QZ-602: Produce final scaling validation report**
  - Summarize all benchmark runs, query plans, and correctness checks.
  - Include pass/fail per SLO and per Definition of Done criterion.
  - **Done when:** report is reviewed and accepted by engineering owner.

- [ ] **QZ-603: Final go-live checklist and signoff**
  - Verify SLO compliance, error budget compliance, and connection safety margins.
  - Confirm dashboards/alerts/runbooks are active.
  - **Done when:** release gate is approved with explicit signoff record.

## Cross-cutting non-functional tasks

- [ ] **QZ-701: Add rollback plan for each optimization batch**
- [ ] **QZ-702: Track risk register for scaling regressions**
- [ ] **QZ-703: Schedule post-release validation (24h + 7d)**

---

## Suggested execution order
1. QZ-001 to QZ-004
2. QZ-101 to QZ-104
3. QZ-201 to QZ-205
4. QZ-301 to QZ-303
5. QZ-401 to QZ-403
6. QZ-501 to QZ-504
7. QZ-601 to QZ-603
8. QZ-701 to QZ-703

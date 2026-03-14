# Quiz Scaling Assessment

## Goal
Ensure the quiz system maintains stable, predictable performance as the following grow:

- number of active users
- number of quiz questions
- number of concurrent quiz sessions
- burst traffic in a serverless environment

The objective is not merely to support a fixed dataset size, but to ensure that quiz endpoints scale predictably with both traffic and dataset growth.

## Scaling dimensions
System behavior must be validated along two independent axes.

### 1) Dataset scale
The system should behave consistently as the dataset grows.

Test scenarios should include:

- 1k questions
- 5k questions
- 10k questions
- 50k questions

Additional dataset variables:

- increasing category count
- growing `user_answers` history
- uneven category distribution

The goal is to ensure that query performance does not degrade linearly with dataset size.

### 2) Traffic scale
The system must remain stable under increasing concurrency.

Test scenarios should include:

- increasing concurrent quiz sessions
- higher request rates for `start`, `quest`, and `answer`
- burst traffic followed by idle periods
- multiple serverless instances executing in parallel

The system should behave correctly even when requests are distributed across multiple warm instances.

## Service Level Objectives (SLO)
Latency targets should be evaluated under defined load conditions.

| Endpoint | Target |
| --- | --- |
| `quiz/start` | p95 <= 300 ms |
| `quiz/quest` | p95 <= 250 ms |
| `quiz/answer` | p95 <= 200 ms |

Measured under conditions such as:

- 200+ concurrent quiz sessions
- 10k+ questions
- sustained request load and burst scenarios

Additional requirements:

- error rate < 0.5% over 24h
- no database connection saturation at 3x expected peak load

## Core architecture principles
The system should follow these scaling principles:

- Requests must not become significantly more expensive as data volume grows.

This implies avoiding patterns such as:

- fetching all candidates and filtering in application memory
- `COUNT + OFFSET` based random selection
- queries that degrade linearly with table size
- relying on local in-memory state for cross-instance correctness

Serverless execution requires that all correctness-critical state be externalized.

## Implementation priorities
Work should be prioritized in the following order.

### 1) Correctness under serverless scaling
Move shared state out of local memory:

- rate limiting
- guest progress
- session consistency

Introduce a shared store (Redis/KV/Postgres) with TTL and cleanup policies.

### 2) Query patterns that scale with dataset growth
Improve query paths in hot endpoints:

- remove full-ID fetch patterns
- remove `COUNT + OFFSET` random selection
- verify indexes and query plans

All critical queries should be validated with:

- `EXPLAIN (ANALYZE, BUFFERS)`

### 3) Database connection strategy
Ensure serverless fan-out does not exhaust database connections.

Verify:

- pooled connection usage
- connection limits
- behavior under load tests with multiple concurrent instances

### 4) Caching of low-churn data
Cache frequently accessed metadata:

- categories
- quiz overview data
- category counts
- other low-churn quiz metadata

Caching should reduce database load but must not be relied upon to compensate for inefficient query patterns.

## Capacity model
Define an approximate system capacity model.

Example targets:

- X concurrent quiz sessions
- Y `quest` requests per minute
- Z `answer` requests per minute
- A total questions in dataset
- B categories
- C average progress per user

This model provides a concrete baseline for load testing and scaling decisions.

## Definition of Done
The system is considered ready when:

- SLO targets are met under defined dataset and traffic conditions
- no correctness issues occur when multiple serverless instances handle requests
- hot query paths avoid full scans or linear degradation
- database connection usage remains within safe limits under peak load
- scaling behavior is measured and documented

## Execution backlog
Implementation tasks are tracked in `docs/quiz-1000-questions-tasks.md`.

# Quiz baseline report template

Use this template for every reproducible load run.

## Run metadata

- Run ID: `<date>-<dataset>-<distribution>-<history>-<traffic>-<git_sha>`
- Date/time:
- Git SHA:
- Environment:
- Region:
- Dataset profile:
- Distribution profile:
- User-answer history profile:
- Traffic profile:

## Command

```bash
node scripts/quiz-load-baseline.mjs \
  --base-url https://<deployment-host> \
  --duration-seconds 1800 \
  --concurrency 200 \
  --lang en
```

## Endpoint results

| Endpoint | Requests | Errors | Error rate | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `quiz/start` |  |  |  |  |  |  |
| `quiz/quest` |  |  |  |  |  |  |
| `quiz/answer` |  |  |  |  |  |  |

## Database and runtime observations

- Active DB connections (peak):
- Wait/timeout count:
- Top 5 query patterns by total execution time:
- Instance count over time:

## SLO check

- `quiz/start` p95 <= 300 ms: pass/fail
- `quiz/quest` p95 <= 250 ms: pass/fail
- `quiz/answer` p95 <= 200 ms: pass/fail
- Error rate < 0.5%: pass/fail

## Notes and follow-ups

- Key findings:
- Regressions:
- Recommended actions:

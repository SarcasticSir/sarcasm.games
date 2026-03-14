#!/usr/bin/env node

const DEFAULT_BASE_URL = process.env.QUIZ_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_DURATION_SECONDS = Number(process.env.QUIZ_DURATION_SECONDS || 120);
const DEFAULT_CONCURRENCY = Number(process.env.QUIZ_CONCURRENCY || 20);
const DEFAULT_LANG = process.env.QUIZ_LANG || 'en';

function parseArgs(argv) {
  const config = {
    baseUrl: DEFAULT_BASE_URL,
    durationSeconds: DEFAULT_DURATION_SECONDS,
    concurrency: DEFAULT_CONCURRENCY,
    lang: DEFAULT_LANG
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--base-url' && next) {
      config.baseUrl = next;
      index += 1;
      continue;
    }

    if (arg === '--duration-seconds' && next) {
      config.durationSeconds = Number(next);
      index += 1;
      continue;
    }

    if (arg === '--concurrency' && next) {
      config.concurrency = Number(next);
      index += 1;
      continue;
    }

    if (arg === '--lang' && next) {
      config.lang = next;
      index += 1;
      continue;
    }
  }

  return config;
}

function getPercentile(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[position];
}

function createMetric() {
  return {
    count: 0,
    errors: 0,
    latenciesMs: []
  };
}

function getEndpointMixSample() {
  const random = Math.random();
  if (random < 0.2) return 'start';
  if (random < 0.7) return 'quest';
  return 'answer';
}

async function timedFetch(url, options) {
  const startedAt = performance.now();
  const response = await fetch(url, options);
  const elapsedMs = performance.now() - startedAt;
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  return { response, elapsedMs, payload };
}

async function runVirtualUser(config, state, deadlineMs) {
  while (Date.now() < deadlineMs) {
    const endpointType = getEndpointMixSample();

    if (endpointType === 'start') {
      const metric = state.metrics.start;
      metric.count += 1;
      try {
        const { response, elapsedMs, payload } = await timedFetch(`${config.baseUrl}/api/quiz/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'random10', lang: config.lang })
        });

        metric.latenciesMs.push(elapsedMs);
        if (!response.ok) {
          metric.errors += 1;
          continue;
        }

        const firstQuestion = Array.isArray(payload?.questions) ? payload.questions[0] : null;
        if (firstQuestion?.id) {
          state.lastQuestionId = Number(firstQuestion.id);
        }
      } catch (error) {
        metric.errors += 1;
      }

      continue;
    }

    if (endpointType === 'quest') {
      const metric = state.metrics.quest;
      metric.count += 1;
      try {
        const { response, elapsedMs, payload } = await timedFetch(`${config.baseUrl}/api/quiz/quest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            categories: ['General'],
            lang: config.lang,
            guestProgressToken: state.guestProgressToken,
            solvedQuestionIdDeltas: state.lastCorrectQuestionId ? [state.lastCorrectQuestionId] : []
          })
        });

        metric.latenciesMs.push(elapsedMs);
        if (!response.ok) {
          metric.errors += 1;
          continue;
        }

        if (payload?.guestProgressToken) {
          state.guestProgressToken = payload.guestProgressToken;
        }

        if (payload?.question?.id) {
          state.lastQuestionId = Number(payload.question.id);
        }
      } catch (error) {
        metric.errors += 1;
      }

      continue;
    }

    const metric = state.metrics.answer;
    metric.count += 1;

    const questionId = Number(state.lastQuestionId) || 1;
    try {
      const { response, elapsedMs, payload } = await timedFetch(`${config.baseUrl}/api/quiz/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answer: 'test',
          lang: config.lang,
          retryAvailable: true
        })
      });

      metric.latenciesMs.push(elapsedMs);
      if (!response.ok) {
        metric.errors += 1;
        continue;
      }

      if (payload?.status === 'correct') {
        state.lastCorrectQuestionId = questionId;
      }
    } catch (error) {
      metric.errors += 1;
    }
  }
}

function summarizeMetric(metric) {
  const p50 = getPercentile(metric.latenciesMs, 50);
  const p95 = getPercentile(metric.latenciesMs, 95);
  const p99 = getPercentile(metric.latenciesMs, 99);
  const errorRate = metric.count ? (metric.errors / metric.count) * 100 : 0;

  return {
    requests: metric.count,
    errors: metric.errors,
    errorRatePercent: Number(errorRate.toFixed(2)),
    p50Ms: p50 ? Number(p50.toFixed(1)) : null,
    p95Ms: p95 ? Number(p95.toFixed(1)) : null,
    p99Ms: p99 ? Number(p99.toFixed(1)) : null
  };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const deadlineMs = Date.now() + (config.durationSeconds * 1000);

  const state = {
    guestProgressToken: null,
    lastQuestionId: null,
    lastCorrectQuestionId: null,
    metrics: {
      start: createMetric(),
      quest: createMetric(),
      answer: createMetric()
    }
  };

  const workers = Array.from({ length: config.concurrency }, () => runVirtualUser(config, state, deadlineMs));
  await Promise.all(workers);

  const output = {
    config,
    runAt: new Date().toISOString(),
    endpoints: {
      'quiz/start': summarizeMetric(state.metrics.start),
      'quiz/quest': summarizeMetric(state.metrics.quest),
      'quiz/answer': summarizeMetric(state.metrics.answer)
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error('[quiz-load-baseline] failed:', error?.message || error);
  process.exitCode = 1;
});

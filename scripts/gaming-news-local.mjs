import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SOURCES, parseFeed, clusterItems } from './gaming-news.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'news', 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const WORK_DIR = path.join(ROOT, '.gaming-news');
const CANDIDATES_FILE = path.join(WORK_DIR, 'candidates.json');
const TIMEZONE = 'Europe/Oslo';
const MAX_PER_SOURCE = 14;
const MAX_PROMPT_ITEMS = 52;
const FETCH_TIMEOUT_MS = 18_000;

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isObviousEntertainment(item) {
  const value = `${item.title} ${item.description}`;
  return /\b(box office|stage play|stage cast|actor dies|actress dies|movie trailer|film trailer|tv series|television series|casting deal|season finale|marvel studios)\b/i.test(value)
    && !/\b(video game|gaming|gameplay|playstation|xbox|nintendo|switch|steam|console|dlc|patch|mod|remaster|remake|developer|studio game)\b/i.test(value);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'sarcasm.games-gaming-news-local/1.0 (+https://sarcasm.games/news/)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectFeeds(now) {
  const settled = await Promise.all(SOURCES.map(async (source) => {
    try {
      const parsed = parseFeed(await fetchWithTimeout(source.feed), source)
        .filter((item) => !isObviousEntertainment(item))
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
        .slice(0, MAX_PER_SOURCE);
      if (!parsed.length) throw new Error('No usable feed entries');
      return {
        items: parsed,
        health: { id: source.id, name: source.name, homepage: source.homepage, status: 'ok', itemCount: parsed.length }
      };
    } catch (error) {
      return {
        items: [],
        health: {
          id: source.id,
          name: source.name,
          homepage: source.homepage,
          status: 'error',
          itemCount: 0,
          error: String(error?.message || error).slice(0, 160)
        }
      };
    }
  }));

  const all = settled.flatMap((result) => result.items);
  if (!all.length) throw new Error('No feeds could be read; previous edition remains published.');
  const cutoff = now.getTime() - 60 * 3_600_000;
  const recent = all.filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= cutoff);
  return {
    items: recent.length >= 15 ? recent : all,
    health: settled.map((result) => result.health)
  };
}

function localDate(now, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, dateStyle: 'long' }).format(now);
}

function dateKey(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function words(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function longestCommonRun(a, b) {
  const left = words(a);
  const right = words(b);
  let best = 0;
  const row = new Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = right.length; j >= 1; j -= 1) {
      row[j] = left[i - 1] === right[j - 1] ? row[j - 1] + 1 : 0;
      best = Math.max(best, row[j]);
    }
  }
  return best;
}

function hashId(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function bilingual(value, field, requireDifferent = true) {
  const no = String(value?.no || '').trim();
  const en = String(value?.en || '').trim();
  if (!no || !en) throw new Error(`${field} is not bilingual`);
  if (requireDifferent && no.toLowerCase() === en.toLowerCase()) throw new Error(`${field} was not translated`);
  return { no: no.slice(0, 900), en: en.slice(0, 900) };
}

function parseModelOutput(raw) {
  const text = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Codex did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

function finalizeStories(modelOutput, itemById) {
  if (!Array.isArray(modelOutput?.stories)) throw new Error('Codex output has no stories array');
  const stories = modelOutput.stories.map((story, index) => {
    const sourceItems = [...new Set(story.sourceIds || [])]
      .map((id) => itemById.get(id))
      .filter(Boolean);
    if (!sourceItems.length) throw new Error(`Story ${index + 1} has no valid source`);

    const title = bilingual(story.title, `Story ${index + 1} title`);
    const summary = bilingual(story.summary, `Story ${index + 1} summary`);
    if (summary.no.length < 60 || summary.en.length < 60) throw new Error(`Story ${index + 1} is too thin`);

    for (const source of sourceItems) {
      if (longestCommonRun(title.en, source.title) >= 9 || longestCommonRun(summary.en, source.description) >= 12) {
        throw new Error(`Story ${index + 1} copies source wording`);
      }
    }

    return {
      id: hashId(`${title.en}|${sourceItems[0].url}`),
      category: bilingual(story.category, `Story ${index + 1} category`, false),
      status: ['confirmed', 'reported', 'rumor'].includes(story.status) ? story.status : 'reported',
      title,
      summary,
      importance: Math.max(1, Math.min(10, Number(story.importance) || 5)),
      sources: sourceItems.slice(0, 4).map((source) => ({
        name: source.sourceName,
        url: source.url,
        publishedAt: source.publishedAt
      }))
    };
  }).sort((a, b) => b.importance - a.importance);

  if (stories.length < 5 || stories.length > 8) throw new Error('Edition must contain 5-8 rewritten stories');
  return stories;
}

async function readArchiveIndex() {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(ARCHIVE_DIR, 'index.json'), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEdition(edition) {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const json = `${JSON.stringify(edition, null, 2)}\n`;
  await fs.writeFile(path.join(DATA_DIR, 'latest.json'), json, 'utf8');
  await fs.writeFile(path.join(ARCHIVE_DIR, `${edition.date}.json`), json, 'utf8');
  const oldIndex = await readArchiveIndex();
  const next = [
    {
      date: edition.date,
      generatedAt: edition.generatedAt,
      storyCount: edition.stories.length,
      path: `/news/data/archive/${edition.date}.json`
    },
    ...oldIndex.filter((entry) => entry?.date !== edition.date)
  ].slice(0, 180);
  await fs.writeFile(path.join(ARCHIVE_DIR, 'index.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'automation.json'), `${JSON.stringify({
    date: edition.date,
    generatedAt: edition.generatedAt,
    provider: 'codex-local'
  }, null, 2)}\n`, 'utf8');
}

export async function prepare() {
  const now = new Date();
  const collected = await collectFeeds(now);
  const clusters = clusterItems(collected.items, now).slice(0, MAX_PROMPT_ITEMS);
  const promptItems = [];

  outer: for (const [clusterIndex, cluster] of clusters.entries()) {
    for (const [sourceIndex, item] of cluster.items.slice(0, 4).entries()) {
      if (promptItems.length >= MAX_PROMPT_ITEMS) break outer;
      const id = `item-${String(clusterIndex + 1).padStart(3, '0')}-${sourceIndex + 1}`;
      promptItems.push({
        id,
        sourceName: item.sourceName,
        title: item.title,
        description: item.description,
        publishedAt: item.publishedAt,
        url: item.url,
        corroboration: cluster.corroboration
      });
    }
  }

  if (promptItems.length < 5) throw new Error('Fewer than five usable candidate stories were collected.');
  const candidates = {
    schemaVersion: 1,
    date: dateKey(now),
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    editionTitle: {
      no: `Gamingnytt – ${localDate(now, 'nb-NO')}`,
      en: `Gaming news – ${localDate(now, 'en-GB')}`
    },
    sourceHealth: collected.health,
    items: promptItems
  };

  await fs.mkdir(WORK_DIR, { recursive: true });
  await fs.writeFile(CANDIDATES_FILE, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');
  console.log(`[gaming-news-local] Prepared ${promptItems.length} candidate entries for ${candidates.date}.`);
}

export async function publish(modelOutputPath) {
  if (!modelOutputPath) throw new Error('Missing Codex output path.');
  const candidates = JSON.parse(await fs.readFile(CANDIDATES_FILE, 'utf8'));
  const modelOutput = parseModelOutput(await fs.readFile(path.resolve(modelOutputPath), 'utf8'));
  const itemById = new Map(candidates.items.map((item) => [item.id, item]));
  const edition = {
    schemaVersion: 2,
    date: candidates.date,
    generatedAt: new Date().toISOString(),
    timezone: candidates.timezone,
    editionTitle: candidates.editionTitle,
    stories: finalizeStories(modelOutput, itemById),
    sourceHealth: candidates.sourceHealth
  };
  await writeEdition(edition);
  console.log(`[gaming-news-local] Published ${edition.stories.length} rewritten stories for ${edition.date}.`);
}

async function cli() {
  const command = process.argv[2];
  if (command === 'prepare') return prepare();
  if (command === 'publish') return publish(process.argv[3]);
  throw new Error('Usage: node scripts/gaming-news-local.mjs prepare | publish <codex-output.json>');
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (direct) cli().catch((error) => {
  console.error(`[gaming-news-local] ${error?.stack || error}`);
  process.exitCode = 1;
});

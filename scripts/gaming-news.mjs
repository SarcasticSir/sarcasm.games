import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEWS_DIR = path.join(ROOT, 'news');
const DATA_DIR = path.join(NEWS_DIR, 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const TIMEZONE = 'Europe/Oslo';
const MAX_PER_SOURCE = 14;
const MAX_PROMPT_ITEMS = 48;
const FETCH_TIMEOUT_MS = 18_000;

export const SOURCES = [
  { id: 'ign', name: 'IGN', homepage: 'https://www.ign.com/', feed: 'https://feeds.feedburner.com/ign/all', weight: 10 },
  { id: 'gamespot', name: 'GameSpot', homepage: 'https://www.gamespot.com/', feed: 'https://www.gamespot.com/feeds/mashup/', weight: 9 },
  { id: 'pcgamer', name: 'PC Gamer', homepage: 'https://www.pcgamer.com/', feed: 'https://www.pcgamer.com/rss/', weight: 9 },
  { id: 'eurogamer', name: 'Eurogamer', homepage: 'https://www.eurogamer.net/', feed: 'https://www.eurogamer.net/feed', weight: 9 },
  { id: 'polygon', name: 'Polygon', homepage: 'https://www.polygon.com/', feed: 'https://www.polygon.com/rss/index.xml', weight: 8 },
  { id: 'kotaku', name: 'Kotaku', homepage: 'https://kotaku.com/', feed: 'https://kotaku.com/rss', weight: 8 },
  { id: 'gamesradar', name: 'GamesRadar+', homepage: 'https://www.gamesradar.com/', feed: 'https://www.gamesradar.com/rss/', weight: 8 },
  { id: 'rockpapershotgun', name: 'Rock Paper Shotgun', homepage: 'https://www.rockpapershotgun.com/', feed: 'https://www.rockpapershotgun.com/feed', weight: 8 },
  { id: 'nintendolife', name: 'Nintendo Life', homepage: 'https://www.nintendolife.com/', feed: 'https://www.nintendolife.com/feeds/latest', weight: 7 },
  { id: 'pushsquare', name: 'Push Square', homepage: 'https://www.pushsquare.com/', feed: 'https://www.pushsquare.com/feeds/latest', weight: 7 }
];

const ENTITY_MAP = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…'
};

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITY_MAP[name.toLowerCase()] ?? match);
}

function cleanText(value = '') {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTag(block, tagNames) {
  for (const tagName of tagNames) {
    const escaped = tagName.replace(':', '\\:');
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return cleanText(match[1]);
  }
  return '';
}

function entryLink(block) {
  const atomAlternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)
    || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomAlternate) return decodeEntities(atomAlternate[1].trim());
  return firstTag(block, ['link', 'guid']);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFeed(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const entryBlocks = itemBlocks.length
    ? itemBlocks
    : [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);

  return entryBlocks
    .map((block, index) => {
      const title = firstTag(block, ['title']);
      const url = safeUrl(entryLink(block));
      const description = firstTag(block, ['description', 'summary', 'content:encoded', 'content']);
      const publishedRaw = firstTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
      const publishedDate = safeDate(publishedRaw);
      if (!title || !url) return null;
      return {
        id: `${source.id}-${index + 1}`,
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        title: title.slice(0, 320),
        description: description.slice(0, 1_200),
        url,
        publishedAt: publishedDate?.toISOString() ?? null
      };
    })
    .filter(Boolean);
}

function normalizeWords(value) {
  const stop = new Set(['the','a','an','and','or','of','to','in','on','for','with','is','are','was','will','this','that','from','as','at','by','its','it','your','you','new','game','games']);
  return new Set(cleanText(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length > 2 && !stop.has(word)));
}

function similarity(a, b) {
  const left = normalizeWords(a);
  const right = normalizeWords(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const word of left) if (right.has(word)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function ageHours(item, now) {
  if (!item.publishedAt) return 36;
  return Math.max(0, (now.getTime() - new Date(item.publishedAt).getTime()) / 3_600_000);
}

function itemScore(item, now) {
  const freshness = Math.max(0, 72 - ageHours(item, now));
  return item.sourceWeight * 10 + freshness;
}

export function clusterItems(items, now = new Date()) {
  const urlSeen = new Set();
  const sorted = [...items]
    .filter((item) => {
      if (!item.url || urlSeen.has(item.url)) return false;
      urlSeen.add(item.url);
      return true;
    })
    .sort((a, b) => itemScore(b, now) - itemScore(a, now));

  const clusters = [];
  for (const item of sorted) {
    const match = clusters.find((cluster) => similarity(cluster.headline, item.title) >= 0.62);
    if (match) {
      match.items.push(item);
      match.sourceIds.add(item.sourceId);
      if (itemScore(item, now) > itemScore(match.primary, now)) {
        match.primary = item;
        match.headline = item.title;
      }
    } else {
      clusters.push({ primary: item, headline: item.title, items: [item], sourceIds: new Set([item.sourceId]) });
    }
  }

  return clusters
    .map((cluster) => ({
      ...cluster,
      corroboration: cluster.sourceIds.size,
      score: itemScore(cluster.primary, now) + Math.min(30, (cluster.sourceIds.size - 1) * 12)
    }))
    .sort((a, b) => b.score - a.score);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'sarcasm.games-gaming-news/1.0 (+https://sarcasm.games/news/)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectFeeds(now = new Date()) {
  const settled = await Promise.all(SOURCES.map(async (source) => {
    try {
      const xml = await fetchWithTimeout(source.feed);
      const parsed = parseFeed(xml, source)
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
        .slice(0, MAX_PER_SOURCE);
      if (!parsed.length) throw new Error('No readable feed entries');
      return { source, items: parsed, health: { id: source.id, name: source.name, homepage: source.homepage, status: 'ok', itemCount: parsed.length } };
    } catch (error) {
      return { source, items: [], health: { id: source.id, name: source.name, homepage: source.homepage, status: 'error', itemCount: 0, error: String(error?.message || error).slice(0, 180) } };
    }
  }));

  const allItems = settled.flatMap((result) => result.items);
  if (!allItems.length) throw new Error('All configured gaming news feeds failed. Previous edition was kept.');

  const recentCutoff = now.getTime() - 60 * 3_600_000;
  const recent = allItems.filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= recentCutoff);
  return {
    items: recent.length >= 15 ? recent : allItems,
    health: settled.map((result) => result.health)
  };
}

function osloDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function localDateLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, dateStyle: 'long' }).format(date);
}

function hashId(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function outputSchema() {
  const bilingual = {
    type: 'object', additionalProperties: false, required: ['no', 'en'],
    properties: { no: { type: 'string' }, en: { type: 'string' } }
  };
  const story = {
    type: 'object', additionalProperties: false,
    required: ['category', 'status', 'title', 'summary', 'whyItMatters', 'sourceIds', 'importance'],
    properties: {
      category: bilingual,
      status: { type: 'string', enum: ['confirmed', 'reported', 'rumor'] },
      title: bilingual,
      summary: bilingual,
      whyItMatters: bilingual,
      sourceIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
      importance: { type: 'integer', minimum: 1, maximum: 10 }
    }
  };
  const brief = {
    type: 'object', additionalProperties: false,
    required: ['title', 'summary', 'sourceIds'],
    properties: {
      title: bilingual,
      summary: bilingual,
      sourceIds: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } }
    }
  };
  return {
    type: 'object', additionalProperties: false, required: ['intro', 'stories', 'briefs'],
    properties: {
      intro: bilingual,
      stories: { type: 'array', minItems: 4, maxItems: 8, items: story },
      briefs: { type: 'array', minItems: 2, maxItems: 8, items: brief }
    }
  };
}

function responseText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain output text');
}

async function generateWithOpenAI(promptItems, now) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
  const dateNo = localDateLabel(now, 'nb-NO');
  const dateEn = localDateLabel(now, 'en-GB');
  const system = `You are the automated gaming-news editor for sarcasm.games. Produce a compact daily edition in Norwegian Bokmål and English. Use only the supplied feed material. Never invent dates, prices, platforms, quotes, announcements, or causal explanations. Combine duplicate reports about the same event. Prefer announcements, releases, major updates, studio/business changes, platform news, and materially important industry reporting. Avoid guides, shopping posts, SEO filler, opinion pieces and minor entertainment trivia unless there is little other news. A primary/official source or several independent reports may be marked confirmed; a single publication should normally be reported; explicitly speculative material must be rumor. Do not copy sentences from descriptions. Summaries should be 2-3 sentences, why-it-matters one sentence, and briefs one sentence. Keep sourceIds exactly as supplied.`;
  const user = `Edition dates: Norwegian ${dateNo}; English ${dateEn}. Candidate items:\n${JSON.stringify(promptItems)}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'low' },
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] }
      ],
      text: {
        format: {
          type: 'json_schema', name: 'gaming_news_digest', strict: true, schema: outputSchema()
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI HTTP ${response.status}`;
    throw new Error(message);
  }
  return JSON.parse(responseText(payload));
}

function sourceRecords(sourceIds, itemById) {
  const seen = new Set();
  return sourceIds
    .map((id) => itemById.get(id))
    .filter((item) => item && !seen.has(item.url) && seen.add(item.url))
    .map((item) => ({ name: item.sourceName, url: item.url, publishedAt: item.publishedAt }));
}

function sanitizeBilingual(value, fallback = '') {
  return {
    no: String(value?.no || fallback).trim().slice(0, 900),
    en: String(value?.en || value?.no || fallback).trim().slice(0, 900)
  };
}

function finalizeAiEdition(ai, itemById) {
  const stories = (ai.stories || [])
    .map((story) => {
      const sources = sourceRecords(story.sourceIds || [], itemById);
      if (!sources.length) return null;
      const title = sanitizeBilingual(story.title);
      return {
        id: hashId(`${title.en}|${sources[0].url}`),
        category: sanitizeBilingual(story.category, 'Gaming'),
        status: ['confirmed', 'reported', 'rumor'].includes(story.status) ? story.status : 'reported',
        title,
        summary: sanitizeBilingual(story.summary),
        whyItMatters: sanitizeBilingual(story.whyItMatters),
        importance: Math.max(1, Math.min(10, Number(story.importance) || 5)),
        sources
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);

  const briefs = (ai.briefs || [])
    .map((brief) => {
      const sources = sourceRecords(brief.sourceIds || [], itemById);
      if (!sources.length) return null;
      const title = sanitizeBilingual(brief.title);
      return {
        id: hashId(`${title.en}|brief|${sources[0].url}`),
        title,
        summary: sanitizeBilingual(brief.summary),
        sources
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  if (stories.length < 3) throw new Error('AI edition contained too few valid sourced stories');
  return { intro: sanitizeBilingual(ai.intro), stories, briefs };
}

function fallbackEdition(clusters, itemById, now) {
  const selected = clusters.slice(0, 10);
  const stories = selected.slice(0, 7).map((cluster, index) => {
    const primary = cluster.primary;
    const sources = cluster.items.slice(0, 3).map((item) => item.id);
    const summary = primary.description
      ? primary.description.slice(0, 360)
      : `Published by ${primary.sourceName}. Open the original source for the full report.`;
    return {
      id: hashId(`${primary.title}|${primary.url}`),
      category: { no: 'Gaming', en: 'Gaming' },
      status: 'reported',
      title: { no: primary.title, en: primary.title },
      summary: { no: summary, en: summary },
      whyItMatters: {
        no: cluster.corroboration > 1 ? `Saken omtales av ${cluster.corroboration} av de valgte kildene.` : 'AI-redigert forklaring er ikke aktiv i denne reserveutgaven.',
        en: cluster.corroboration > 1 ? `The story appears across ${cluster.corroboration} selected sources.` : 'AI-edited context is not active in this fallback edition.'
      },
      importance: Math.max(3, 9 - index),
      sources: sourceRecords(sources, itemById)
    };
  });
  const briefs = selected.slice(7, 10).map((cluster) => ({
    id: hashId(`${cluster.primary.title}|brief|${cluster.primary.url}`),
    title: { no: cluster.primary.title, en: cluster.primary.title },
    summary: {
      no: `Kort oppføring fra ${cluster.primary.sourceName}.`,
      en: `Brief listing from ${cluster.primary.sourceName}.`
    },
    sources: sourceRecords([cluster.primary.id], itemById)
  }));
  return {
    intro: {
      no: `Automatisk oversikt for ${localDateLabel(now, 'nb-NO')}. Denne reserveutgaven viser kildebaserte overskrifter fordi AI-redigering ikke var tilgjengelig.`,
      en: `Automated overview for ${localDateLabel(now, 'en-GB')}. This fallback edition shows source-based headlines because AI editing was unavailable.`
    },
    stories,
    briefs
  };
}

async function readArchiveIndex() {
  try {
    const content = await fs.readFile(path.join(ARCHIVE_DIR, 'index.json'), 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEdition(edition) {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const pretty = `${JSON.stringify(edition, null, 2)}\n`;
  await fs.writeFile(path.join(DATA_DIR, 'latest.json'), pretty, 'utf8');
  await fs.writeFile(path.join(ARCHIVE_DIR, `${edition.date}.json`), pretty, 'utf8');

  const index = await readArchiveIndex();
  const next = [
    { date: edition.date, generatedAt: edition.generatedAt, mode: edition.mode, storyCount: edition.stories.length, path: `/news/data/archive/${edition.date}.json` },
    ...index.filter((entry) => entry?.date !== edition.date)
  ].slice(0, 180);
  await fs.writeFile(path.join(ARCHIVE_DIR, 'index.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

export async function main() {
  const now = new Date();
  const date = osloDateParts(now);
  const collected = await collectFeeds(now);
  const clusters = clusterItems(collected.items, now).slice(0, MAX_PROMPT_ITEMS);
  const promptItems = [];
  const itemById = new Map();

  outer: for (const [clusterIndex, cluster] of clusters.entries()) {
    for (const [sourceIndex, item] of cluster.items.slice(0, 4).entries()) {
      if (promptItems.length >= MAX_PROMPT_ITEMS) break outer;
      const id = `item-${String(clusterIndex + 1).padStart(3, '0')}-${sourceIndex + 1}`;
      const normalized = { ...item, id };
      itemById.set(item.id, item);
      itemById.set(id, normalized);
      promptItems.push({
        id,
        source: normalized.sourceName,
        title: normalized.title,
        description: normalized.description,
        publishedAt: normalized.publishedAt,
        url: normalized.url,
        corroboration: cluster.corroboration
      });
    }
  }

  let mode = 'ai';
  let editorial;
  try {
    const ai = await generateWithOpenAI(promptItems, now);
    if (!ai) {
      mode = 'headline-fallback';
      editorial = fallbackEdition(clusters, itemById, now);
    } else {
      editorial = finalizeAiEdition(ai, itemById);
    }
  } catch (error) {
    console.warn(`[gaming-news] AI generation failed; publishing safe fallback: ${error?.message || error}`);
    mode = 'headline-fallback';
    editorial = fallbackEdition(clusters, itemById, now);
  }

  const edition = {
    schemaVersion: 1,
    mode,
    date,
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    editionTitle: {
      no: `Gamingnytt – ${localDateLabel(now, 'nb-NO')}`,
      en: `Gaming news – ${localDateLabel(now, 'en-GB')}`
    },
    intro: editorial.intro,
    stories: editorial.stories,
    briefs: editorial.briefs,
    sourceHealth: collected.health,
    editorialPolicy: {
      no: 'Kondensert fra valgte kilder. Rykter merkes tydelig, og alle saker lenker til originalkildene.',
      en: 'Condensed from selected sources. Rumours are labelled, and every item links to its original sources.'
    }
  };

  await writeEdition(edition);
  console.log(`[gaming-news] Wrote ${edition.mode} edition ${edition.date}: ${edition.stories.length} stories, ${edition.briefs.length} briefs.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[gaming-news] ${error?.stack || error}`);
    process.exitCode = 1;
  });
}

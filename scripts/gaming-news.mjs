import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'news', 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const TIMEZONE = 'Europe/Oslo';
const MAX_PER_SOURCE = 14;
const MAX_PROMPT_ITEMS = 52;
const FETCH_TIMEOUT_MS = 18_000;
const MODEL_ATTEMPTS = 3;

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

const ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };

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
  const atom = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)
    || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return atom ? decodeEntities(atom[1].trim()) : firstTag(block, ['link', 'guid']);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function parseFeed(xml, source) {
  const rss = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const blocks = rss.length ? rss : [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
  return blocks.map((block, index) => {
    const title = firstTag(block, ['title']);
    const url = safeUrl(entryLink(block));
    if (!title || !url) return null;
    const rawDate = firstTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const parsedDate = new Date(rawDate);
    return {
      id: `${source.id}-${index + 1}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceWeight: source.weight,
      title: title.slice(0, 320),
      description: firstTag(block, ['description', 'summary', 'content:encoded', 'content']).slice(0, 1_200),
      url,
      publishedAt: Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
    };
  }).filter(Boolean);
}

function wordSet(value) {
  const stop = new Set(['the','a','an','and','or','of','to','in','on','for','with','is','are','was','will','this','that','from','as','at','by','its','it','your','you','new','game','games']);
  return new Set(cleanText(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length > 2 && !stop.has(word)));
}

function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / (left.size + right.size - common);
}

function itemScore(item, now) {
  const age = item.publishedAt ? Math.max(0, (now - new Date(item.publishedAt)) / 3_600_000) : 36;
  return item.sourceWeight * 10 + Math.max(0, 72 - age);
}

export function clusterItems(items, now = new Date()) {
  const seen = new Set();
  const sorted = [...items].filter((item) => item.url && !seen.has(item.url) && seen.add(item.url)).sort((a, b) => itemScore(b, now) - itemScore(a, now));
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
  return clusters.map((cluster) => ({
    ...cluster,
    corroboration: cluster.sourceIds.size,
    score: itemScore(cluster.primary, now) + Math.min(30, (cluster.sourceIds.size - 1) * 12)
  })).sort((a, b) => b.score - a.score);
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
        'user-agent': 'sarcasm.games-gaming-news/2.1 (+https://sarcasm.games/news/)',
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
      return { items: parsed, health: { id: source.id, name: source.name, homepage: source.homepage, status: 'ok', itemCount: parsed.length } };
    } catch (error) {
      return { items: [], health: { id: source.id, name: source.name, homepage: source.homepage, status: 'error', itemCount: 0, error: String(error?.message || error).slice(0, 160) } };
    }
  }));
  const all = settled.flatMap((result) => result.items);
  if (!all.length) throw new Error('No feeds could be read; previous edition remains published.');
  const cutoff = now.getTime() - 60 * 3_600_000;
  const recent = all.filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= cutoff);
  return { items: recent.length >= 15 ? recent : all, health: settled.map((result) => result.health) };
}

function localDate(now, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, dateStyle: 'long' }).format(now);
}

function dateKey(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function extractJson(value) {
  const text = String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

async function rewriteWithGitHubModels(promptItems, now, feedback = '') {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error('GITHUB_TOKEN is unavailable; no copied fallback will be published.');
  const model = process.env.GITHUB_MODEL?.trim() || 'openai/gpt-4o';
  const instructions = `You edit a daily gaming-news page. Select 5-8 genuinely important gaming stories from the supplied feed entries and rewrite them in Norwegian Bokmål and English.

Rules:
- Use only supplied facts. Never invent details.
- Exclude film, television, celebrity, shopping, guides and general entertainment.
- Merge duplicate coverage of the same event.
- Rewrite both headline and summary from scratch. Do not copy the source headline or source sentences.
- Keep it compact: headline plus 2-3 factual sentences. No introduction, commentary, filler, hype, "why it matters", or editorial explanation.
- Mark unconfirmed speculation as rumor. A single outlet normally means reported. Confirmed is reserved for official announcements or multiple independent sources.
- Return plain JSON only, exactly: {"stories":[{"category":{"no":"","en":""},"status":"confirmed|reported|rumor","title":{"no":"","en":""},"summary":{"no":"","en":""},"sourceIds":["item-id"],"importance":1}]}
- sourceIds must be copied exactly from the supplied entries.`;
  const correction = feedback ? `\n\nThe previous attempt was rejected for this reason: ${feedback}. Correct that problem in the new output.` : '';
  const response = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: 5000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: `Edition date: ${localDate(now, 'nb-NO')} / ${localDate(now, 'en-GB')}\n\nFeed entries:\n${JSON.stringify(promptItems)}${correction}` }
      ]
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `GitHub Models HTTP ${response.status}`);
  return extractJson(payload?.choices?.[0]?.message?.content);
}

function words(value) {
  return cleanText(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
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

function finalizeStories(modelOutput, itemById) {
  if (!Array.isArray(modelOutput?.stories)) throw new Error('Model output has no stories array');
  const stories = modelOutput.stories.map((story, index) => {
    const sourceItems = [...new Set(story.sourceIds || [])].map((id) => itemById.get(id)).filter(Boolean);
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
      sources: sourceItems.slice(0, 4).map((source) => ({ name: source.sourceName, url: source.url, publishedAt: source.publishedAt }))
    };
  }).sort((a, b) => b.importance - a.importance);
  if (stories.length < 5 || stories.length > 8) throw new Error('Edition must contain 5-8 rewritten stories');
  return stories;
}

async function generateStories(promptItems, itemById, now) {
  let feedback = '';
  let lastError = null;
  for (let attempt = 1; attempt <= MODEL_ATTEMPTS; attempt += 1) {
    try {
      const output = await rewriteWithGitHubModels(promptItems, now, feedback);
      return finalizeStories(output, itemById);
    } catch (error) {
      lastError = error;
      feedback = String(error?.message || error).slice(0, 300);
      console.warn(`[gaming-news] Model attempt ${attempt} failed: ${feedback}`);
    }
  }
  throw new Error(`All model attempts failed; previous edition remains published. Last error: ${lastError?.message || lastError}`);
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
    { date: edition.date, generatedAt: edition.generatedAt, storyCount: edition.stories.length, path: `/news/data/archive/${edition.date}.json` },
    ...oldIndex.filter((entry) => entry?.date !== edition.date)
  ].slice(0, 180);
  await fs.writeFile(path.join(ARCHIVE_DIR, 'index.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

export async function main() {
  const now = new Date();
  const collected = await collectFeeds(now);
  const clusters = clusterItems(collected.items, now).slice(0, MAX_PROMPT_ITEMS);
  const promptItems = [];
  const itemById = new Map();
  outer: for (const [clusterIndex, cluster] of clusters.entries()) {
    for (const [sourceIndex, item] of cluster.items.slice(0, 4).entries()) {
      if (promptItems.length >= MAX_PROMPT_ITEMS) break outer;
      const id = `item-${String(clusterIndex + 1).padStart(3, '0')}-${sourceIndex + 1}`;
      itemById.set(id, item);
      promptItems.push({ id, source: item.sourceName, title: item.title, description: item.description, publishedAt: item.publishedAt, url: item.url, corroboration: cluster.corroboration });
    }
  }
  const edition = {
    schemaVersion: 2,
    date: dateKey(now),
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    editionTitle: { no: `Gamingnytt – ${localDate(now, 'nb-NO')}`, en: `Gaming news – ${localDate(now, 'en-GB')}` },
    stories: await generateStories(promptItems, itemById, now),
    sourceHealth: collected.health
  };
  await writeEdition(edition);
  console.log(`[gaming-news] Published ${edition.stories.length} rewritten stories for ${edition.date}.`);
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (direct) main().catch((error) => { console.error(`[gaming-news] ${error?.stack || error}`); process.exitCode = 1; });

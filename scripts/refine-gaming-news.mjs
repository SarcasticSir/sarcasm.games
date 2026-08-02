import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LATEST = path.join(ROOT, 'news', 'data', 'latest.json');

const NON_GAMING = /\b(box office|stage cast|theatre cast|actor dies|actress dies|dies at \d+|tv series|television series|movie review|film review|netflix series|hbo series|disney\+ series|marvel studios|the sopranos|game of thrones.*stage|squid game|comic book issue|warner bros.*talent|casting deal)\b/i;
const GAMING_CONTEXT = /\b(video game|gaming|gameplay|playstation|ps5|ps6|xbox|nintendo|switch|steam|pc gaming|console|dlc|patch|mod support|remaster|remake|early access|esports|developer|development studio|game studio|gamescom)\b/i;

function text(entry) {
  return [entry?.title?.no, entry?.title?.en, entry?.summary?.no, entry?.summary?.en, ...(entry?.sources || []).map((source) => source.url)].filter(Boolean).join(' ');
}

function hasGamingContext(value) {
  if (GAMING_CONTEXT.test(value)) return true;
  return /\bgames?\b/i.test(value) && !/\b(game of thrones|squid game)\b/i.test(value);
}

function isGaming(entry) {
  const value = text(entry);
  const gamingContext = hasGamingContext(value);
  if (NON_GAMING.test(value) && !gamingContext) return false;
  const sources = entry?.sources || [];
  const onlyIgn = sources.length > 0 && sources.every((source) => source.name === 'IGN');
  if (onlyIgn && !gamingContext) return false;
  return true;
}

function cleanSummary(value, sourceName) {
  const cleaned = String(value || '')
    .replace(/\s*(read|learn|find out) more\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 45) return cleaned.slice(0, 420);
  return `Published by ${sourceName || 'the original source'}. Open the source link for the full report.`;
}

function idFor(entry) {
  return crypto.createHash('sha256').update(`${entry?.title?.en || entry?.title?.no}|${entry?.sources?.[0]?.url || ''}`).digest('hex').slice(0, 12);
}

const data = JSON.parse(await fs.readFile(LATEST, 'utf8'));
if (data.mode !== 'headline-fallback') {
  console.log('[gaming-news] AI or draft edition; fallback refinement skipped.');
  process.exit(0);
}

const retainedStories = (data.stories || []).filter(isGaming).map((story) => {
  const sourceName = story.sources?.[0]?.name;
  return {
    ...story,
    summary: {
      no: cleanSummary(story.summary?.no || story.summary?.en, sourceName),
      en: cleanSummary(story.summary?.en || story.summary?.no, sourceName)
    }
  };
});

const retainedBriefs = (data.briefs || []).filter(isGaming);
const usedUrls = new Set(retainedStories.flatMap((story) => (story.sources || []).map((source) => source.url)));

while (retainedStories.length < 7 && retainedBriefs.length) {
  const brief = retainedBriefs.shift();
  const source = (brief.sources || []).find((candidate) => !usedUrls.has(candidate.url)) || brief.sources?.[0];
  if (!source || usedUrls.has(source.url)) continue;
  usedUrls.add(source.url);
  retainedStories.push({
    id: idFor(brief),
    category: { no: 'Gaming', en: 'Gaming' },
    status: 'reported',
    title: brief.title,
    summary: {
      no: cleanSummary(brief.summary?.no || brief.summary?.en, source.name),
      en: cleanSummary(brief.summary?.en || brief.summary?.no, source.name)
    },
    whyItMatters: {
      no: 'AI-redigert forklaring er ikke aktiv i denne reserveutgaven.',
      en: 'AI-edited context is not active in this fallback edition.'
    },
    importance: 3,
    sources: brief.sources
  });
}

data.stories = retainedStories.slice(0, 7).map((story, index) => ({ ...story, importance: Math.max(3, 9 - index) }));
data.briefs = retainedBriefs.slice(0, 6);

const output = `${JSON.stringify(data, null, 2)}\n`;
await fs.writeFile(LATEST, output, 'utf8');
await fs.writeFile(path.join(ROOT, 'news', 'data', 'archive', `${data.date}.json`), output, 'utf8');
console.log(`[gaming-news] Refined fallback to ${data.stories.length} gaming stories and ${data.briefs.length} briefs.`);

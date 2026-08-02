import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const latestPath = path.join(ROOT, 'news', 'data', 'latest.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validBilingual(value) {
  return value && typeof value.no === 'string' && value.no.trim() && typeof value.en === 'string' && value.en.trim();
}

function validateSource(source, context) {
  assert(source && typeof source.name === 'string' && source.name.trim(), `${context}: missing source name`);
  assert(typeof source.url === 'string' && /^https:\/\//.test(source.url), `${context}: source URL must be HTTPS`);
}

export function validateEdition(data) {
  assert(data?.schemaVersion === 1, 'Unsupported schemaVersion');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data.date), 'Invalid edition date');
  assert(!Number.isNaN(new Date(data.generatedAt).getTime()), 'Invalid generatedAt');
  assert(['ai', 'headline-fallback', 'draft'].includes(data.mode), 'Invalid mode');
  assert(validBilingual(data.editionTitle), 'Missing bilingual edition title');
  assert(validBilingual(data.intro), 'Missing bilingual intro');
  assert(Array.isArray(data.stories), 'stories must be an array');
  assert(Array.isArray(data.briefs), 'briefs must be an array');
  assert(Array.isArray(data.sourceHealth) && data.sourceHealth.length === 10, 'Exactly ten source health records are required');

  const ids = new Set();
  for (const [index, story] of data.stories.entries()) {
    const context = `story ${index + 1}`;
    assert(typeof story.id === 'string' && story.id, `${context}: missing id`);
    assert(!ids.has(story.id), `${context}: duplicate id`);
    ids.add(story.id);
    assert(validBilingual(story.category), `${context}: missing category`);
    assert(validBilingual(story.title), `${context}: missing title`);
    assert(validBilingual(story.summary), `${context}: missing summary`);
    assert(validBilingual(story.whyItMatters), `${context}: missing whyItMatters`);
    assert(['confirmed', 'reported', 'rumor'].includes(story.status), `${context}: invalid status`);
    assert(Number.isInteger(story.importance) && story.importance >= 1 && story.importance <= 10, `${context}: invalid importance`);
    assert(Array.isArray(story.sources) && story.sources.length >= 1, `${context}: missing sources`);
    story.sources.forEach((source, sourceIndex) => validateSource(source, `${context} source ${sourceIndex + 1}`));
  }

  for (const [index, brief] of data.briefs.entries()) {
    const context = `brief ${index + 1}`;
    assert(typeof brief.id === 'string' && brief.id, `${context}: missing id`);
    assert(!ids.has(brief.id), `${context}: duplicate id`);
    ids.add(brief.id);
    assert(validBilingual(brief.title), `${context}: missing title`);
    assert(validBilingual(brief.summary), `${context}: missing summary`);
    assert(Array.isArray(brief.sources) && brief.sources.length >= 1, `${context}: missing sources`);
    brief.sources.forEach((source, sourceIndex) => validateSource(source, `${context} source ${sourceIndex + 1}`));
  }
  return true;
}

async function main() {
  const data = JSON.parse(await fs.readFile(latestPath, 'utf8'));
  validateEdition(data);
  const archivePath = path.join(ROOT, 'news', 'data', 'archive', `${data.date}.json`);
  await fs.access(archivePath);
  console.log(`[gaming-news] Validated ${data.date} (${data.mode}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[gaming-news] Validation failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const latestPath = path.join(ROOT, 'news', 'data', 'latest.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function bilingual(value) {
  return value && typeof value.no === 'string' && value.no.trim() && typeof value.en === 'string' && value.en.trim() && value.no.trim() !== value.en.trim();
}

export function validateEdition(data) {
  assert(data?.schemaVersion === 2, 'Unsupported schemaVersion');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data.date), 'Invalid edition date');
  assert(!Number.isNaN(new Date(data.generatedAt).getTime()), 'Invalid generatedAt');
  assert(bilingual(data.editionTitle), 'Missing bilingual edition title');
  assert(Array.isArray(data.stories) && data.stories.length >= 5 && data.stories.length <= 8, 'Edition must contain 5-8 stories');
  assert(Array.isArray(data.sourceHealth) && data.sourceHealth.length === 10, 'Exactly ten source records are required');

  const ids = new Set();
  for (const [index, story] of data.stories.entries()) {
    const context = `story ${index + 1}`;
    assert(typeof story.id === 'string' && story.id, `${context}: missing id`);
    assert(!ids.has(story.id), `${context}: duplicate id`);
    ids.add(story.id);
    assert(bilingual(story.category), `${context}: category is not bilingual`);
    assert(bilingual(story.title), `${context}: title is not bilingual or rewritten`);
    assert(bilingual(story.summary), `${context}: summary is not bilingual or rewritten`);
    assert(story.summary.no.length >= 80 && story.summary.en.length >= 80, `${context}: summary is too short`);
    assert(['confirmed', 'reported', 'rumor'].includes(story.status), `${context}: invalid status`);
    assert(Number.isInteger(story.importance) && story.importance >= 1 && story.importance <= 10, `${context}: invalid importance`);
    assert(Array.isArray(story.sources) && story.sources.length >= 1, `${context}: missing sources`);
    for (const source of story.sources) {
      assert(typeof source.name === 'string' && source.name.trim(), `${context}: missing source name`);
      assert(typeof source.url === 'string' && /^https:\/\//.test(source.url), `${context}: invalid source URL`);
    }
  }
  return true;
}

async function main() {
  const data = JSON.parse(await fs.readFile(latestPath, 'utf8'));
  validateEdition(data);
  await fs.access(path.join(ROOT, 'news', 'data', 'archive', `${data.date}.json`));
  console.log(`[gaming-news] Validated ${data.date}: ${data.stories.length} rewritten stories.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[gaming-news] Validation failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}

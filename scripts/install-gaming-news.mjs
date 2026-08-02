import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
let html = await fs.readFile(indexPath, 'utf8');
let changed = false;

if (!html.includes("href: '/news/'")) {
  const marker = "    const GAMES = [\n";
  if (!html.includes(marker)) throw new Error('Could not find GAMES array in index.html');
  const item = "      { href: '/news/', title: { en: 'News', no: 'Nyheter' }, tooltip: { en: 'A concise daily gaming news edition', no: 'En kondensert daglig utgave med gamingnyheter' } },\n";
  html = html.replace(marker, marker + item);
  changed = true;
}

const oldTitleLine = '        anchor.textContent = game.title;';
if (html.includes(oldTitleLine)) {
  const newTitleLines = [
    "        anchor.textContent = typeof game.title === 'string'",
    '          ? game.title',
    '          : (game.title[currentLanguage] || game.title.en);'
  ].join('\n');
  html = html.replace(oldTitleLine, newTitleLines);
  changed = true;
}

if (changed) {
  await fs.writeFile(indexPath, html, 'utf8');
  console.log('[gaming-news] Added bilingual News/Nyheter menu entry.');
} else {
  console.log('[gaming-news] Homepage menu already configured.');
}

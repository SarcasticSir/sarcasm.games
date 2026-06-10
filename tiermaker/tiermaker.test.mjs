import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

function getInlineScripts() {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
}

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Could not find function ${name}`);

  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }

  throw new Error(`Could not find the end of function ${name}`);
}

function extractConstObject(name) {
  const start = html.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `Could not find constant ${name}`);

  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 2);
    }
  }

  throw new Error(`Could not find the end of constant ${name}`);
}

function createApi({ storedLanguage = null, browserLanguage = 'en-US', storageError = false } = {}) {
  const storage = new Map();
  if (storedLanguage !== null) storage.set('quizLanguage', storedLanguage);

  const context = vm.createContext({
    navigator: { language: browserLanguage },
    localStorage: {
      getItem(key) {
        if (storageError) throw new Error('Storage unavailable');
        return storage.get(key) ?? null;
      }
    }
  });

  const source = [
    "const TIER_LANGUAGE_KEY = 'quizLanguage';",
    extractConstObject('TIER_TRANSLATIONS'),
    extractFunction('getTierLanguage'),
    extractFunction('getTierTranslations'),
    extractFunction('getDefaultColumnLabel'),
    extractFunction('isRecognizedImportHeader'),
    'globalThis.__api = { TIER_TRANSLATIONS, getTierLanguage, getTierTranslations, getDefaultColumnLabel, isRecognizedImportHeader };'
  ].join('\n');

  vm.runInContext(source, context);
  return context.__api;
}

test('recognized import headers cover supported English and Norwegian variants', () => {
  const { isRecognizedImportHeader } = createApi();
  const accepted = [
    'Title', ' item ', 'ITEM_TITLE', 'item-name', 'Name',
    'Tittel', 'element', 'Elementtittel', 'navn', 'elementnavn'
  ];

  for (const value of accepted) {
    assert.equal(isRecognizedImportHeader(value), true, `${value} should be recognized`);
  }
});

test('ordinary first-row values are kept as data', () => {
  const { isRecognizedImportHeader } = createApi();
  const rejected = ['The Matrix', 'Movie', '1999', '', 'Genre', 42, null, undefined];

  for (const value of rejected) {
    assert.equal(isRecognizedImportHeader(value), false, `${String(value)} should remain data`);
  }
});

test('stored language takes precedence over browser language', () => {
  assert.equal(createApi({ storedLanguage: 'no', browserLanguage: 'en-US' }).getTierLanguage(), 'no');
  assert.equal(createApi({ storedLanguage: 'en', browserLanguage: 'nb-NO' }).getTierLanguage(), 'en');
});

test('browser language is used when storage is missing, invalid, or unavailable', () => {
  assert.equal(createApi({ browserLanguage: 'nb-NO' }).getTierLanguage(), 'no');
  assert.equal(createApi({ browserLanguage: 'nn-NO' }).getTierLanguage(), 'no');
  assert.equal(createApi({ browserLanguage: 'en-GB' }).getTierLanguage(), 'en');
  assert.equal(createApi({ storedLanguage: 'de', browserLanguage: 'en-US' }).getTierLanguage(), 'en');
  assert.equal(createApi({ browserLanguage: 'no-NO', storageError: true }).getTierLanguage(), 'no');
});

test('translation dictionaries stay structurally aligned', () => {
  const { TIER_TRANSLATIONS } = createApi();
  assert.deepEqual(
    Object.keys(TIER_TRANSLATIONS.no).sort(),
    Object.keys(TIER_TRANSLATIONS.en).sort()
  );

  for (const language of ['en', 'no']) {
    for (const [key, value] of Object.entries(TIER_TRANSLATIONS[language])) {
      assert.equal(typeof value, 'string', `${language}.${key} must be text`);
      assert.notEqual(value.trim(), '', `${language}.${key} must not be empty`);
    }
  }
});

test('default column labels follow the active language', () => {
  assert.equal(createApi({ storedLanguage: 'en' }).getDefaultColumnLabel(0), 'Column B');
  assert.equal(createApi({ storedLanguage: 'en' }).getDefaultColumnLabel(5), 'Column G');
  assert.equal(createApi({ storedLanguage: 'no' }).getDefaultColumnLabel(0), 'Kolonne B');
  assert.equal(createApi({ storedLanguage: 'no' }).getDefaultColumnLabel(5), 'Kolonne G');
});

test('help and settings dialogs expose the expected accessibility contracts', () => {
  assert.match(html, /id="helpPanel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="helpTitle"/);
  assert.match(html, /id="settingsPanel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="settingsTitle"/);
  assert.match(html, /id="importHelpBtn"[^>]*aria-label="Excel import help"/);
  assert.match(html, /document\.addEventListener\('keydown',[\s\S]*event\.key !== 'Escape'/);
});

test('all inline JavaScript compiles', () => {
  const scripts = getInlineScripts();
  assert.ok(scripts.length > 0, 'Expected at least one inline script');

  for (const source of scripts) {
    assert.doesNotThrow(() => new vm.Script(source));
  }
});

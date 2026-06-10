import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const edgePath = process.env.EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = new URL('../tiermaker/index.html', import.meta.url);
const html = await readFile(htmlPath);
const profileDir = await mkdtemp(join(tmpdir(), 'tiermaker-browser-test-'));
const debugPort = 9300 + Math.floor(Math.random() * 500);

const server = createServer((request, response) => {
  if (request.url === '/tiermaker/' || request.url === '/tiermaker/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  response.writeHead(404);
  response.end('Not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browserProcess = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `http://127.0.0.1:${port}/tiermaker/`
], { stdio: 'ignore', windowsHide: true });

let socket;
let nextId = 1;
const pending = new Map();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function poll(callback, message, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await callback();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`);
}

async function command(method, params = {}) {
  const id = nextId++;
  const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method, params }));
  return result;
}

async function evaluate(expression) {
  const response = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || 'Browser evaluation failed');
  }
  return response.result.value;
}

async function importFile(name, contents) {
  await evaluate(`(() => {
    const input = document.getElementById('fileInput');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(contents)}], ${JSON.stringify(name)}));
    Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await delay(100);
}

const checks = [];
async function check(name, callback) {
  await callback();
  checks.push(name);
  console.log(`PASS ${name}`);
}

try {
  const version = await poll(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    return response.ok ? response.json() : null;
  }, 'Edge did not expose its debugging endpoint');

  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const targets = await poll(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
    const list = await response.json();
    return list.find((target) => target.type === 'page' && target.url.includes('/tiermaker/'));
  }, 'Tiermaker browser tab was not created');

  socket.close();
  socket = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  await command('Runtime.enable');
  await poll(
    () => evaluate("document.readyState !== 'loading' && Boolean(document.getElementById('importHelpBtn'))"),
    'Tiermaker did not initialize'
  );
  await evaluate("localStorage.clear(); localStorage.setItem('quizLanguage', 'no'); location.reload(); true");
  await poll(
    () => evaluate("document.readyState === 'complete' && document.getElementById('importHelpBtn')?.title === 'Hjelp med Excel-import'"),
    'Norwegian tiermaker did not initialize after reload'
  );

  await check('Norwegian help dialog opens with translated content', async () => {
    const result = await evaluate(`(() => {
      document.getElementById('importHelpBtn').click();
      return {
        visible: document.getElementById('helpPanel').style.display,
        title: document.getElementById('helpTitle').textContent,
        close: document.getElementById('closeHelpBtn').textContent,
        focused: document.activeElement.id
      };
    })()`);
    assert.deepEqual(result, {
      visible: 'block',
      title: 'Slik importerer du fra Excel',
      close: 'Lukk',
      focused: 'closeHelpBtn'
    });
  });

  await check('Escape closes help and returns focus', async () => {
    const result = await evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return {
        visible: document.getElementById('helpPanel').style.display,
        focused: document.activeElement.id
      };
    })()`);
    assert.deepEqual(result, { visible: 'none', focused: 'importHelpBtn' });
  });

  await check('Column settings save labels and display choices', async () => {
    const result = await evaluate(`(() => {
      document.getElementById('settingsBtn').click();
      const container = document.getElementById('columnSettingsContainer');
      const labels = container.querySelectorAll('input[type="text"]');
      labels[0].value = 'Sjanger';
      container.querySelector('input[data-col-index="0"][data-type="permanent"]').checked = true;
      document.getElementById('saveSettingsBtn').click();
      return {
        rows: labels.length,
        panel: document.getElementById('settingsPanel').style.display
      };
    })()`);
    assert.deepEqual(result, { rows: 6, panel: 'none' });
  });

  await check('Excel import skips a recognized header and keeps metadata', async () => {
    await evaluate(`window.XLSX = {
      read() { return { SheetNames: ['First', 'Ignored'], Sheets: { First: {}, Ignored: {} } }; },
      utils: { sheet_to_json() { return [
        ['Title', 'Genre', 'Year'],
        ['The Matrix', 'Science fiction', '1999'],
        ['Alien', 'Horror', '1979']
      ]; } }
    }; true`);
    await importFile('movies.xlsx', 'fake workbook');
    await poll(
      () => evaluate("Array.from(document.querySelectorAll('.item')).some((item) => item._item.text === 'The Matrix')"),
      'Excel import did not add The Matrix'
    );
    const result = await evaluate(`(() => ({
      titles: Array.from(document.querySelectorAll('.item')).map((item) => item._item.text),
      matrixTitle: Array.from(document.querySelectorAll('.item')).find((item) => item._item.text === 'The Matrix')?.title,
      matrixPermanent: Array.from(document.querySelectorAll('.item')).find((item) => item._item.text === 'The Matrix')?.innerText
    }))()`);
    assert.equal(result.titles.includes('Title'), false);
    assert.equal(result.titles.includes('The Matrix'), true);
    assert.equal(result.titles.includes('Alien'), true);
    assert.match(result.matrixTitle, /Sjanger - Science fiction/);
    assert.match(result.matrixPermanent, /Sjanger - Science fiction/);
  });

  await check('Duplicate Excel rows are rejected and reported', async () => {
    await importFile('movies.xlsx', 'fake workbook');
    const result = await evaluate(`(() => ({
      matrixCount: Array.from(document.querySelectorAll('.item')).filter((item) => item._item.text === 'The Matrix').length,
      message: document.getElementById('duplicateMsg').textContent
    }))()`);
    assert.equal(result.matrixCount, 1);
    assert.match(result.message, /duplicates not added/i);
    assert.match(result.message, /the matrix/i);
  });

  await check('CSV import treats a recognized first row as a header', async () => {
    await importFile('more-movies.csv', 'Title,Genre,Year\nArrival,Science fiction,2016');
    await poll(
      () => evaluate("Array.from(document.querySelectorAll('.item')).some((item) => item._item.text === 'Arrival')"),
      'CSV import did not add Arrival'
    );
    const titles = await evaluate("Array.from(document.querySelectorAll('.item')).map((item) => item._item.text)");
    assert.equal(titles.includes('Title'), false);
    assert.equal(titles.includes('Arrival'), true);
  });

  console.log(`\n${checks.length} browser checks passed.`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browserProcess.kill();
  server.close();
  await Promise.race([
    new Promise((resolve) => browserProcess.once('exit', resolve)),
    delay(2000)
  ]);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {});
}

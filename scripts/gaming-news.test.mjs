import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, clusterItems } from './gaming-news.mjs';

const source = { id: 'test', name: 'Test Feed', weight: 5 };

test('parseFeed reads RSS and cleans HTML', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[Big &amp; Useful News]]></title>
    <link>https://example.com/story?utm_source=x</link>
    <description><![CDATA[<p>A <strong>short</strong> summary.</p>]]></description>
    <pubDate>Sun, 02 Aug 2026 08:00:00 GMT</pubDate>
  </item></channel></rss>`;
  const items = parseFeed(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Big & Useful News');
  assert.equal(items[0].description, 'A short summary.');
  assert.equal(items[0].url, 'https://example.com/story');
});

test('parseFeed reads Atom links', () => {
  const xml = `<feed><entry><title>Atom story</title><link rel="alternate" href="https://example.com/atom"/><summary>Text</summary><updated>2026-08-02T08:00:00Z</updated></entry></feed>`;
  const items = parseFeed(xml, source);
  assert.equal(items[0].url, 'https://example.com/atom');
});

test('clusterItems groups close duplicate headlines', () => {
  const now = new Date('2026-08-02T10:00:00Z');
  const items = [
    { id:'a', sourceId:'one', sourceName:'One', sourceWeight:5, title:'Studio confirms major space RPG delay', url:'https://a.test/1', publishedAt:'2026-08-02T09:00:00Z' },
    { id:'b', sourceId:'two', sourceName:'Two', sourceWeight:5, title:'Major space RPG delay confirmed by studio', url:'https://b.test/2', publishedAt:'2026-08-02T09:10:00Z' },
    { id:'c', sourceId:'three', sourceName:'Three', sourceWeight:5, title:'Indie puzzle game launches today', url:'https://c.test/3', publishedAt:'2026-08-02T09:20:00Z' }
  ];
  const clusters = clusterItems(items, now);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].corroboration, 2);
});

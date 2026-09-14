import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORMS, PLATFORM_IDS, xWeightedLength, graphemeLength, codepointLength, mastodonLength, countFor, takeGraphemes } from '../prototype/src/limits.js';
import { composeFor, composeAll, epLabel, formatTags } from '../prototype/src/compose.js';
import { PHRASES, pickLeastRecent, nextPhrases } from '../prototype/src/rotation.js';
import { guardStatus, findDuplicate, recordSent } from '../prototype/src/guard.js';
import { intentUrl, normalizeHost } from '../prototype/src/intents.js';
import { parseNcode, isR18Url, buildNarouUrl, normalizeNarouResponse } from '../prototype/src/narou.js';

const work = {
  id: 'w1',
  title: '辺境の薬師は夜明けを待つ',
  url: 'https://ncode.syosetu.com/n1234ab/',
  writer: '月島 灯',
  site: 'narou',
  tags: { x: ['narou', '創作'], bluesky: ['創作', 'Web小説'], threads: ['小説家になろう', '創作'], misskey: ['創作'], mastodon: [] },
};
const ep = { no: 12, title: '夜明け前の市場', url: 'https://ncode.syosetu.com/n1234ab/12/', hook: '今回は主人公が初めて街を出ます。' };
const phrases = { opening: '更新しました。', closing: '続きはこちらから。', closingReply: '続きはリプ欄から。' };

test('X の加重カウント：全角 2、半角 1、URL 23', () => {
  assert.equal(xWeightedLength('abc'), 3);
  assert.equal(xWeightedLength('あいう'), 6);
  assert.equal(xWeightedLength('https://example.com/very/long/path?x=1'), 23);
  assert.equal(xWeightedLength('a\nあ'), 4);
  assert.equal(xWeightedLength('😀'), 2);
});

test('書記素・コードポイント・Mastodon カウント', () => {
  assert.equal(graphemeLength('👨‍👩‍👧'), 1);
  assert.equal(codepointLength('👨‍👩‍👧'), 5);
  assert.equal(graphemeLength('あいう'), 3);
  assert.equal(mastodonLength('見て https://example.com/abcdefghijklmnopqrstuvwxyz'), 3 + 23);
  assert.equal(countFor('bluesky', 'あ'), 1);
  assert.equal(countFor('threads', 'あ'), 1);
  assert.throws(() => countFor('nope', 'x'));
  assert.equal(takeGraphemes('あいうえお', 2), 'あい');
});

test('epLabel と formatTags', () => {
  assert.equal(epLabel({ no: 3 }), '第3話');
  assert.equal(epLabel({ no: 3, noTo: 5 }), '第3〜5話');
  assert.equal(epLabel({}), '');
  assert.deepEqual(formatTags(['narou', '#創作', ' ', 'x'], 2), ['#narou', '#創作']);
});

test('X は本文に URL を置かず、リプ用テキストに URL を置く', () => {
  const r = composeFor('x', { kind: 'update', work, ep }, phrases);
  assert.ok(r.ok, `over limit: ${r.count}`);
  assert.ok(!r.body.includes('http'), 'body must not contain URL');
  assert.ok(r.reply.includes(ep.url));
  assert.ok(r.body.includes('続きはリプ欄から。'));
  assert.ok(r.body.includes('#narou'));
  assert.ok(r.body.includes('『辺境の薬師は夜明けを待つ』第12話「夜明け前の市場」'));
});

test('Bluesky / Threads / Misskey / Mastodon は本文末尾に URL', () => {
  for (const id of ['bluesky', 'threads', 'misskey', 'mastodon']) {
    const r = composeFor(id, { kind: 'update', work, ep }, phrases);
    assert.ok(r.ok, `${id} over limit`);
    assert.ok(r.body.trim().endsWith(ep.url), `${id} should end with URL`);
    assert.equal(r.reply, '');
  }
});

test('Threads はタグ 1 個まで', () => {
  const r = composeFor('threads', { kind: 'update', work, ep }, phrases);
  assert.ok(r.body.includes('#小説家になろう'));
  assert.ok(!r.body.includes('#創作'));
});

test('新作・完結の文面', () => {
  const n = composeFor('bluesky', { kind: 'new', work, ep: {} }, phrases);
  assert.ok(n.body.startsWith('新作『辺境の薬師は夜明けを待つ』を公開しました。'));
  const c = composeFor('bluesky', { kind: 'complete', work, ep: { no: 40 } }, phrases);
  assert.ok(c.body.includes('が完結しました。全40話。'));
});

test('上限超過時は段階的に短縮し、必ず上限内に収める', () => {
  const longHook = 'あ'.repeat(400);
  const r = composeFor('x', { kind: 'update', work, ep: { ...ep, hook: longHook } }, phrases);
  assert.ok(r.ok, `count ${r.count} > ${r.limit}`);
  assert.ok(r.applied.includes('trim-hook') || r.applied.includes('drop-hook'));
  const b = composeFor('bluesky', { kind: 'update', work, ep: { ...ep, hook: longHook } }, phrases);
  assert.ok(b.ok);
  assert.ok(b.body.endsWith(ep.url), 'URL は削らない');
  // 極端な場合：長い題名でも落ちずに返す
  const huge = { ...work, title: 'タ'.repeat(200) };
  const h = composeFor('x', { kind: 'update', work: huge, ep }, phrases);
  assert.ok(h.applied.includes('drop-ep-title'));
  assert.ok(h.body.includes('『' + 'タ'.repeat(200) + '』'));
});

test('composeAll は全プラットフォーム分を返す', () => {
  const all = composeAll({ kind: 'update', work, ep }, phrases);
  assert.deepEqual(Object.keys(all).sort(), [...PLATFORM_IDS].sort());
  for (const id of PLATFORM_IDS) assert.equal(all[id].limit, PLATFORMS[id].limit);
});

test('ローテーションは未使用→最も古いものを選ぶ', () => {
  const pool = ['a', 'b', 'c'];
  assert.equal(pickLeastRecent(pool, [], () => 0), 0);
  assert.equal(pickLeastRecent(pool, [0], () => 0), 1);
  assert.equal(pickLeastRecent(pool, [0, 1], () => 0), 2);
  assert.equal(pickLeastRecent(pool, [0, 1, 2], () => 0), 0);
  assert.equal(pickLeastRecent(pool, [2, 0, 1], () => 0), 2);
  assert.equal(pickLeastRecent([], []), -1);
});

test('nextPhrases は連続で同じ冒頭句を返さない', () => {
  let state = {};
  const seen = [];
  for (let i = 0; i < PHRASES.opening.length; i += 1) {
    const r = nextPhrases(state, { rand: () => 0.5 });
    state = r.state;
    seen.push(r.phrases.opening);
  }
  assert.equal(new Set(seen).size, PHRASES.opening.length);
});

test('ガード：時間窓と重複文面', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  let h = [];
  assert.equal(guardStatus(h, { workId: 'w1', platform: 'x', now, windowHours: 12 }).allowed, true);
  h = recordSent(h, { workId: 'w1', platform: 'x', text: 'こんにちは https://a.example/1' }, { now: now - 3 * 36e5 });
  const g = guardStatus(h, { workId: 'w1', platform: 'x', now, windowHours: 12 });
  assert.equal(g.allowed, false);
  assert.ok(Math.abs(g.hoursAgo - 3) < 1e-9);
  assert.equal(guardStatus(h, { workId: 'w1', platform: 'bluesky', now, windowHours: 24 }).allowed, true);
  assert.equal(guardStatus(h, { workId: 'w2', platform: 'x', now, windowHours: 12 }).allowed, true);
  assert.ok(findDuplicate(h, { platform: 'x', text: 'こんにちは　https://b.example/2', now }));
  assert.equal(findDuplicate(h, { platform: 'x', text: 'さようなら', now }), null);
  assert.equal(findDuplicate(h, { platform: 'x', text: 'こんにちは', now: now + 8 * 864e5 }), null);
});

test('recordSent は上限で古いものから捨てる', () => {
  let h = [];
  for (let i = 0; i < 12; i += 1) h = recordSent(h, { workId: 'w', platform: 'x', text: String(i) }, { now: i, max: 10 });
  assert.equal(h.length, 10);
  assert.equal(h[0].text, '2');
});

test('インテント URL', () => {
  const t = 'こんにちは #創作\nhttps://a.example/?a=1&b=2';
  assert.equal(intentUrl('x', t), `https://x.com/intent/post?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('bluesky', t), `https://bsky.app/intent/compose?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('threads', t), `https://www.threads.net/intent/post?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('misskey', t), `https://misskey.io/share?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('misskey', t, { host: 'https://misskey.design/' }), `https://misskey.design/share?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('mastodon', t, { host: 'mstdn.jp' }), `https://mstdn.jp/share?text=${encodeURIComponent(t)}`);
  assert.equal(intentUrl('mastodon', t, { host: 'bad host!' }), null);
  assert.equal(normalizeHost('  Misskey.io/ '), 'Misskey.io');
  assert.ok(!intentUrl('x', t).includes('#'), 'ハッシュはエンコードされる');
});

test('なろうアダプタ：ncode の解釈と URL 組み立て、応答の正規化', () => {
  assert.equal(parseNcode('N1234AB'), 'n1234ab');
  assert.equal(parseNcode('https://ncode.syosetu.com/n9876zz/'), 'n9876zz');
  assert.equal(parseNcode('https://ncode.syosetu.com/n9876zz/12/'), 'n9876zz');
  assert.equal(parseNcode('https://novel18.syosetu.com/n1111a/'), 'n1111a');
  assert.equal(parseNcode('hello'), null);
  assert.equal(isR18Url('https://novel18.syosetu.com/n1111a/'), true);
  const u = new URL(buildNarouUrl('n1234ab', { callback: 'cb1' }));
  assert.equal(u.origin + u.pathname, 'https://api.syosetu.com/novelapi/api/');
  assert.equal(u.searchParams.get('out'), 'jsonp');
  assert.equal(u.searchParams.get('ncode'), 'n1234ab');
  assert.equal(u.searchParams.get('callback'), 'cb1');
  assert.ok(buildNarouUrl('n1', { r18: true }).startsWith('https://api.syosetu.com/novel18api/api/'));
  const info = normalizeNarouResponse([{ allcount: 1 }, { title: 'T', story: 'S', writer: 'W', general_all_no: 12, general_lastup: '2026-09-01 20:00:00', end: 1, noveltype: 1 }]);
  assert.deepEqual({ title: info.title, epCount: info.epCount, end: info.end }, { title: 'T', epCount: 12, end: false });
  assert.equal(normalizeNarouResponse([{ allcount: 0 }]), null);
  assert.equal(normalizeNarouResponse([{ allcount: 1 }, {}]).title, '');
});

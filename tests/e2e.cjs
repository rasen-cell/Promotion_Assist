// Playwright によるブラウザ通しテスト。グローバル or ローカルの playwright を解決する。
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { createServer } = require('./serve.cjs');

function loadPlaywright() {
  try { return require('playwright'); } catch { /* fall through */ }
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

const OUT_DIR = process.env.E2E_OUT || path.join(__dirname, '..', '.e2e-out');

async function main() {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'ja-JP' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const failures = [];
  const check = (cond, msg) => { if (!cond) failures.push(msg); };

  await page.goto(base);
  await page.waitForSelector('#generate');

  // 1. 作品と更新を入力して生成
  await page.selectOption('#site', 'narou');
  await page.fill('#title', '辺境の薬師は夜明けを待つ');
  await page.fill('#workUrl', 'https://ncode.syosetu.com/n1234ab/');
  await page.fill('#writer', '月島 灯');
  await page.click('details summary'); // タグ
  await page.fill('#tagsX', 'narou, 創作');
  await page.fill('#tagsBluesky', '創作, Web小説');
  await page.fill('#tagsThreads', '小説家になろう');
  await page.fill('#epNo', '12');
  await page.fill('#epTitle', '夜明け前の市場');
  await page.fill('#epUrl', 'https://ncode.syosetu.com/n1234ab/12/');
  await page.fill('#hook', '今回は主人公が初めて街を出ます。');
  await page.fill('#excerpt', '夜明け前の市場は、まだ灯りがまばらだった。\n薬師のリラは籠を抱え直し、露に濡れた石畳を踏みしめる。今日こそ、あの人に会えるだろうか。');
  await page.click('#generate');
  await page.waitForSelector('.post-card[data-platform="x"]');

  // 2. 各 SNS の文面と上限
  const cards = await page.$$eval('.post-card', (els) => els.map((el) => ({
    platform: el.dataset.platform,
    body: el.querySelector('[data-role="body"]').value,
    reply: el.querySelector('[data-role="reply"]')?.value || '',
    count: el.querySelector('[data-role="count"]').textContent,
    over: el.querySelector('[data-role="count"]').classList.contains('over'),
    openDisabled: el.querySelector('[data-role="open"]').disabled,
    notice: el.querySelector('[data-role="notice"]').textContent,
  })));
  check(cards.length === 5, `expected 5 cards, got ${cards.length}`);
  const byId = Object.fromEntries(cards.map((c) => [c.platform, c]));
  check(!byId.x.body.includes('http'), 'X body must not contain URL');
  check(byId.x.reply.includes('https://ncode.syosetu.com/n1234ab/12/'), 'X reply must contain URL');
  check(byId.bluesky.body.trim().endsWith('https://ncode.syosetu.com/n1234ab/12/'), 'Bluesky body ends with URL');
  check(byId.threads.body.includes('#小説家になろう'), 'Threads has tag');
  for (const c of cards) check(!c.over && !c.openDisabled, `${c.platform} within limit (${c.count})`);
  check(cards.filter((c) => c.platform !== 'mastodon').every((c) => c.notice.includes('投稿できます')), 'guard notices are OK initially');
  check(byId.mastodon.notice.includes('投稿先サーバーが未設定'), 'mastodon warns when host is unset');

  // 3. インテント URL（window.open をフック）
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.click('.post-card[data-platform="bluesky"] [data-role="open"]');
  await page.click('.post-card[data-platform="x"] [data-role="open"]');
  await page.click('.post-card[data-platform="threads"] [data-role="open"]');
  await page.click('.post-card[data-platform="misskey"] [data-role="open"]');
  const opened = await page.evaluate(() => window.__opened);
  check(opened[0]?.startsWith('https://bsky.app/intent/compose?text='), `bluesky intent: ${opened[0]}`);
  check(opened[1]?.startsWith('https://x.com/intent/post?text='), `x intent: ${opened[1]}`);
  check(opened[2]?.startsWith('https://www.threads.net/intent/post?text='), `threads intent: ${opened[2]}`);
  check(opened[3]?.startsWith('https://misskey.io/share?text='), `misskey intent: ${opened[3]}`);
  check(decodeURIComponent(opened[0].split('text=')[1]) === byId.bluesky.body, 'bluesky intent text equals body');

  // 4. 「投稿した」→ ガード警告と履歴
  await page.click('.post-card[data-platform="x"] [data-role="sent"]');
  await page.waitForFunction(() => document.querySelector('.post-card[data-platform="x"] [data-role="notice"]').textContent.includes('告知済み'));
  const histCount = await page.$$eval('#history li', (els) => els.length);
  check(histCount === 1, `history has 1 entry, got ${histCount}`);

  // 5. 画像：キャンバスが描画されていること（背景以外のピクセルがある）
  const cardInfo = await page.evaluate(() => {
    const c = document.getElementById('card');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const bg = [d[0], d[1], d[2]];
    let diff = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) diff += 1;
    }
    return { w: c.width, h: c.height, diff, dataUrlLen: c.toDataURL('image/png').length };
  });
  check(cardInfo.w === 1200 && cardInfo.h === 630, `card size ${cardInfo.w}x${cardInfo.h}`);
  check(cardInfo.diff > 200, `card has drawn content (diff samples=${cardInfo.diff})`);
  const png1 = await page.$eval('#card', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT_DIR, 'card-1200x630.png'), Buffer.from(png1.split(',')[1], 'base64'));
  await page.selectOption('#size', 'portrait');
  const png2 = await page.$eval('#card', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT_DIR, 'card-1080x1350.png'), Buffer.from(png2.split(',')[1], 'base64'));
  await page.selectOption('#size', 'card');
  await page.selectOption('#tpl', 'banner');
  await page.selectOption('#theme', 'night');
  const png3 = await page.$eval('#card', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT_DIR, 'banner-night.png'), Buffer.from(png3.split(',')[1], 'base64'));

  // 6. 永続化：リロード後も作品と履歴が残る
  await page.reload();
  await page.waitForSelector('#workSelect');
  const savedTitles = await page.$$eval('#workSelect option', (els) => els.map((e) => e.textContent));
  check(savedTitles.includes('辺境の薬師は夜明けを待つ'), 'work persisted');
  const histAfter = await page.$$eval('#history li', (els) => els.length);
  check(histAfter === 1, 'history persisted');

  // 7. 2 回目の生成で冒頭句が変わる（ローテーション）
  await page.selectOption('#workSelect', { label: '辺境の薬師は夜明けを待つ' });
  await page.fill('#epNo', '13');
  await page.click('#generate');
  const status1 = await page.textContent('#genStatus');
  await page.click('#generate');
  const status2 = await page.textContent('#genStatus');
  check(status1 !== status2, `rotation changed opening phrase (${status1} / ${status2})`);

  await page.screenshot({ path: path.join(OUT_DIR, 'screen.png'), fullPage: true });
  await browser.close();
  server.close();

  if (errors.length) failures.push(`console/page errors: ${errors.join(' | ')}`);
  if (failures.length) {
    console.error('E2E FAILED');
    for (const f of failures) console.error(' - ' + f);
    process.exit(1);
  }
  console.log(`E2E OK (${cards.length} platforms). Artifacts in ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

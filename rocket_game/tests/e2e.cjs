// Playwright によるブラウザ通しテスト: ミッション 1 を参考解で打ち上げ、達成まで確認する。
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
  const { SOLUTIONS } = await import('./solutions.mjs');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const failures = [];
  const check = (cond, msg) => { if (!cond) failures.push(msg); };

  for (const [scheme, vw] of [['light', 1360], ['dark', 390]]) {
    const context = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: 'ja-JP', colorScheme: scheme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
    await page.goto(base);
    await page.waitForSelector('.mission-card');
    check((await page.$$('.mission-card')).length === 7, 'ミッションが 7 件');
    check(await page.$eval('.mission-card[data-mission="m2"]', (el) => el.disabled), 'ミッション 2 は最初ロック');
    await page.screenshot({ path: path.join(OUT_DIR, `missions-${scheme}.png`), fullPage: true });

    // 初期設計で開く → 制約チェックが出る
    await page.click('.mission-card[data-mission="m1"]');
    await page.waitForSelector('#designForm select');
    check(await page.isVisible('#analysis .checks'), '制約チェックが表示される');
    // タンク長を変えると見積もりが変わる
    const before = await page.textContent('#analysis');
    await page.fill('[data-path="stages.0.tankLength"]', '2');
    await page.dispatchEvent('[data-path="stages.0.tankLength"]', 'change');
    check(before !== (await page.textContent('#analysis')), '入力で見積もりが更新される');
    await page.screenshot({ path: path.join(OUT_DIR, `design-${scheme}.png`), fullPage: true });

    // 参考解を保存データとして入れて開き直す
    await page.evaluate((sol) => {
      localStorage.setItem('rocket-bureau-v1', JSON.stringify({ stars: {}, work: { m1: sol }, last: 'm1' }));
    }, SOLUTIONS.m1);
    await page.reload();
    await page.click('.mission-card[data-mission="m1"]');
    await page.click('#tabPlan');
    await page.waitForSelector('#btnLaunch');
    check(!(await page.$eval('#btnLaunch', (b) => b.disabled)), '参考解なら打ち上げボタンが押せる');
    await page.screenshot({ path: path.join(OUT_DIR, `plan-${scheme}.png`), fullPage: true });
    await page.click('#btnLaunch');
    await page.waitForSelector('#flightBody:not([hidden])');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, `flight-run-${scheme}.png`), fullPage: true });
    await page.click('#btnSkip');
    await page.waitForSelector('.verdict.ok, .verdict.ng');
    check(await page.$('.verdict.ok'), 'ミッション 1 が達成になる');
    await page.screenshot({ path: path.join(OUT_DIR, `flight-done-${scheme}.png`), fullPage: true });
    await page.click('#home');
    check(!(await page.$eval('.mission-card[data-mission="m2"]', (el) => el.disabled)), '達成後はミッション 2 が開く');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `横スクロールしない (${scheme}, ${overflow}px)`);
    check(errors.length === 0, `コンソールエラーなし (${scheme}): ${errors.join(' | ')}`);
    await context.close();
  }
  await browser.close();
  server.close();
  if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('e2e ok');
}

main().catch((e) => { console.error(e); process.exit(1); });

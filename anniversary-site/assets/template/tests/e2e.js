// 用真实浏览器把每一页从头点到尾，并在桌面 / 手机竖屏 / 手机横屏下截图到 tests/shots。
//
// 运行：node tests/e2e.js
// 需要 playwright-core（只是一个驱动库，用本机已有的 Edge 或 Chrome，不会下载浏览器）：
//   在任意文件夹里 npm i playwright-core，然后设置环境变量
//   PLAYWRIGHT_PATH=<那个文件夹>/node_modules/playwright-core
// 浏览器找不到时，用 BROWSER_PATH=<msedge.exe 或 chrome 的完整路径> 指定。
const path = require('path');
const fs = require('fs');
const assert = require('node:assert');

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright-core', 'playwright'].filter(Boolean);
  for (const name of candidates) {
    try { return require(name); } catch (err) { if (err.code !== 'MODULE_NOT_FOUND') throw err; }
  }
  console.error('找不到 playwright-core。请先 npm i playwright-core，并设置 PLAYWRIGHT_PATH（见本文件开头）。');
  process.exit(2);
}

async function launchBrowser(chromium) {
  const tries = process.env.BROWSER_PATH ? [{ executablePath: process.env.BROWSER_PATH }] : [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
  let lastError;
  for (const options of tries) {
    try { return await chromium.launch(options); } catch (err) { lastError = err; }
  }
  throw lastError;
}

const SITE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const SHOTS = path.resolve(__dirname, 'shots');
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const LANDSCAPE = { width: 844, height: 390 };

const visiblePageIds = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.page:not([hidden])')).map((p) => p.id));

async function runFlow(browser, name, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: name === 'mobile' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // 音频在跳转播放位置时，浏览器会中止旧请求再按范围重新请求，这不算出错；
  // 音乐是否真的在播，由下面“播放进度在往前走”的断言来保证。
  page.on('requestfailed', (r) => {
    const reason = r.failure() ? r.failure().errorText : '';
    if (/\.(mp3|m4a|ogg|wav|flac)$/i.test(r.url()) && reason === 'net::ERR_ABORTED') return;
    errors.push('requestfailed: ' + r.url() + ' ' + reason);
  });
  const shot = (label) => page.screenshot({ path: path.join(SHOTS, `${name}-${label}.png`) });
  const active = () => page.evaluate(() => document.querySelector('.page.is-active').id);

  await page.goto(SITE);
  await page.evaluate(() => document.fonts.ready);
  const config = await page.evaluate(() => window.ANNIV_CONFIG);
  const ids = await visiblePageIds(page);
  const hasMusic = !!(config.music && config.music.first);

  const steps = {
    'p-film': async () => {
      const count = await page.evaluate(() => window.Anniv.photos.length);
      assert.ok(count > 0, '至少要有一张照片');
      assert.strictEqual(await page.locator('.frame').count(), count);
      await shot('film');
      await page.locator('#stripA .frame').first().click();
      assert.strictEqual(await page.isVisible('#lightbox'), true);
      await page.waitForFunction(() => document.getElementById('lbImg').naturalWidth > 0);
      await page.waitForTimeout(500);
      await shot('film-lightbox');
      await page.keyboard.press('Escape');
      assert.strictEqual(await page.isVisible('#lightbox'), false);
    },

    // 大富翁：一直掷到走完一圈，每件事要按顺序都出现
    'p-board': async () => {
      await shot('board-start');
      const journey = config.journey.map((j) => j.title);
      const seenTitles = [];
      for (let guard = 0; guard < 60; guard++) {
        await page.waitForFunction(() => !document.getElementById('eventCard').hidden || !document.getElementById('rollBtn').disabled, null, { timeout: 10000 });
        if (await page.isVisible('#eventCard')) {
          const title = await page.textContent('#eventTitle');
          if (await page.evaluate(() => window.__annivBoard.state().finished)) { await page.waitForTimeout(700); await shot('board-finished'); await page.click('#eventOk'); break; }
          seenTitles.push(title);
          if (seenTitles.length === 1 || seenTitles.length === journey.length) { await page.waitForTimeout(900); await shot('board-event-' + seenTitles.length); }
          await page.click('#eventOk');
        } else {
          await page.click('#rollBtn');
        }
      }
      assert.deepStrictEqual(seenTitles, journey, '每件事按顺序都出现了');
      const rewardTiles = (config.rewards || []).length ? 7 : 0;
      assert.strictEqual(await page.locator('#bag li').count(), rewardTiles, '一圈捡到的奖励数');
      assert.strictEqual(await page.locator('.house').count(), config.journey.filter((j) => j.house).length, '小房子盖起来了');
      await shot('board-done');
    },

    'p-table': async () => {
      await shot('table');
      const menu = config.dishes.map((d) => d.love);
      const firstLove = menu.indexOf(true);
      if (firstLove >= 0) {
        await page.locator('.dish').nth(firstLove).click();
        assert.strictEqual(await page.locator('.dish.is-removed').count(), 0, '最爱的菜点了也拿不走');
      }
      for (let i = 0; i < menu.length; i++) if (!menu[i]) await page.locator('.dish').nth(i).click();
      assert.strictEqual(await page.locator('.dish.is-removed').count(), menu.filter((l) => !l).length);
      assert.strictEqual(await page.locator('#table.is-done').count(), 1);
      await page.waitForTimeout(1300);
      await shot('table-done');
    },

    'p-hands': async () => {
      assert.strictEqual(await page.textContent('#ticketCount'), '1');
      if (config.anniversaryDate) {
        assert.ok((await page.innerHTML('#hand1')).includes(config.anniversaryDate.replace(/-/g, '.')), '门票上印的是纪念日');
      }
      await shot('hands-solo');
      await page.click('#hands');
      assert.strictEqual(await page.textContent('#ticketCount'), '2');
      await page.waitForTimeout(1800);
      await shot('hands-duo');
    },

    // 小游戏：先真按键玩一小段，再让机器人打通
    'p-game': async () => {
      await shot('game-start');
      await page.click('#gameStart');
      const x0 = await page.evaluate(() => window.__annivGame.state().p1.x);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(700);
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      await page.keyboard.up('ArrowRight');
      const x1 = await page.evaluate(() => window.__annivGame.state().p1.x);
      assert.ok(x1 > x0 + 40, `方向键能让 1P 往右走（${x0} -> ${x1}）`);
      assert.strictEqual(await active(), 'p-game', '游戏里按方向键不会翻页');
      await shot('game-solo');
      assert.strictEqual(await page.evaluate(() => window.__annivGame.bot('joining')), 'joining');
      await page.waitForTimeout(400);
      assert.strictEqual(await page.locator('#hudP2.is-on').count(), 1, '2P 加入时 HUD 亮起');
      await shot('game-join');
      await page.waitForFunction(() => window.__annivGame.state().phase === 'duo', null, { timeout: 8000 });
      await page.waitForTimeout(300);
      await shot('game-duo');
      await page.keyboard.down('ArrowRight'); // 按着方向键通关，通关画面出来后才松手
      assert.strictEqual(await page.evaluate(() => window.__annivGame.bot()), 'won');
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      assert.strictEqual(await page.isVisible('#gameOverlay'), true, '刚通关时按跳不会把通关画面跳过去');
      await shot('game-won');
      await page.keyboard.up('ArrowRight');
      await page.click('#gameStart');
      await page.waitForTimeout(500);
      assert.strictEqual(await page.evaluate(() => window.__annivGame.state().p1.x), 32, '重开后不会自己往右跑');
      assert.strictEqual(await page.evaluate(() => window.__annivGame.bot()), 'won');
      await page.waitForTimeout(200);
    },

    // 唱片机：第一首 -> 第二首
    'p-vinyl': async () => {
      const before = await page.evaluate(() => window.Anniv.music.state());
      assert.strictEqual(before.track, 'first');
      assert.ok(before.started && before.playing && before.time > 1 && before.volume > 0.5, '第一首歌一直在播：' + JSON.stringify(before));
      await shot('vinyl-before');
      await page.click('#deck');
      assert.strictEqual(await page.evaluate(() => window.Anniv.music.state().track), 'second');
      await page.waitForTimeout(2600);
      await shot('vinyl-after');
      const after = await page.evaluate(() => window.Anniv.music.state());
      assert.ok(after.playing && after.time > 1 && after.volume > 0.5, '第二首歌真的在播：' + JSON.stringify(after));
      assert.strictEqual(await page.locator('#p-vinyl.is-swapped').count(), 1);
    },

    'p-finale': async () => {
      await page.waitForTimeout(900);
      await shot('finale-flying');
      await page.waitForSelector('.finale-photo.is-real', { timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll('.letter .is-shown').length === document.querySelectorAll('#letterBody p').length + 1, null, { timeout: 30000 });
      await page.waitForTimeout(2200);
      await shot('finale-photo');
    },
  };

  // 封面
  assert.strictEqual(await active(), 'p-cover');
  const expectedDays = await page.evaluate(() => {
    const c = window.ANNIV_CONFIG;
    const end = c.anniversaryDate ? window.AnnivLogic.parseDate(c.anniversaryDate) : new Date();
    return String(window.AnnivLogic.daysTogether(c.startDate, end));
  });
  assert.strictEqual(await page.textContent('#days'), expectedDays);
  assert.strictEqual(await page.textContent('#h-cover'), config.title);
  assert.ok(await page.locator('#gypLeft circle').count() > 40, '满天星画出来了');
  for (let i = 0; i < 3; i++) await page.click('#camera');
  assert.strictEqual(await page.locator('.shot').count(), 3);
  await page.waitForTimeout(1200);
  await shot('cover');
  if (hasMusic) {
    await page.waitForFunction(() => window.Anniv.music.state().time > 0.3, null, { timeout: 10000 });
  }

  for (const id of ids.slice(1)) {
    await page.click('#next');
    assert.strictEqual(await active(), id);
    await page.waitForTimeout(900);
    await steps[id]();
  }
  assert.strictEqual(await page.isDisabled('#next'), true, '最后一页不能再往后翻');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, '横向溢出 ' + overflow + 'px');
  assert.deepStrictEqual(errors, [], '页面不应有报错');
  await context.close();
  console.log(`✔ ${name} 全流程通过（${ids.length} 页）`);
}

// 手机横屏：每一页截图，并确认游戏按键没有被裁到屏幕外
async function runLandscape(browser) {
  const context = await browser.newContext({ viewport: LANDSCAPE, hasTouch: true });
  const page = await context.newPage();
  await page.goto(SITE);
  await page.evaluate(() => document.fonts.ready);
  const ids = await visiblePageIds(page);
  for (let i = 0; i < ids.length; i++) {
    if (i > 0) await page.click('#next');
    if (ids[i] === 'p-cover') { await page.click('#camera'); await page.click('#camera'); }
    if (ids[i] === 'p-hands') await page.click('#hands');
    await page.waitForTimeout(ids[i] === 'p-finale' ? 9000 : 1500);
    await page.screenshot({ path: path.join(SHOTS, 'landscape-' + ids[i].slice(2) + '.png') });
    if (ids[i] === 'p-game') {
      for (const id of ['#padLeft', '#padRight', '#padJump', '#gameCanvas']) {
        const box = await page.locator(id).boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= LANDSCAPE.height && box.x >= 0 && box.x + box.width <= LANDSCAPE.width, id + ' 在横屏下完整可见');
      }
    }
  }
  await context.close();
  console.log('✔ landscape 检查通过');
}

(async () => {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launchBrowser(chromium);
  let failed = false;
  for (const [name, viewport] of Object.entries(SIZES)) {
    try { await runFlow(browser, name, viewport); } catch (err) { failed = true; console.error(`✘ ${name}: ${err.message}`); }
  }
  try { await runLandscape(browser); } catch (err) { failed = true; console.error('✘ landscape: ' + err.message); }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();

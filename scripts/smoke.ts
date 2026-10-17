import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const screenshotDir = resolve('docs/screenshots');
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
const host = await context.newPage();

try {
  await host.goto(`${baseUrl}/setup`);
  await expect(host.getByRole('heading', { name: 'Familien-Quiz' })).toBeVisible();
  await host.getByLabel('Runden').fill('');
  await host.getByRole('button', { name: 'Spiel starten' }).click();
  expect(await host.getByLabel('Runden').evaluate((input) => Reflect.get(Reflect.get(input, 'validity'), 'valid'))).toBe(false);
  await host.getByLabel('Runden').fill('3');
  await host.getByLabel('Multiplikatoren').fill('1,foo,3');
  await host.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(host.getByRole('alert')).toContainText('Multiplikatoren müssen positive Zahlen sein');
  await host.getByLabel('Multiplikatoren').fill('1,1,3');
  await host.getByRole('checkbox', { name: 'Wiederholungen erlauben' }).check();
  await host.getByRole('button', { name: 'Spiel starten' }).click();
  await host.waitForURL('**/host');
  await expect(host.getByText('Runde 1/3')).toBeVisible();

  const stored = await host.evaluate(() => JSON.parse(localStorage.getItem('fq:active-game') ?? 'null') as { gameId: string; round: { slots: { label: string }[] } });
  if (!stored?.gameId) throw new Error('Spiel-ID fehlt nach dem Setup.');
  const hiddenLabel = stored.round.slots[0].label.toLocaleUpperCase('de-CH');
  const board = await context.newPage();
  await board.addInitScript(`(() => {
    const original = Storage.prototype.getItem;
    const reads = [];
    Object.defineProperty(window, '__fqStorageReads', { value: reads });
    Storage.prototype.getItem = function getItem(key) {
      reads.push(key);
      return original.call(this, key);
    };
  })()`);
  await board.goto(`${baseUrl}/board?intro=1`);
  await expect(board.locator('.board-stage')).toBeVisible();
  await expect.poll(() => board.evaluate(() => Reflect.get(globalThis, 'location').search)).toBe('');
  await expect(board.locator('body')).not.toContainText(hiddenLabel);
  const boardStorageReads = await board.evaluate<string[]>('window.__fqStorageReads');
  if (boardStorageReads.includes('fq:active-game')) throw new Error('Das Brett hat den autoritativen Spielstand aus dem Speicher geladen.');
  await board.getByRole('button', { name: 'Ton aktivieren' }).click();
  await host.getByRole('button', { name: 'Ton' }).click();
  await expect.poll(() => board.evaluate(() => localStorage.getItem('fq:muted'))).toBe('1');
  await host.getByRole('button', { name: 'Stumm' }).click();
  await expect.poll(() => board.evaluate(() => localStorage.getItem('fq:muted'))).toBe('0');
  await host.screenshot({ path: resolve(screenshotDir, 'host-1280x720.png') });

  for (let round = 1; round <= 3; round += 1) {
    await host.locator('.host-header h1').click();
    await host.keyboard.press('n');
    await expect(host.getByText('Duell', { exact: true })).toBeVisible();
    await host.keyboard.press(round === 1 ? 'b' : 'a');
    if (round === 1) {
      await expect(host.locator('.host-team.team-1')).toHaveClass(/active/);
      await host.screenshot({ path: resolve(screenshotDir, 'host-faceoff-1280x720.png') });
    }
    await host.getByRole('button', { name: 'Kontrolle A' }).click();
    await expect(host.getByText('Spiel', { exact: true })).toBeVisible();
    const slotCount = await host.locator('.mini-board li').count();
    if (round === 1) {
      await host.keyboard.press('1');
      await host.keyboard.press('x');
      await host.keyboard.press('x');
      await host.keyboard.press('x');
      await expect(host.getByText('Klauen', { exact: true })).toBeVisible();
      await host.keyboard.press('x');
      await expect(board.locator('.answer-row.end')).toHaveCount(slotCount - 1);
      const endDelays = await board.evaluate<string[]>(`Array.from(document.querySelectorAll('.answer-row.end'), (row) => getComputedStyle(row).animationDelay)`);
      if (new Set(endDelays).size < 2) throw new Error('Rundenende-Antworten werden nicht nacheinander eingeblendet.');
    } else {
      for (let rank = 1; rank <= slotCount; rank += 1) await host.keyboard.press(String(rank));
      await expect(board.locator('.board-stage')).toHaveClass(/mode-reveal/);
    }
    await expect(host.getByText('Rundenende', { exact: true })).toBeVisible();
    await expect(board.locator('.screen-status')).toContainText('GEWINNT');
    await host.keyboard.press('n');
    if (round < 3) await expect(host.getByText(`Runde ${round + 1}/3`)).toBeVisible();
  }

  await expect(host.getByText('Finale', { exact: true })).toBeVisible();
  await expect(board.locator('.game-over')).toBeVisible();
  const finishedGameId = stored.gameId;
  await host.getByRole('button', { name: 'Neues Spiel · gleiche Teams' }).click();
  await expect(host.getByText('Runde 1/3')).toBeVisible();
  await expect.poll(() => host.evaluate(() => JSON.parse(localStorage.getItem('fq:active-game') ?? '{}').gameId)).not.toBe(finishedGameId);
  await expect(board.locator('.round-bar')).toContainText('RUNDE 1');
  await expect(host.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();

  const replacement = await host.evaluate(() => JSON.parse(localStorage.getItem('fq:active-game') ?? 'null') as { round: { slots: { label: string }[] } });
  const replacementAnswer = replacement.round.slots[0].label;
  await host.locator('.host-header h1').click();
  await host.keyboard.press('n');
  await expect(board.locator('.board-stage')).toHaveAttribute('data-phase', 'faceOff');
  await host.keyboard.press('a');
  await host.getByRole('button', { name: 'Kontrolle A' }).click();
  await expect(board.locator('.board-stage')).toHaveAttribute('data-phase', 'playing');
  await host.keyboard.press('1');
  await expect(board.locator('.board-stage')).toHaveClass(/mode-reveal/);
  await host.keyboard.press('z');
  await expect(board.locator('.answer-row').first().locator('b')).toHaveText('--');
  await host.keyboard.press('1');
  await expect(board.locator('.board-stage')).toHaveClass(/mode-reveal/);
  await host.getByPlaceholder('Antwort tippen …').fill(replacementAnswer);
  await host.keyboard.press('Enter');
  await expect(board.locator('.screen-status')).toContainText('SCHON GENANNT');
  await host.keyboard.press('r');
  await expect(board.locator('.screen-status')).not.toContainText('SCHON GENANNT');

  const demo = await context.newPage();
  await demo.goto(`${baseUrl}/board?demo=1`);
  await demo.screenshot({ path: resolve(screenshotDir, 'board-title-1280x720.png') });
  for (let index = 0; index < 2; index += 1) await demo.keyboard.press('ArrowRight');
  await demo.screenshot({ path: resolve(screenshotDir, 'board-faceoff-1280x720.png') });
  for (let index = 0; index < 3; index += 1) await demo.keyboard.press('ArrowRight');
  await expect(demo.locator('.rows-8 .answer-row')).toHaveCount(8);
  await assertFits(demo, 'desktop');
  await demo.screenshot({ path: resolve(screenshotDir, 'board-strike-1280x720.png') });
  await demo.setViewportSize({ width: 1920, height: 1080 });
  await assertFits(demo, 'full-hd');
  await demo.screenshot({ path: resolve(screenshotDir, 'board-strike-1920x1080.png') });
  await demo.setViewportSize({ width: 390, height: 844 });
  await assertFits(demo, 'mobile');
  await demo.screenshot({ path: resolve(screenshotDir, 'board-strike-390x844.png') });
  await demo.setViewportSize({ width: 1280, height: 720 });
  for (let index = 0; index < 7; index += 1) await demo.keyboard.press('ArrowRight');
  await demo.screenshot({ path: resolve(screenshotDir, 'board-game-over-1280x720.png') });

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${baseUrl}/board?demo=1`);
  const animation = await reducedPage.evaluate<string>("getComputedStyle(document.querySelector('.bulbs i')).animationName");
  if (animation !== 'none') throw new Error(`Reduced-motion bulb animation is ${animation}, expected none.`);
  await reducedPage.screenshot({ path: resolve(screenshotDir, 'board-reduced-motion-1280x720.png') });
  await reduced.close();

  console.log(`Browser smoke passed: setup validation, initial intro handoff, audio activation/mute, team-B-first face-off, 3 keyboard rounds, final-answer reveal feedback, board sync, isolated board storage, hidden-answer safety, staggered round-end answers, persisted reset, reset/undo event replay, duplicate discard, 1920×1080, 1280×720, 390×844, reduced motion. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
}

async function assertFits(page: import('@playwright/test').Page, label: string) {
  const layout = await page.evaluate<{ viewport: { width: number; height: number }; scroll: { width: number; height: number }; marquee: { left: number; top: number; right: number; bottom: number } }>(`(() => {
    const marquee = document.querySelector('.marquee').getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      marquee: { left: marquee.left, top: marquee.top, right: marquee.right, bottom: marquee.bottom },
    };
  })()`);
  if (layout.scroll.width > layout.viewport.width || layout.scroll.height > layout.viewport.height) throw new Error(`${label}: Board scrolls outside the viewport.`);
  if (layout.marquee.left < 0 || layout.marquee.top < 0 || layout.marquee.right > layout.viewport.width || layout.marquee.bottom > layout.viewport.height) throw new Error(`${label}: Marquee is clipped.`);
}

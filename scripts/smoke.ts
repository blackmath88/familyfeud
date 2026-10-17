import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
const host = await context.newPage();

try {
  await host.goto(`${baseUrl}/setup`);
  await expect(host.getByRole('heading', { name: 'Familien-Quiz' })).toBeVisible();
  await host.getByRole('checkbox', { name: 'Wiederholungen erlauben' }).check();
  await host.getByRole('button', { name: 'Spiel starten' }).click();
  await host.waitForURL('**/host');
  await expect(host.getByText('Runde 1/3')).toBeVisible();

  const stored = await host.evaluate(() => JSON.parse(localStorage.getItem('fq:active-game') ?? 'null') as { gameId: string; round: { slots: { label: string }[] } });
  if (!stored?.gameId) throw new Error('Spiel-ID fehlt nach dem Setup.');
  const hiddenLabel = stored.round.slots[0].label.toLocaleUpperCase('de-CH');
  const board = await context.newPage();
  await board.goto(`${baseUrl}/board?game=${encodeURIComponent(stored.gameId)}`);
  await expect(board.locator('.board-stage')).toBeVisible();
  await expect(board.locator('body')).not.toContainText(hiddenLabel);

  for (let round = 1; round <= 3; round += 1) {
    await host.locator('.host-header h1').click();
    await host.keyboard.press('n');
    await expect(host.getByText('Duell', { exact: true })).toBeVisible();
    await host.keyboard.press('a');
    await expect(host.getByText('Spiel', { exact: true })).toBeVisible();
    const slotCount = await host.locator('.mini-board li').count();
    for (let rank = 1; rank <= slotCount; rank += 1) await host.keyboard.press(String(rank));
    await expect(host.getByText('Rundenende', { exact: true })).toBeVisible();
    await expect(board.locator('.screen-status')).toContainText('GEWINNT');
    await host.keyboard.press('n');
    if (round < 3) await expect(host.getByText(`Runde ${round + 1}/3`)).toBeVisible();
  }

  await expect(host.getByText('Finale', { exact: true })).toBeVisible();
  await expect(board.locator('.game-over')).toBeVisible();
  await host.getByRole('button', { name: 'Neues Spiel · gleiche Teams' }).click();
  await expect(host.getByText('Runde 1/3')).toBeVisible();

  const demo = await context.newPage();
  await demo.goto(`${baseUrl}/board?demo=1`);
  await demo.screenshot({ path: '/tmp/familien-quiz-title.png' });
  for (let index = 0; index < 2; index += 1) await demo.keyboard.press('ArrowRight');
  await demo.screenshot({ path: '/tmp/familien-quiz-faceoff.png' });
  for (let index = 0; index < 3; index += 1) await demo.keyboard.press('ArrowRight');
  await expect(demo.locator('.rows-8 .answer-row')).toHaveCount(8);
  await assertFits(demo, 'desktop');
  await demo.screenshot({ path: '/tmp/familien-quiz-1280x720.png' });
  await demo.setViewportSize({ width: 390, height: 844 });
  await assertFits(demo, 'mobile');
  await demo.screenshot({ path: '/tmp/familien-quiz-390x844.png' });
  await demo.setViewportSize({ width: 1280, height: 720 });
  for (let index = 0; index < 7; index += 1) await demo.keyboard.press('ArrowRight');
  await demo.screenshot({ path: '/tmp/familien-quiz-game-over.png' });

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${baseUrl}/board?demo=1`);
  const animation = await reducedPage.evaluate<string>("getComputedStyle(document.querySelector('.bulbs i')).animationName");
  if (animation !== 'none') throw new Error(`Reduced-motion bulb animation is ${animation}, expected none.`);
  await reducedPage.screenshot({ path: '/tmp/familien-quiz-reduced-motion.png' });
  await reduced.close();

  console.log('Browser smoke passed: setup, 3 keyboard rounds, board sync, hidden-answer safety, reset, 1280×720, 390×844, reduced motion.');
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

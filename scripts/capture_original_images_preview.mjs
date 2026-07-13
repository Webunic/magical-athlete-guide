import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const seededState = {
  schemaVersion: 3,
  playerCount: 4,
  doubleRacers: false,
  names: ['Игрок 1', 'Игрок 2', 'Игрок 3', 'Игрок 4'],
  raceNumber: 1,
  cards: {
    alchemist: {status: 'pool'},
    blimp: {status: 'player', owner: 0},
  },
  lastTransition: null,
};

async function prepare(page) {
  await page.addInitScript(state => {
    localStorage.setItem('magical-athlete-party-v3', JSON.stringify(state));
  }, seededState);
  page.on('pageerror', error => pageErrors.push(String(error)));
}

async function openReference(page) {
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.click('button[data-tab="reference"]');
  await page.waitForSelector('img.thumb[data-source="original-rulebook"]');
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')].slice(0, 2);
    return images.length === 2 && images.every(image => image.complete && image.naturalWidth >= 900 && image.naturalHeight === 500);
  });
}

async function validateOriginalTextInView(page, tab, cardSelector) {
  await page.click(`button[data-tab="${tab}"]`);
  await page.waitForSelector(cardSelector);
  await page.waitForFunction(selector => {
    const cards = [...document.querySelectorAll(selector)];
    return cards.length > 0 && cards.every(card => {
      const labels = [...card.querySelectorAll('.label')].map(label => label.textContent.trim());
      const original = card.querySelector('p.original');
      return labels.includes('Перевод') && labels.includes('Оригинал') && Boolean(original?.textContent.trim());
    });
  }, cardSelector);
  return page.$$eval(cardSelector, cards => cards.map(card => ({
    title: card.querySelector('h3')?.textContent?.trim(),
    labels: [...card.querySelectorAll('.label')].map(label => label.textContent.trim()),
    original: card.querySelector('p.original')?.textContent?.trim(),
  })));
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await prepare(mobile);
await openReference(mobile);
await mobile.screenshot({ path: 'preview-original-images-mobile.png', fullPage: false });

const imageReport = await mobile.evaluate(() => {
  const images = [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')].slice(0, 2);
  return {
    version: document.querySelector('.version')?.textContent,
    imageCount: images.length,
    uniqueSources: new Set(images.map(image => image.src)).size,
    dimensions: images.map(image => ({
      alt: image.alt,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      source: image.dataset.source,
    })),
  };
});

const poolCards = await validateOriginalTextInView(mobile, 'pool', '.card-pool');
const playerCards = await validateOriginalTextInView(mobile, 'players', '.card-player');
await mobile.screenshot({ path: 'preview-original-text-mobile.png', fullPage: false });

const report = {...imageReport, poolCards, playerCards};
await writeFile('preview-report.json', JSON.stringify(report, null, 2));

const desktop = await browser.newPage({ viewport: { width: 1660, height: 900 }, deviceScaleFactor: 1 });
await prepare(desktop);
await openReference(desktop);
await desktop.screenshot({ path: 'preview-original-images-desktop.png', fullPage: false });

if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if (report.imageCount !== 2 || report.uniqueSources !== 2) {
  throw new Error(`Expected two distinct control images, got ${JSON.stringify(report)}`);
}
if (!report.dimensions.every(image => image.naturalWidth >= 900 && image.naturalHeight === 500)) {
  throw new Error('A control image has unexpected dimensions.');
}
if (!report.poolCards.length || !report.playerCards.length) {
  throw new Error('Original text validation did not cover pool and player cards.');
}

console.log(JSON.stringify({
  version: report.version,
  controlImages: report.imageCount,
  poolOriginalTextCards: report.poolCards.length,
  playerOriginalTextCards: report.playerCards.length,
}, null, 2));
await browser.close();

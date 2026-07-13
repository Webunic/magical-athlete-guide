import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
await page.click('button[data-tab="reference"]');
await page.waitForSelector('img.thumb[data-source="original-rulebook"]');
await page.waitForFunction(() => {
  const images = [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')].slice(0, 2);
  return images.length === 2 && images.every(image => image.complete && image.naturalWidth >= 900);
});
await page.screenshot({ path: 'preview-original-images-mobile.png', fullPage: false });

const report = await page.evaluate(() => ({
  version: document.querySelector('.version')?.textContent,
  imageCount: document.querySelectorAll('img.thumb[data-source="original-rulebook"]').length,
  firstImages: [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')].slice(0, 3).map(image => ({
    alt: image.alt,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    source: image.dataset.source,
  })),
}));

if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
if (report.imageCount !== 36) throw new Error(`Expected 36 upgraded images, got ${report.imageCount}`);
if (!report.firstImages.every(image => image.naturalWidth >= 900 && image.naturalHeight === 500)) {
  throw new Error(`Unexpected image dimensions: ${JSON.stringify(report.firstImages)}`);
}

await writeFile('preview-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

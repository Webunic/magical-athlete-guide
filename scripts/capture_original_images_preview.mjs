import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const pageErrors = [];

async function openReference(page) {
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.click('button[data-tab="reference"]');
  await page.waitForSelector('img.thumb[data-source="original-rulebook"]');
  await page.evaluate(() => {
    document.querySelectorAll('img.thumb[data-source="original-rulebook"]').forEach(image => {
      image.loading = 'eager';
    });
  });
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')];
    return images.length === 36 && images.every(image => image.complete && image.naturalWidth >= 900 && image.naturalHeight === 500);
  });
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await openReference(mobile);
await mobile.screenshot({ path: 'preview-original-images-mobile.png', fullPage: false });

const report = await mobile.evaluate(() => {
  const images = [...document.querySelectorAll('img.thumb[data-source="original-rulebook"]')];
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
await writeFile('preview-report.json', JSON.stringify(report, null, 2));

const desktop = await browser.newPage({ viewport: { width: 1660, height: 900 }, deviceScaleFactor: 1 });
await openReference(desktop);
await desktop.screenshot({ path: 'preview-original-images-desktop.png', fullPage: false });

if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if (report.imageCount !== 36 || report.uniqueSources !== 36) {
  throw new Error(`Expected 36 distinct upgraded images, got ${JSON.stringify(report)}`);
}
if (!report.dimensions.every(image => image.naturalWidth >= 900 && image.naturalHeight === 500)) {
  throw new Error('At least one image has unexpected dimensions.');
}

console.log(JSON.stringify({
  version: report.version,
  imageCount: report.imageCount,
  uniqueSources: report.uniqueSources,
  minWidth: Math.min(...report.dimensions.map(image => image.naturalWidth)),
  maxWidth: Math.max(...report.dimensions.map(image => image.naturalWidth)),
  height: report.dimensions[0].naturalHeight,
}, null, 2));
await browser.close();

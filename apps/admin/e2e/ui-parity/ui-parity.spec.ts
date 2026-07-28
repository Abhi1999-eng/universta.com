import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const outputRoot = path.resolve(process.cwd(), 'test-results/ui-parity');
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const routes = [
  { name: 'countries-listing', reference: 'final-countries-list.html', actual: '/countries', selector: '#regions' },
  { name: 'country-detail', reference: 'final-country-detail.html', actual: '/countries/canada', selector: '#why' },
  { name: 'subjects-listing', reference: 'subjects-listing.html', actual: '/subjects', selector: '#popular' },
  { name: 'subject-detail', reference: 'subject-detail.html', actual: '/subjects/computer-science', selector: '#glance' },
  { name: 'subject-specializations', reference: 'subject-specializations.html', actual: '/subjects/computer-science/specializations', selector: '#all' },
  { name: 'courses-listing', reference: 'courses-listing.html', actual: '/courses', selector: '#discovery' },
];
const settleStyle = `* { animation: none !important; transition: none !important; caret-color: transparent !important; } html { scroll-behavior: auto !important; } ::selection { background: transparent !important; } ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }`;

async function settle(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: settleStyle });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); })));
    window.scrollTo(0, 0);
  });
}

function overlay(reference: PNG, actual: PNG, diff: PNG) {
  const result = new PNG({ width: reference.width, height: reference.height });
  for (let index = 0; index < result.data.length; index += 4) {
    const isDifferent = diff.data[index] > 0 || diff.data[index + 1] > 0 || diff.data[index + 2] > 0;
    const source = isDifferent ? actual.data : reference.data;
    result.data[index] = Math.round(source[index] * 0.5 + actual.data[index] * 0.5);
    result.data[index + 1] = Math.round(source[index + 1] * 0.5 + actual.data[index + 1] * 0.5);
    result.data[index + 2] = Math.round(source[index + 2] * 0.5 + actual.data[index + 2] * 0.5);
    result.data[index + 3] = 255;
  }
  return result;
}

function metrics(referenceBuffer: Buffer, actualBuffer: Buffer) {
  const reference = PNG.sync.read(referenceBuffer);
  const actual = PNG.sync.read(actualBuffer);
  const width = Math.max(reference.width, actual.width);
  const height = Math.max(reference.height, actual.height);
  const referenceSized = reference.width === width && reference.height === height ? reference : new PNG({ width, height });
  const actualSized = actual.width === width && actual.height === height ? actual : new PNG({ width, height });
  if (referenceSized !== reference) PNG.bitblt(reference, referenceSized, 0, 0, reference.width, reference.height, 0, 0);
  if (actualSized !== actual) PNG.bitblt(actual, actualSized, 0, 0, actual.width, actual.height, 0, 0);
  const diff = new PNG({ width, height });
  const differentPixels = pixelmatch(referenceSized.data, actualSized.data, diff.data, width, height, { threshold: 0.1, includeAA: false });
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (diff.data[(y * width + x) * 4] > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { reference: referenceSized, actual: actualSized, diff, differentPixels, metrics: { referenceWidth: reference.width, referenceHeight: reference.height, actualWidth: actual.width, actualHeight: actual.height, totalPixels: width * height, differentPixels, mismatchRatio: differentPixels / (width * height), widthMismatch: reference.width !== actual.width, heightMismatch: reference.height !== actual.height, maximumMismatchRegion: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, comparisonThreshold: 0.1, pass: reference.width === actual.width && reference.height === actual.height && differentPixels / (width * height) <= 0.001 } };
}

for (const route of routes) for (const viewport of viewports) test(`${route.name} ${viewport.name} screenshot parity`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' });
  const referencePage = await context.newPage();
  const actualPage = await context.newPage();
  await referencePage.goto(`http://127.0.0.1:4100/${route.reference}`, { waitUntil: 'networkidle' });
  await settle(referencePage);
  await actualPage.goto(route.actual, { waitUntil: 'networkidle' });
  await settle(actualPage);
  const directory = path.join(outputRoot, route.name, viewport.name);
  fs.mkdirSync(directory, { recursive: true });
  const referencePath = path.join(directory, 'reference.png');
  const actualPath = path.join(directory, 'actual.png');
  const sectionReferencePath = path.join(directory, 'reference-section.png');
  const sectionActualPath = path.join(directory, 'actual-section.png');
  await referencePage.screenshot({ path: referencePath, fullPage: true });
  await actualPage.screenshot({ path: actualPath, fullPage: true });
  const referenceSection = referencePage.locator(route.selector);
  const actualSection = actualPage.locator(route.selector);
  if (await referenceSection.count() === 1 && await actualSection.count() === 1) {
    await referenceSection.screenshot({ path: sectionReferencePath });
    await actualSection.screenshot({ path: sectionActualPath });
  }
  const result = metrics(fs.readFileSync(referencePath), fs.readFileSync(actualPath));
  fs.writeFileSync(path.join(directory, 'diff.png'), PNG.sync.write(result.diff));
  fs.writeFileSync(path.join(directory, 'overlay.png'), PNG.sync.write(overlay(result.reference, result.actual, result.diff)));
  fs.writeFileSync(path.join(directory, 'metrics.json'), JSON.stringify({ route, viewport, ...result.metrics }, null, 2));
  const sectionReferenceBuffer = fs.existsSync(sectionReferencePath) ? fs.readFileSync(sectionReferencePath) : null;
  const sectionActualBuffer = fs.existsSync(sectionActualPath) ? fs.readFileSync(sectionActualPath) : null;
  if (sectionReferenceBuffer && sectionActualBuffer) {
    const sectionResult = metrics(sectionReferenceBuffer, sectionActualBuffer);
    fs.writeFileSync(path.join(directory, 'section-diff.png'), PNG.sync.write(sectionResult.diff));
    fs.writeFileSync(path.join(directory, 'section-overlay.png'), PNG.sync.write(overlay(sectionResult.reference, sectionResult.actual, sectionResult.diff)));
    fs.writeFileSync(path.join(directory, 'section-metrics.json'), JSON.stringify({ route, viewport, ...sectionResult.metrics }, null, 2));
    expect(sectionResult.metrics.widthMismatch).toBe(false);
    expect(sectionResult.metrics.heightMismatch).toBe(false);
    expect(sectionResult.metrics.mismatchRatio).toBeLessThanOrEqual(0.0005);
  }
  expect(result.metrics.widthMismatch).toBe(false);
  expect(result.metrics.heightMismatch).toBe(false);
  expect(result.metrics.mismatchRatio).toBeLessThanOrEqual(0.001);
  await context.close();
});

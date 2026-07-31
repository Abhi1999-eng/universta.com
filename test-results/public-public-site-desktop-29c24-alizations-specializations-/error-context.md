# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public.spec.ts >> public site @ desktop 1536x1024 >> Specializations (/specializations)
- Location: ../../.local-demo-recordings/deployed/public.spec.ts:45:11

# Error details

```
Error: /specializations status

expect(received).toBeLessThan(expected)

Expected: < 400
Received:   404
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "Universta" [ref=e4] [cursor=pointer]:
        - /url: /
        - text: Universta.
      - navigation "Primary navigation":
        - list
      - link "Book free counselling" [ref=e6] [cursor=pointer]:
        - /url: /counselling
  - generic [ref=e8]:
    - heading "404" [level=1] [ref=e9]
    - heading "This page could not be found." [level=2] [ref=e11]
  - contentinfo [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - link "Universta" [ref=e15] [cursor=pointer]:
          - /url: /
          - text: Universta.
        - paragraph [ref=e16]: Published study-abroad information, maintained as source-aware local Phase 1 content.
        - link "Book free counselling" [ref=e17] [cursor=pointer]:
          - /url: /counselling
      - generic [ref=e19]:
        - heading "Contact" [level=2] [ref=e20]
        - list [ref=e21]:
          - listitem [ref=e22]:
            - link "hello@universta.local" [ref=e23] [cursor=pointer]:
              - /url: mailto:hello@universta.local
    - paragraph [ref=e25]: © 2026 Universta. All rights reserved.
  - alert [ref=e26]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | /** Phase 10: every approved public page on the deployed site, at three
  4  |  * viewports, checked for the failures that actually reach a client: a broken
  5  |  * page, a horizontally scrolling body, a console error, a failed API call, or
  6  |  * mixed content. */
  7  | 
  8  | const WEB = 'https://54.162.49.131.nip.io';
  9  | 
  10 | const PAGES: Array<[string, string]> = [
  11 |   ['Home', '/'],
  12 |   ['Countries Listing', '/countries'],
  13 |   ['Cities Listing', '/cities'],
  14 |   ['Universities Listing', '/universities'],
  15 |   ['Subjects Listing', '/subjects'],
  16 |   ['Specializations', '/specializations'],
  17 |   ['Generic Courses', '/courses'],
  18 |   ['Scholarships Listing', '/scholarships'],
  19 |   ['Consultants Listing', '/consultants'],
  20 |   ['Careers Listing', '/careers'],
  21 |   ['Events Listing', '/events'],
  22 |   ['About', '/about'],
  23 |   ['Contact', '/contact'],
  24 |   ['Book Free Counselling', '/counselling'],
  25 |   ['Success Stories', '/success-stories'],
  26 |   ['Testimonials', '/testimonials'],
  27 |   ['FAQ', '/faq'],
  28 |   ['Country Comparison', '/compare/countries'],
  29 |   ['University Comparison', '/compare/universities'],
  30 |   ['Course Comparison', '/compare/courses'],
  31 |   ['Consultant Comparison', '/compare/consultants'],
  32 | ];
  33 | 
  34 | const VIEWPORTS: Array<[string, number, number]> = [
  35 |   ['desktop', 1536, 1024],
  36 |   ['tablet', 768, 1024],
  37 |   ['mobile', 390, 844],
  38 | ];
  39 | 
  40 | for (const [label, width, height] of VIEWPORTS) {
  41 |   test.describe(`public site @ ${label} ${width}x${height}`, () => {
  42 |     test.use({ viewport: { width, height } });
  43 | 
  44 |     for (const [name, path] of PAGES) {
  45 |       test(`${name} (${path})`, async ({ page }) => {
  46 |         const consoleErrors: string[] = [];
  47 |         const failedRequests: string[] = [];
  48 |         const insecure: string[] = [];
  49 | 
  50 |         page.on('console', (m) => {
  51 |           if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  52 |         });
  53 |         page.on('requestfailed', (r) => {
  54 |           const error = r.failure()?.errorText ?? '';
  55 |           // Next prefetches the routes behind visible links (`?_rsc=`) and the
  56 |           // browser cancels the ones it no longer needs. An aborted prefetch is
  57 |           // the framework working as designed, not a broken request, and
  58 |           // counting it would bury a real failure in noise.
  59 |           if (r.url().includes('_rsc=') && error.includes('ERR_ABORTED')) return;
  60 |           failedRequests.push(`${r.url().slice(0, 120)} ${error}`);
  61 |         });
  62 |         page.on('request', (r) => {
  63 |           if (r.url().startsWith('http://')) insecure.push(r.url().slice(0, 120));
  64 |         });
  65 | 
  66 |         const response = await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
> 67 |         expect(response?.status(), `${path} status`).toBeLessThan(400);
     |                                                      ^ Error: /specializations status
  68 |         await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  69 | 
  70 |         // The page rendered something real, not an error shell.
  71 |         await expect(page.locator('body')).toBeVisible();
  72 |         const h1 = await page.locator('h1').first().textContent().catch(() => null);
  73 |         expect(h1?.trim().length ?? 0, `${path} has no heading`).toBeGreaterThan(0);
  74 | 
  75 |         // No horizontal overflow of the document itself.
  76 |         const overflow = await page.evaluate(() =>
  77 |           document.documentElement.scrollWidth - document.documentElement.clientWidth,
  78 |         );
  79 |         expect(overflow, `${path} scrolls horizontally by ${overflow}px`).toBeLessThanOrEqual(2);
  80 | 
  81 |         expect(insecure, `${path} made insecure requests`).toEqual([]);
  82 |         expect(consoleErrors, `${path} console errors`).toEqual([]);
  83 |         expect(failedRequests, `${path} failed requests`).toEqual([]);
  84 |       });
  85 |     }
  86 |   });
  87 | }
  88 | 
```
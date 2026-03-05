import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

import { chromium } from 'playwright';

import { uiGeneratePreviewTool } from '../../src/tools/ui-generate-preview.js';
import { captureSnapshot, compareSnapshots, updateBaseline } from './helpers/visual-tester.ts';

type Viewport = { width: number; height: number; name: string };
type StaticServer = { baseUrl: string; close: () => Promise<void> };

const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

function shouldUpdateBaselines(): boolean {
  return process.env.CCW_VISUAL_UPDATE_BASELINE === '1';
}

// CI environments may render fonts/layouts differently, use higher tolerance
const TOLERANCE_PERCENT = process.env.CI ? 5 : 0.1;

function assertVisualMatch(name: string, currentPath: string): void {
  const baselinePath = resolve(resolve(currentPath, '..', '..'), 'baseline', basename(currentPath));

  if (!existsSync(baselinePath)) {
    if (shouldUpdateBaselines()) {
      updateBaseline(name);
      return;
    }
    throw new Error(
      `Missing baseline snapshot: ${baselinePath}\n` +
        `Re-run with CCW_VISUAL_UPDATE_BASELINE=1 to generate baselines.`
    );
  }

  if (shouldUpdateBaselines()) {
    updateBaseline(name);
    return;
  }

  const result = compareSnapshots(baselinePath, currentPath, TOLERANCE_PERCENT, {
    allowSizeMismatch: !!process.env.CI,
  });
  assert.equal(
    result.pass,
    true,
    `Visual mismatch for ${name}: diffRatio=${result.diffRatio} diffPixels=${result.diffPixels} diff=${result.diffPath ?? 'n/a'}`
  );
}

function contentTypeForPath(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const normalizedRoot = resolve(rootDir);
  const normalizedRootPrefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      const relPath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = resolve(normalizedRoot, relPath);

      if (!filePath.startsWith(normalizedRootPrefix)) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentTypeForPath(filePath) });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end((err as Error).message);
    }
  });

  return await new Promise<StaticServer>((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start server'));
        return;
      }

      resolvePromise({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve) => {
            server.close(() => closeResolve());
          }),
      });
    });
  });
}

function writePrototypeHtml(filePath: string, target: string, style: number, layout: number): void {
  const hue = ((style - 1) * 120 + (layout - 1) * 45) % 360;
  const title = `${target} / style ${style} / layout ${layout}`;
  const lines = Array.from({ length: 80 }, (_, i) => `<div class=\"line\">Line ${i + 1}</div>`).join('');

  writeFileSync(
    filePath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root { --hue: ${hue}; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .header { position: sticky; top: 0; background: white; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: hsl(var(--hue) 90% 90%); border: 1px solid hsl(var(--hue) 80% 70%); }
    .content { padding: 12px; }
    .line { padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.08); }
  </style>
</head>
<body>
  <div class="header"><span class="badge">${title}</span></div>
  <div class="content">${lines}</div>
</body>
</html>`,
    'utf8'
  );
}

describe('ui_generate_preview visual regression', () => {
  const prototypesDir = mkdtempSync(join(tmpdir(), 'ccw-ui-generate-preview-'));
  const templatePath = resolve(homedir(), '.ccw/workflows/_template-compare-matrix.html');

  let server: StaticServer | undefined;
  let browser: import('playwright').Browser | undefined;

  before(async () => {
    const targets = ['button', 'card'];

    for (const target of targets) {
      for (let style = 1; style <= 2; style++) {
        for (let layout = 1; layout <= 2; layout++) {
          const fileName = `${target}-style-${style}-layout-${layout}.html`;
          writePrototypeHtml(join(prototypesDir, fileName), target, style, layout);
        }
      }
    }

    await uiGeneratePreviewTool.execute({
      prototypesDir,
      template: templatePath,
      runId: 'run-test',
      sessionId: 'test',
      timestamp: '2020-01-01T00:00:00.000Z',
    });

    server = await startStaticServer(prototypesDir);
    browser = await chromium.launch();
  });

  after(async () => {
    await browser?.close();
    await server?.close();
    rmSync(prototypesDir, { recursive: true, force: true });
  });

  it('captures stable index.html screenshots across viewports', { timeout: 60_000 }, async () => {
    assert.ok(server);
    assert.ok(browser);

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${server.baseUrl}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('a[href="compare.html"]');

      const name = `ui-generate-preview_index_${viewport.name}`;
      const currentPath = await captureSnapshot(`${server.baseUrl}/index.html`, undefined, name, {
        page,
        skipGoto: true,
        fullPage: true,
      });
      assertVisualMatch(name, currentPath);
      await page.close();
    }
  });

  it('captures compare.html screenshots and validates interactions', { timeout: 120_000 }, async () => {
    assert.ok(server);
    assert.ok(browser);

    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    await page.goto(`${server.baseUrl}/compare.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#matrix-body tr').length === 2);
    await page.waitForFunction(() => document.querySelectorAll('iframe.prototype-iframe').length === 4);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('iframe.prototype-iframe')).every((i) => {
        const doc = (i as HTMLIFrameElement).contentDocument;
        return doc && doc.readyState === 'complete' && doc.querySelector('.badge');
      })
    );

    const initialName = 'ui-generate-preview_compare_desktop_initial';
    const initialPath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, initialName, {
      page,
      skipGoto: true,
      fullPage: false,
    });
    assertVisualMatch(initialName, initialPath);

    // Responsive baseline captures for initial view (tablet/mobile)
    for (const viewport of VIEWPORTS.slice(1)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(250);

      const responsiveName = `ui-generate-preview_compare_${viewport.name}_initial`;
      const responsivePath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, responsiveName, {
        page,
        skipGoto: true,
        fullPage: false,
      });
      assertVisualMatch(responsiveName, responsivePath);
    }

    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await page.waitForTimeout(250);

    // Change page selector
    await page.selectOption('#page-select', 'card');
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('iframe.prototype-iframe')).every((i) =>
        (i as HTMLIFrameElement).src.includes('/card-style-')
      )
    );
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('iframe.prototype-iframe')).every((i) => {
        const doc = (i as HTMLIFrameElement).contentDocument;
        return doc && doc.readyState === 'complete' && doc.querySelector('.badge');
      })
    );

    const pageSelectName = 'ui-generate-preview_compare_desktop_page_card';
    const pageSelectPath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, pageSelectName, {
      page,
      skipGoto: true,
      fullPage: false,
    });
    assertVisualMatch(pageSelectName, pageSelectPath);

    // Change zoom level
    await page.selectOption('#zoom-level', '0.75');
    await page.waitForTimeout(250);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('iframe.prototype-iframe')).every((i) => {
        const doc = (i as HTMLIFrameElement).contentDocument;
        return doc && doc.readyState === 'complete' && doc.querySelector('.badge');
      })
    );
    const zoomName = 'ui-generate-preview_compare_desktop_zoom_75';
    const zoomPath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, zoomName, {
      page,
      skipGoto: true,
      fullPage: false,
    });
    assertVisualMatch(zoomName, zoomPath);

    // Toggle sync scroll off (button text changes)
    await page.click('#sync-scroll-toggle');
    await page.waitForFunction(() => document.getElementById('sync-scroll-toggle')?.textContent?.includes('OFF') === true);
    const syncOffName = 'ui-generate-preview_compare_desktop_sync_scroll_off';
    const syncOffPath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, syncOffName, {
      page,
      skipGoto: true,
      fullPage: false,
    });
    assertVisualMatch(syncOffName, syncOffPath);

    // Validate scroll sync behavior
    const iframeEls = await page.$$('iframe.prototype-iframe');
    assert.ok(iframeEls.length >= 2);
    const firstFrame = await iframeEls[0].contentFrame();
    const secondFrame = await iframeEls[1].contentFrame();
    assert.ok(firstFrame);
    assert.ok(secondFrame);

    await firstFrame.evaluate(() => window.scrollTo(0, 0));
    await secondFrame.evaluate(() => window.scrollTo(0, 0));

    // Re-enable sync scroll
    await page.click('#sync-scroll-toggle');
    await page.waitForFunction(() => document.getElementById('sync-scroll-toggle')?.textContent?.includes('ON') === true);

    await firstFrame.evaluate(() => window.scrollTo(0, 240));
    await page.waitForTimeout(200);
    const syncedScrollTop = await secondFrame.evaluate(() => document.documentElement.scrollTop);
    assert.ok(syncedScrollTop >= 200, `Expected synced scrollTop >= 200, got ${syncedScrollTop}`);

    // Disable sync and validate it stops propagating
    await page.click('#sync-scroll-toggle');
    await page.waitForFunction(() => document.getElementById('sync-scroll-toggle')?.textContent?.includes('OFF') === true);
    await firstFrame.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const unsyncedScrollTop = await secondFrame.evaluate(() => document.documentElement.scrollTop);
    assert.ok(
      unsyncedScrollTop >= 200,
      `Expected scrollTop to remain >= 200 when sync is OFF, got ${unsyncedScrollTop}`
    );

    // Tab switching
    await page.click('.tab[data-tab="comparison"]');
    await page.waitForFunction(() =>
      document.querySelector('.tab.active')?.getAttribute('data-tab') === 'comparison'
    );
    const comparisonTabName = 'ui-generate-preview_compare_desktop_tab_comparison';
    const comparisonTabPath = await captureSnapshot(`${server.baseUrl}/compare.html`, undefined, comparisonTabName, {
      page,
      skipGoto: true,
      fullPage: false,
    });
    assertVisualMatch(comparisonTabName, comparisonTabPath);

    await page.click('.tab[data-tab="matrix"]');
    await page.waitForFunction(() => document.querySelector('.tab.active')?.getAttribute('data-tab') === 'matrix');

    await page.close();
  });
});

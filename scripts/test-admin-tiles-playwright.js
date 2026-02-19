/**
 * Test admin tiles functionality: reproduce the bug sequence and verify fixes.
 * Tests the exact sequence that caused tiles to be set to atlasIndex 35:
 * 1. Load tileset.png from Supabase
 * 2. Save Tile Library
 * 3. Switch to throwaway.png tileset
 * 4. Verify tiles still show correct previews
 *
 * Usage:
 *   Set STORY_MODE_URL (default http://127.0.0.1:5173), STORY_MODE_EMAIL,
 *   STORY_MODE_PASSWORD. Run with dev server up:
 *   node scripts/test-admin-tiles-playwright.js
 *
 * Output: Screenshots in output/ directory showing each step of the test.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.STORY_MODE_URL || 'http://127.0.0.1:5173';
const LOGIN_EMAIL = process.env.STORY_MODE_EMAIL || 'playwrite@crittera.com';
const LOGIN_PASSWORD = process.env.STORY_MODE_PASSWORD || 'playwrite';
const OUTPUT_DIR = process.env.STORY_MODE_OUTPUT || 'output';
const HEADLESS = process.env.STORY_MODE_HEADLESS !== 'false';

const SCREENSHOTS = {
  beforeSave: path.join(OUTPUT_DIR, 'admin-tiles-before-save.png'),
  afterSave: path.join(OUTPUT_DIR, 'admin-tiles-after-save.png'),
  afterSwitch: path.join(OUTPUT_DIR, 'admin-tiles-after-switch.png'),
  savedListAfterSwitch: path.join(OUTPUT_DIR, 'admin-tiles-saved-list-after-switch.png'),
  afterReload: path.join(OUTPUT_DIR, 'admin-tiles-after-reload.png'),
  savedListAfterReload: path.join(OUTPUT_DIR, 'admin-tiles-saved-list-after-reload.png'),
};

async function loginIfNeeded(page) {
  if ((await page.locator('#authEmail').count()) > 0) {
    await page.fill('#authEmail', LOGIN_EMAIL);
    await page.fill('#authPassword', LOGIN_PASSWORD);
    await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
    await page.waitForTimeout(1000);
  }
}

async function waitForTilesetToLoad(page) {
  // Wait for tileset grid to appear and be ready
  await page.waitForSelector('.tileset-grid', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function loadTilesetFromBucket(page, tilesetName, tileWidth, tileHeight) {
  // Set bucket input - find by label text "Bucket"
  const bucketLabel = page.locator('label').filter({ hasText: /^Bucket$/i });
  if ((await bucketLabel.count()) > 0) {
    const bucketInput = bucketLabel.locator('input').first();
    await bucketInput.fill('tilesets');
    await page.waitForTimeout(300);
  }

  // Click "Reload Bucket"
  const reloadBtn = page.getByRole('button', { name: /Reload Bucket/i });
  if ((await reloadBtn.count()) > 0) {
    await reloadBtn.first().click();
    await page.waitForTimeout(3000); // Wait for bucket to load
  }

  // Find and click the tileset in the list
  const tilesetRows = page.locator('.spritesheet-browser__row');
  const rowCount = await tilesetRows.count();
  let found = false;
  for (let i = 0; i < rowCount; i++) {
    const row = tilesetRows.nth(i);
    const rowText = await row.textContent();
    if (rowText && rowText.includes(tilesetName)) {
      const loadBtn = row.getByRole('button', { name: /Load/i });
      if ((await loadBtn.count()) > 0) {
        await loadBtn.click();
        found = true;
        await page.waitForTimeout(1000);
        break;
      }
    }
  }

  if (!found) {
    console.warn(`Warning: Could not find tileset "${tilesetName}" in bucket list`);
  }

  // Set tile dimensions - find inputs by their label text
  const widthLabel = page.locator('label').filter({ hasText: /Tile Pixel Width/i });
  const heightLabel = page.locator('label').filter({ hasText: /Tile Pixel Height/i });
  
  if ((await widthLabel.count()) > 0) {
    const widthInput = widthLabel.locator('input[type="number"]').first();
    await widthInput.fill(String(tileWidth));
    await page.waitForTimeout(200);
  }
  
  if ((await heightLabel.count()) > 0) {
    const heightInput = heightLabel.locator('input[type="number"]').first();
    await heightInput.fill(String(tileHeight));
    await page.waitForTimeout(200);
  }

  // Click "Apply URL" if available
  const applyBtn = page.getByRole('button', { name: /Apply URL/i });
  if ((await applyBtn.count()) > 0) {
    await applyBtn.first().click();
    await page.waitForTimeout(1000);
  }

  await waitForTilesetToLoad(page);
}

async function takeScreenshot(page, path, description) {
  await page.screenshot({ path, fullPage: true });
  console.log(`Screenshot (${description}): ${path}`);
}

async function captureSavedListScreenshot(page, path, description) {
  const heading = page.getByText('Saved Paint Tiles', { exact: false }).first();
  if ((await heading.count()) > 0) {
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await takeScreenshot(page, path, description);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const page = await browser.newPage();
    page.setViewportSize({ width: 1920, height: 1080 });
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('Step 1: Login and navigate to admin tiles');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await loginIfNeeded(page);

    await page.goto(`${BASE_URL}/admin/tiles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Step 2: Load tileset.png from Supabase bucket');
    await loadTilesetFromBucket(page, 'tileset.png', 16, 16);
    await page.waitForTimeout(2000);

    console.log('Step 3: Load saved tiles');
    const loadTilesBtn = page.getByRole('button', { name: /Load Saved Tiles/i });
    if ((await loadTilesBtn.count()) > 0) {
      await loadTilesBtn.first().click();
      await page.waitForTimeout(2000);
    }

    console.log('Step 4: Take screenshot before save');
    await takeScreenshot(page, SCREENSHOTS.beforeSave, 'Before Save Tile Library');

    console.log('Step 5: Click "Save Tile Library"');
    const saveLibraryBtn = page.getByRole('button', { name: /Save Tile Library/i });
    if ((await saveLibraryBtn.count()) > 0) {
      await saveLibraryBtn.first().click();
      await page.waitForTimeout(3000); // Wait for save to complete
    }

    console.log('Step 6: Take screenshot after save');
    await takeScreenshot(page, SCREENSHOTS.afterSave, 'After Save Tile Library');

    console.log('Step 7: Switch to throwaway.png tileset (112x112, 6x6)');
    await loadTilesetFromBucket(page, 'throwaway.png', 112, 112);
    await page.waitForTimeout(2000);

    console.log('Step 8: Take screenshot after tileset switch');
    await takeScreenshot(page, SCREENSHOTS.afterSwitch, 'After Switching to throwaway.png');
    await captureSavedListScreenshot(page, SCREENSHOTS.savedListAfterSwitch, 'Saved tile list after switching tileset');

    console.log('Step 9: Verify tiles still show correct previews');
    // Check if any tiles are visible and have previews
    const tilePreviews = page.locator('.saved-paint-row__preview');
    const previewCount = await tilePreviews.count();
    console.log(`Found ${previewCount} tile preview cells`);
    const previewSpriteKeys = await page.$$eval('.saved-paint-row__preview div', (nodes) =>
      nodes
        .map((node) => {
          const style = window.getComputedStyle(node);
          const image = style.backgroundImage || '';
          if (!image || image === 'none') return '';
          return `${image}|${style.backgroundPositionX}|${style.backgroundPositionY}|${style.backgroundSize}`;
        })
        .filter(Boolean),
    );
    const distinctPreviewSprites = new Set(previewSpriteKeys);
    console.log(`Distinct preview sprite signatures: ${distinctPreviewSprites.size}`);
    if (previewCount > 5 && distinctPreviewSprites.size <= 1) {
      console.warn('WARNING: Preview sprites look collapsed (all/most tiles share one sprite signature).');
    }

    // Check for any error messages
    const errorMessages = page.locator('.status-chip.is-error');
    const errorCount = await errorMessages.count();
    if (errorCount > 0) {
      const errorTexts = [];
      for (let i = 0; i < errorCount; i++) {
        const text = await errorMessages.nth(i).textContent();
        errorTexts.push(text);
      }
      console.warn('WARNING: Error messages found:', errorTexts);
    }

    console.log('Step 10: Reload saved tiles to verify persistence');
    const loadTilesBtn2 = page.getByRole('button', { name: /Load Saved Tiles/i });
    if ((await loadTilesBtn2.count()) > 0) {
      await loadTilesBtn2.first().click();
      await page.waitForTimeout(2000);
    }

    console.log('Step 11: Take final screenshot after reload');
    await takeScreenshot(page, SCREENSHOTS.afterReload, 'After Reloading Saved Tiles');
    await captureSavedListScreenshot(page, SCREENSHOTS.savedListAfterReload, 'Saved tile list after reload');

    // Final verification: check console for errors
    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      console.warn('WARNING: Console errors detected:', consoleErrors);
    } else {
      console.log('No console errors detected');
    }

    console.log('\nTest completed. Review screenshots in output/ directory.');
    console.log('Expected behavior:');
    console.log('  - Tiles should maintain correct previews after switching tilesets');
    console.log('  - No tiles should incorrectly show atlasIndex 35');
    console.log('  - Tile previews should match their assigned tileset');

    // Keep browser open for a moment to see final state
    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

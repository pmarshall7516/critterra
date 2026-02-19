#!/usr/bin/env node
/**
 * Verifies Save Tile Library is authoritative:
 * - remove one saved tile
 * - click Save Tile Library
 * - refresh/load again
 * - assert DB count stays reduced
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.STORY_MODE_URL || 'http://127.0.0.1:5173';
const LOGIN_EMAIL = process.env.STORY_MODE_EMAIL || 'playwrite@crittera.com';
const LOGIN_PASSWORD = process.env.STORY_MODE_PASSWORD || 'playwrite';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    if ((await page.locator('#authEmail').count()) > 0) {
      await page.fill('#authEmail', LOGIN_EMAIL);
      await page.fill('#authPassword', LOGIN_PASSWORD);
      await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
      await page.waitForTimeout(900);
    }

    const token = await page.evaluate(() => localStorage.getItem('critterra.auth.token.v1'));
    if (!token) {
      throw new Error('No auth token found after login.');
    }

    async function getDbCount() {
      const response = await page.request.get(`${BASE_URL}/api/admin/tiles/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json();
      if (!body?.ok) {
        throw new Error(`tiles/list failed: ${JSON.stringify(body)}`);
      }
      return Array.isArray(body.savedPaintTiles) ? body.savedPaintTiles.length : 0;
    }

    const before = await getDbCount();

    await page.goto(`${BASE_URL}/admin/tiles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);

    const loadButton = page.getByRole('button', { name: /Load Saved Tiles/i }).first();
    if ((await loadButton.count()) > 0) {
      await loadButton.click();
      await page.waitForTimeout(1400);
    }

    const removeButtons = page.getByRole('button', { name: /^REMOVE$/i });
    if ((await removeButtons.count()) < 1) {
      throw new Error('No REMOVE buttons found in saved tile list.');
    }
    await removeButtons.first().click();
    await page.waitForTimeout(800);

    const saveButton = page.getByRole('button', { name: /Save Tile Library/i }).first();
    await saveButton.click();
    await page.waitForTimeout(800);

    let afterSave = await getDbCount();
    const target = before - 1;
    const started = Date.now();
    while (afterSave !== target && Date.now() - started < 10_000) {
      await page.waitForTimeout(400);
      afterSave = await getDbCount();
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const loadButtonAfterReload = page.getByRole('button', { name: /Load Saved Tiles/i }).first();
    if ((await loadButtonAfterReload.count()) > 0) {
      await loadButtonAfterReload.click();
      await page.waitForTimeout(1400);
    }

    const afterReload = await getDbCount();

    console.log(
      JSON.stringify(
        {
          before,
          afterSave,
          afterReload,
        },
        null,
        2,
      ),
    );

    if (!(afterSave === target && afterReload === target)) {
      throw new Error(
        `Unexpected counts. Expected afterSave=${target} and afterReload=${target}, got afterSave=${afterSave}, afterReload=${afterReload}`,
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

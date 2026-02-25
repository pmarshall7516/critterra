/**
 * Admin + game verification script: login, open admin/tiles, optionally run
 * "Load Saved Tiles" / "Save Tile Library", capture screenshots, then optionally
 * open the game and capture a game screenshot.
 *
 * Usage:
 *   Set STORY_MODE_URL (default http://127.0.0.1:5173), STORY_MODE_EMAIL,
 *   STORY_MODE_PASSWORD. Run with dev server up:
 *   node scripts/admin_playwright_verify.js
 *
 * Output: output/admin-tiles-verify.png, output/game-verify.png (if --game).
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.STORY_MODE_URL || 'http://127.0.0.1:5173';
const LOGIN_EMAIL = process.env.STORY_MODE_EMAIL || 'playwrite@crittera.com';
const LOGIN_PASSWORD = process.env.STORY_MODE_PASSWORD || 'playwrite';
const OUTPUT_DIR = process.env.STORY_MODE_OUTPUT || 'output';
const ADMIN_TILES_SCREENSHOT = path.join(OUTPUT_DIR, 'admin-tiles-verify.png');
const GAME_SCREENSHOT = path.join(OUTPUT_DIR, 'game-verify.png');

async function loginIfNeeded(page) {
  if ((await page.locator('#authEmail').count()) > 0) {
    await page.fill('#authEmail', LOGIN_EMAIL);
    await page.fill('#authPassword', LOGIN_PASSWORD);
    await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
    await page.waitForTimeout(800);
  }
}

async function main() {
  const withGame = process.argv.includes('--game');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await loginIfNeeded(page);

    await page.goto(`${BASE_URL}/admin/tiles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const loadTiles = page.getByRole('button', { name: /Load Saved Tiles/i });
    if ((await loadTiles.count()) > 0) {
      await loadTiles.first().click();
      await page.waitForTimeout(800);
    }
    const saveLibrary = page.getByRole('button', { name: /Save Tile Library/i });
    if ((await saveLibrary.count()) > 0) {
      await saveLibrary.first().click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: ADMIN_TILES_SCREENSHOT, fullPage: true });
    console.log('Admin tiles screenshot:', ADMIN_TILES_SCREENSHOT);

    if (withGame) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await loginIfNeeded(page);
      const startBtn = page.getByRole('button', { name: /^Start$|^Continue$/i });
      if ((await startBtn.count()) > 0) {
        await startBtn.first().click();
        await page.waitForTimeout(2000);
      }
      await page.waitForFunction(
        () => typeof window.render_game_to_text === 'function',
        { timeout: 15000 },
      ).catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: GAME_SCREENSHOT, fullPage: false });
      console.log('Game screenshot:', GAME_SCREENSHOT);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

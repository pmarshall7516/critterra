/**
 * Sync project maps to database via the API endpoint.
 * Requires admin authentication.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.STORY_MODE_URL || 'http://127.0.0.1:5173';
const LOGIN_EMAIL = process.env.STORY_MODE_EMAIL || 'playwrite@crittera.com';
const LOGIN_PASSWORD = process.env.STORY_MODE_PASSWORD || 'playwrite';

async function syncMaps() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    
    // Login
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    if ((await page.locator('#authEmail').count()) > 0) {
      await page.fill('#authEmail', LOGIN_EMAIL);
      await page.fill('#authPassword', LOGIN_PASSWORD);
      await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
      await page.waitForTimeout(800);
    }
    
    // Get auth token from localStorage
    const token = await page.evaluate(() => {
      return localStorage.getItem('authToken');
    });
    
    if (!token) {
      throw new Error('Failed to get auth token after login');
    }
    
    // Call sync endpoint
    const response = await page.request.post(`${BASE_URL}/api/admin/maps/sync-from-project`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✓ Synced ${result.synced} maps`);
      if (result.errors && result.errors.length > 0) {
        console.log('Errors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
    } else {
      console.error('Sync failed:', result);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

syncMaps().catch((err) => {
  console.error(err);
  process.exit(1);
});

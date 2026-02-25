import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.STORY_MODE_URL || 'http://127.0.0.1:4176';
const LOGIN_EMAIL = process.env.STORY_MODE_EMAIL || 'playwrite@crittera.com';
const LOGIN_PASSWORD = process.env.STORY_MODE_PASSWORD || 'playwrite';
const OUTPUT_ROOT = process.env.STORY_MODE_OUTPUT || 'output/story-mode';

function nowStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '')
    .slice(0, 60);
}

function createRunDirectory() {
  const runDir = path.join(OUTPUT_ROOT, `run-${nowStamp()}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

async function advance(page, ms) {
  await page.evaluate(async (duration) => {
    if (typeof window.advanceTime === 'function') {
      await window.advanceTime(duration);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, duration));
  }, ms);
}

async function readState(page) {
  const raw = await page.evaluate(() => {
    if (typeof window.render_game_to_text === 'function') {
      return window.render_game_to_text();
    }
    return null;
  });
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function capture(page, runDir, stepRef, label) {
  stepRef.value += 1;
  const prefix = `${String(stepRef.value).padStart(3, '0')}-${slugify(label) || 'step'}`;
  const screenshotPath = path.join(runDir, `${prefix}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const state = await readState(page);
  if (state) {
    fs.writeFileSync(path.join(runDir, `${prefix}.json`), JSON.stringify(state, null, 2));
  }
  return { screenshotPath, state };
}

async function pressInteract(page, frames = 10) {
  await page.evaluate(async (stepFrames) => {
    const down = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
    });
    const up = new KeyboardEvent('keyup', {
      key: ' ',
      code: 'Space',
      bubbles: true,
    });
    window.dispatchEvent(down);
    window.dispatchEvent(up);
    if (typeof window.advanceTime === 'function') {
      await window.advanceTime((1000 / 60) * stepFrames);
    }
  }, frames);
  await page.waitForTimeout(20);
}

const DIR_TO_KEY = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

function oppositeDirection(direction) {
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  if (direction === 'left') return 'right';
  if (direction === 'right') return 'left';
  return null;
}

async function stepMove(page, dir, frames = 8) {
  const key = DIR_TO_KEY[dir];
  if (!key) {
    throw new Error(`Unknown direction ${String(dir)}`);
  }
  await page.keyboard.down(key);
  await advance(page, (1000 / 60) * frames);
  await page.keyboard.up(key);
  await page.waitForTimeout(20);
}

function chooseMovementPriority(current, target) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const horizontal = dx > 0 ? 'right' : 'left';
  const vertical = dy > 0 ? 'down' : 'up';

  const dirs = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) dirs.push(horizontal);
    if (dy !== 0) dirs.push(vertical);
  } else {
    if (dy !== 0) dirs.push(vertical);
    if (dx !== 0) dirs.push(horizontal);
  }

  if (!dirs.includes('up')) dirs.push('up');
  if (!dirs.includes('down')) dirs.push('down');
  if (!dirs.includes('left')) dirs.push('left');
  if (!dirs.includes('right')) dirs.push('right');
  return dirs;
}

async function moveTo(page, mapId, target, maxMoves = 300) {
  for (let i = 0; i < maxMoves; i += 1) {
    const state = await readState(page);
    if (!state) {
      throw new Error('render_game_to_text is unavailable while moving.');
    }
    if (state.map?.id !== mapId) {
      throw new Error(`Expected map ${mapId}, got ${state.map?.id ?? 'unknown'}.`);
    }
    const current = state.player?.tile;
    if (!current || typeof current.x !== 'number' || typeof current.y !== 'number') {
      throw new Error('Player tile position missing from state payload.');
    }
    if (current.x === target.x && current.y === target.y) {
      return;
    }

    if (state.dialogue || state.battle || state.story?.starterSelection) {
      throw new Error(`Unexpected blocking state while moving (dialogue=${Boolean(state.dialogue)}, battle=${Boolean(state.battle)}).`);
    }

    const dirs = chooseMovementPriority(current, target);
    let moved = false;
    for (const dir of dirs) {
      const before = await readState(page);
      await stepMove(page, dir, 8);
      const after = await readState(page);
      const beforeTile = before?.player?.tile;
      const afterTile = after?.player?.tile;
      if (
        beforeTile &&
        afterTile &&
        (beforeTile.x !== afterTile.x || beforeTile.y !== afterTile.y || (after?.map?.id ?? '') !== (before?.map?.id ?? ''))
      ) {
        moved = true;
        break;
      }
    }

    if (!moved) {
      throw new Error(`Failed to find a traversable move while routing to ${target.x},${target.y} on ${mapId}.`);
    }
  }
  throw new Error(`Exceeded movement budget while routing to ${target.x},${target.y} on ${mapId}.`);
}

async function clearDialogue(page, maxLines = 20) {
  for (let i = 0; i < maxLines; i += 1) {
    const state = await readState(page);
    if (!state?.dialogue) {
      return;
    }
    await pressInteract(page, 8);
  }
  throw new Error('Dialogue did not clear within expected line limit.');
}

async function waitForBattleStart(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    if (state?.battle) {
      return state;
    }
    if (state?.dialogue) {
      await pressInteract(page, 8);
    } else {
      await advance(page, 120);
    }
  }
  throw new Error('Timed out waiting for Jacob battle to start.');
}

async function runBattleToCompletion(page, runDir, stepRef) {
  const start = Date.now();
  let loop = 0;
  while (Date.now() - start < 120000) {
    loop += 1;
    const state = await readState(page);
    const battle = state?.battle;
    if (!battle) {
      return;
    }

    if (loop % 3 === 1) {
      await capture(page, runDir, stepRef, `battle-loop-${loop}`);
    }

    const nextButton = page.getByRole('button', { name: /^Next$/i });
    if (await nextButton.count()) {
      await nextButton.first().click();
      await page.waitForTimeout(80);
      continue;
    }

    if (battle.phase === 'result') {
      const continueButton = page.getByRole('button', { name: /Continue/i });
      if (await continueButton.count()) {
        await continueButton.first().click();
        await page.waitForTimeout(120);
        continue;
      }
    }

    if (battle.requiresStarterSelection || battle.requiresSwapSelection) {
      const availableSlot = page.locator('.battle-squad-picker__slot:not([disabled])').first();
      if (await availableSlot.count()) {
        await availableSlot.click();
        await page.waitForTimeout(120);
        continue;
      }
    }

    const attackButton = page.getByRole('button', { name: /^Attack$/i });
    if (await attackButton.count()) {
      const disabled = await attackButton.first().isDisabled();
      if (!disabled) {
        await attackButton.first().click();
        await page.waitForTimeout(120);
        continue;
      }
    }

    const guardButton = page.getByRole('button', { name: /^Guard$/i });
    if (await guardButton.count()) {
      const disabled = await guardButton.first().isDisabled();
      if (!disabled) {
        await guardButton.first().click();
        await page.waitForTimeout(120);
        continue;
      }
    }

    await advance(page, 200);
  }

  throw new Error('Timed out while resolving battle sequence.');
}

async function loginIfNeeded(page) {
  if (await page.locator('#authEmail').count()) {
    await page.fill('#authEmail', LOGIN_EMAIL);
    await page.fill('#authPassword', LOGIN_PASSWORD);
    await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
    await page.waitForTimeout(600);
  }

  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return text.includes('Critterra');
  }, { timeout: 15000 });
}

async function restartSaveIfPresent(page) {
  const restartButton = page.getByRole('button', { name: /^Restart$/i });
  if (!(await restartButton.count())) {
    return;
  }
  await restartButton.click();
  await page.fill('#reset-password-input', LOGIN_PASSWORD);
  await page.getByRole('button', { name: /Confirm Restart/i }).click();
  await page.waitForTimeout(800);
}

async function startGameFromTitle(page) {
  const startButton = page.getByRole('button', { name: /^Start$/i });
  if (await startButton.count()) {
    await startButton.click();
  } else {
    const continueButton = page.getByRole('button', { name: /^Continue$/i });
    if (await continueButton.count()) {
      await continueButton.click();
    } else {
      throw new Error('Neither Start nor Continue button is available on title screen.');
    }
  }

  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 15000 });
  await advance(page, 100);
}

async function waitForJacobExit(page, runDir, stepRef) {
  for (let i = 0; i < 12; i += 1) {
    await advance(page, 450);
    await capture(page, runDir, stepRef, `jacob-exit-${i + 1}`);
    const state = await readState(page);
    if (Array.isArray(state?.flags) && state.flags.includes('jacob-left-house')) {
      return;
    }
  }
  throw new Error('Jacob did not complete exit cutscene in expected time window.');
}

async function moveToPortlockAndObserveJacob(page, runDir, stepRef) {
  const exitAttempts = [
    async () => {
      await moveTo(page, 'uncle-s-house', { x: 6, y: 10 }, 180);
      await stepMove(page, 'down', 8);
    },
    async () => {
      await moveTo(page, 'uncle-s-house', { x: 6, y: 11 }, 180);
    },
    async () => {
      await moveTo(page, 'uncle-s-house', { x: 7, y: 11 }, 180);
      await stepMove(page, 'left', 8);
    },
    async () => {
      await moveTo(page, 'uncle-s-house', { x: 5, y: 11 }, 180);
      await stepMove(page, 'right', 8);
    },
  ];

  let warpedToPortlock = false;
  for (let index = 0; index < exitAttempts.length; index += 1) {
    try {
      await exitAttempts[index]();
    } catch {
      // Continue to next attempt.
    }
    await capture(page, runDir, stepRef, `at-uncle-exit-attempt-${index + 1}`);
    await pressInteract(page, 8);
    await advance(page, 250);
    const state = await capture(page, runDir, stepRef, `after-exit-attempt-${index + 1}`);
    if (state?.state?.map?.id === 'portlock') {
      warpedToPortlock = true;
      break;
    }
  }

  if (!warpedToPortlock) {
    throw new Error('Failed to warp from Uncle Hank house back to Portlock after demo completion.');
  }

  for (let i = 0; i < 4; i += 1) {
    await advance(page, 2100);
    await capture(page, runDir, stepRef, `portlock-jacob-wander-${i + 1}`);
  }
}

async function interactWithJacobInPortlock(page, runDir, stepRef) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await readState(page);
    if (state?.map?.id !== 'portlock') {
      return { interacted: false, jacobFacedPlayer: false };
    }
    const jacob = Array.isArray(state?.npcs) ? state.npcs.find((npc) => String(npc.id) === 'jacob-story') : null;
    if (!jacob) {
      await advance(page, 500);
      continue;
    }

    const jacobTile = { x: Math.round(jacob.x), y: Math.round(jacob.y) };
    const candidates = [
      { x: jacobTile.x, y: jacobTile.y + 1, facing: 'up' },
      { x: jacobTile.x + 1, y: jacobTile.y, facing: 'left' },
      { x: jacobTile.x - 1, y: jacobTile.y, facing: 'right' },
      { x: jacobTile.x, y: jacobTile.y - 1, facing: 'down' },
    ];

    let movedToAdjacent = false;
    let facingForInteract = 'up';
    for (const candidate of candidates) {
      try {
        await moveTo(page, 'portlock', { x: candidate.x, y: candidate.y }, 120);
        movedToAdjacent = true;
        facingForInteract = candidate.facing;
        break;
      } catch {
        // Try next adjacent tile.
      }
    }
    if (!movedToAdjacent) {
      await advance(page, 500);
      continue;
    }

    // Turn toward Jacob even if blocked by his tile.
    await stepMove(page, facingForInteract, 2);
    await pressInteract(page, 8);
    await advance(page, 120);
    const shot = await capture(page, runDir, stepRef, `portlock-jacob-interact-attempt-${attempt + 1}`);
    const after = shot.state ?? (await readState(page));
    const jacobAfter = Array.isArray(after?.npcs) ? after.npcs.find((npc) => String(npc.id) === 'jacob-story') : null;
    const playerFacing = after?.player?.facing ?? null;
    const expectedJacobFacing = oppositeDirection(playerFacing);
    const jacobFacedPlayer =
      Boolean(jacobAfter?.facing) &&
      Boolean(expectedJacobFacing) &&
      String(jacobAfter.facing) === String(expectedJacobFacing);
    const interacted = Boolean(
      after?.dialogue &&
      String(after.dialogue.speaker || '').trim().toLowerCase() === 'jacob',
    );
    if (after?.dialogue) {
      await clearDialogue(page, 4);
    }
    if (interacted) {
      return { interacted: true, jacobFacedPlayer };
    }
  }

  return { interacted: false, jacobFacedPlayer: false };
}

async function runStorySequence(page, runDir, stepRef) {
  await capture(page, runDir, stepRef, 'title-or-auth-initial');

  await loginIfNeeded(page);
  await capture(page, runDir, stepRef, 'after-login-title');

  await restartSaveIfPresent(page);
  await capture(page, runDir, stepRef, 'after-restart-check');

  await startGameFromTitle(page);
  await capture(page, runDir, stepRef, 'game-start-spawn');

  await moveTo(page, 'spawn', { x: 5, y: 1 }, 100);
  await capture(page, runDir, stepRef, 'spawn-near-warp');
  await stepMove(page, 'up', 8);
  await advance(page, 350);
  await capture(page, runDir, stepRef, 'arrived-portlock');

  await moveTo(page, 'portlock', { x: 3, y: 5 }, 260);
  await capture(page, runDir, stepRef, 'portlock-at-uncle-door');
  await stepMove(page, 'up', 8);
  await stepMove(page, 'left', 8);
  await pressInteract(page, 8);
  let mapState = await readState(page);
  if (mapState?.map?.id !== 'uncle-s-house') {
    try {
      await moveTo(page, 'portlock', { x: 2, y: 5 }, 80);
    } catch {
      // fall through to additional local adjustments near the door.
    }
    await stepMove(page, 'up', 8);
    await pressInteract(page, 8);
    mapState = await readState(page);
  }
  if (mapState?.map?.id !== 'uncle-s-house') {
    await stepMove(page, 'right', 8);
    await stepMove(page, 'up', 8);
    await stepMove(page, 'left', 8);
    await pressInteract(page, 8);
    mapState = await readState(page);
  }
  if (mapState?.map?.id !== 'uncle-s-house') {
    throw new Error(
      `Failed to enter Uncle Hank's house from Portlock. Current map/pos: ${mapState?.map?.id ?? 'unknown'} @ ${
        mapState?.player?.tile?.x ?? '?'
      },${mapState?.player?.tile?.y ?? '?'}`,
    );
  }
  await advance(page, 300);
  await capture(page, runDir, stepRef, 'entered-uncle-house');

  await moveTo(page, 'uncle-s-house', { x: 6, y: 5 }, 140);
  await pressInteract(page, 8);
  await capture(page, runDir, stepRef, 'uncle-intro-triggered');
  const uncleIntroState = await readState(page);
  const uncleIntroNpc = Array.isArray(uncleIntroState?.npcs)
    ? uncleIntroState.npcs.find((npc) => String(npc.id) === 'uncle-hank-story')
    : null;
  const uncleFacesPlayerOnInteract =
    Boolean(uncleIntroState?.player?.facing) &&
    Boolean(uncleIntroNpc?.facing) &&
    String(uncleIntroNpc.facing) === String(oppositeDirection(uncleIntroState.player.facing));

  await clearDialogue(page, 10);
  await capture(page, runDir, stepRef, 'starter-selection-open');

  const starterCards = page.locator('.starter-overlay__card');
  const starterCount = await starterCards.count();
  if (starterCount === 0) {
    throw new Error('Starter overlay opened but no starter cards were rendered.');
  }

  const firstCard = starterCards.first();
  await firstCard.hover();
  await capture(page, runDir, stepRef, 'starter-card-hovered');

  const buddoCard = page.locator('.starter-overlay__card', { hasText: /Buddo/i });
  let chosenName = 'Starter';
  if (await buddoCard.count()) {
    chosenName = (await buddoCard.first().innerText()).trim();
    await buddoCard.first().click();
  } else {
    chosenName = (await firstCard.innerText()).trim();
    await firstCard.click();
  }

  await capture(page, runDir, stepRef, 'starter-confirm-prompt');
  await page.getByRole('button', { name: /^Yes$/i }).click();
  await advance(page, 200);
  await capture(page, runDir, stepRef, 'starter-confirmed-dialogue');

  await clearDialogue(page, 10);
  await capture(page, runDir, stepRef, 'post-starter-dialogue-cleared');

  let leashGuardTriggered = false;
  for (let i = 0; i < 8; i += 1) {
    await stepMove(page, 'down', 8);
  }
  const leashState = await readState(page);
  leashGuardTriggered = Boolean(
    leashState?.dialogue &&
      String(leashState.dialogue.speaker || '').trim().toLowerCase() === 'uncle hank' &&
      String(leashState.dialogue.text || '').includes("Don't leave yet! Unlock your Partner Critter first!"),
  );
  await capture(page, runDir, stepRef, 'demo-leash-guard-check');
  if (leashState?.dialogue) {
    await clearDialogue(page, 4);
  }
  const unlockRepositionSteps = ['up', 'up', 'up', 'left', 'left'];
  for (const direction of unlockRepositionSteps) {
    await stepMove(page, direction, 8);
    const state = await readState(page);
    if (state?.dialogue) {
      await clearDialogue(page, 4);
    }
  }
  await capture(page, runDir, stepRef, 'pre-unlock-positioned-away-from-hank');
  const unlockPositionState = await readState(page);
  const unlockPosition = unlockPositionState?.player?.tile
    ? { x: unlockPositionState.player.tile.x, y: unlockPositionState.player.tile.y }
    : null;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: /^Collection$/i }).click();
  await page.waitForTimeout(180);
  await capture(page, runDir, stepRef, 'collection-open-before-unlock');

  const buddoAdvanceButton = page
    .locator('.collection-card', { hasText: /Buddo/i })
    .locator('.collection-card__advance')
    .first();

  if (await buddoAdvanceButton.count()) {
    await buddoAdvanceButton.click();
  } else {
    const firstAdvanceButton = page.locator('.collection-card__advance').first();
    if (!(await firstAdvanceButton.count())) {
      throw new Error('No unlock/advance action button is available in collection.');
    }
    await firstAdvanceButton.click();
  }

  await page.waitForTimeout(180);
  await capture(page, runDir, stepRef, 'collection-after-starter-unlock');

  const backButton = page.getByRole('button', { name: /^Back$/i });
  if (await backButton.count()) {
    await backButton.first().click();
    await page.waitForTimeout(120);
  }
  const resumeButton = page.getByRole('button', { name: /^Resume$/i });
  if (await resumeButton.count()) {
    await resumeButton.first().click();
  } else {
    const backdrop = page.locator('.side-menu__backdrop');
    if (await backdrop.count()) {
      await backdrop.first().click();
    }
  }
  await page.waitForTimeout(200);
  await capture(page, runDir, stepRef, 'menu-closed-before-jacob-cutscene');
  const postMenuState = await readState(page);
  const postMenuTile = postMenuState?.player?.tile;
  const playerFrozenAfterMenuClose = Boolean(
    unlockPosition &&
      postMenuTile &&
      unlockPosition.x === postMenuTile.x &&
      unlockPosition.y === postMenuTile.y,
  );

  const battleStartState = await waitForBattleStart(page, 25000);
  await capture(page, runDir, stepRef, 'jacob-battle-started');
  const battlePlayerTile = battleStartState?.player?.tile;
  const battleJacob = Array.isArray(battleStartState?.npcs)
    ? battleStartState.npcs.find((npc) => String(npc.id) === 'jacob-story')
    : null;
  const jacobReachedPlayer =
    Boolean(battlePlayerTile) &&
    Boolean(battleJacob) &&
    Math.abs(Math.round(battleJacob.x) - battlePlayerTile.x) + Math.abs(Math.round(battleJacob.y) - battlePlayerTile.y) <= 1;
  const jacobMoveFramesObserved =
    Boolean(
      Array.isArray(postMenuState?.npcs) &&
      battleJacob &&
      (() => {
        const movingJacob = postMenuState.npcs.find((npc) => String(npc.id) === 'jacob-story');
        return Boolean(
          movingJacob?.moving &&
          Number.isFinite(movingJacob?.frameIndex) &&
          Number.isFinite(battleJacob?.frameIndex) &&
          movingJacob.frameIndex !== battleJacob.frameIndex,
        );
      })(),
    );

  await runBattleToCompletion(page, runDir, stepRef);
  await capture(page, runDir, stepRef, 'jacob-battle-resolved');

  await clearDialogue(page, 12);
  await capture(page, runDir, stepRef, 'jacob-thanks-dialogue-cleared');
  const jacobExitStartState = await readState(page);
  const jacobExitStartNpc = Array.isArray(jacobExitStartState?.npcs)
    ? jacobExitStartState.npcs.find((npc) => String(npc.id) === 'jacob-story')
    : null;
  const jacobExitDownMoveObserved = Boolean(
    jacobExitStartNpc &&
    jacobExitStartNpc.moving &&
    String(jacobExitStartNpc.facing) === 'down' &&
    Number.isFinite(jacobExitStartNpc.frameIndex),
  );

  await waitForJacobExit(page, runDir, stepRef);
  await capture(page, runDir, stepRef, 'jacob-exit-finished');

  await moveToPortlockAndObserveJacob(page, runDir, stepRef);
  const portlockJacobInteraction = await interactWithJacobInPortlock(page, runDir, stepRef);

  const finalState = await readState(page);
  return {
    chosenStarterCardText: chosenName,
    finalState,
    leashGuardTriggered,
    playerFrozenAfterMenuClose,
    jacobReachedPlayer,
    uncleFacesPlayerOnInteract,
    jacobMoveFramesObserved,
    jacobExitDownMoveObserved,
    portlockJacobInteracted: portlockJacobInteraction.interacted,
    portlockJacobFacedPlayerOnInteract: portlockJacobInteraction.jacobFacedPlayer,
  };
}

async function main() {
  const runDir = createRunDirectory();
  const stepRef = { value: 0 };
  const consoleErrors = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ type: 'console.error', text: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push({ type: 'pageerror', text: String(error) });
  });

  const status = {
    ok: false,
    baseUrl: BASE_URL,
    outputDir: runDir,
    login: {
      email: LOGIN_EMAIL,
      success: false,
    },
    storyChecks: {
      demoStartFlag: false,
      demoLeashGuardTriggered: false,
      selectedStarterFlag: false,
      selectedBloomStarterFlag: false,
      starterSelectionDoneFlag: false,
      demoDoneFlag: false,
      jacobLeftHouseFlag: false,
      jacobSeenInPortlock: false,
      playerFrozenAfterCollectionClose: false,
      jacobReachedPlayerPosition: false,
      uncleFacesPlayerOnInteract: false,
      jacobMoveFramesObserved: false,
      jacobExitDownMoveObserved: false,
      jacobInteractedInPortlock: false,
      jacobFacesPlayerInPortlock: false,
    },
    notes: [],
    consoleErrors,
    chosenStarterCardText: null,
    timestamp: new Date().toISOString(),
  };

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const result = await runStorySequence(page, runDir, stepRef);
    status.login.success = true;
    status.chosenStarterCardText = result.chosenStarterCardText;
    status.storyChecks.demoLeashGuardTriggered = result.leashGuardTriggered;
    status.storyChecks.playerFrozenAfterCollectionClose = result.playerFrozenAfterMenuClose;
    status.storyChecks.jacobReachedPlayerPosition = result.jacobReachedPlayer;
    status.storyChecks.uncleFacesPlayerOnInteract = result.uncleFacesPlayerOnInteract;
    status.storyChecks.jacobMoveFramesObserved = result.jacobMoveFramesObserved;
    status.storyChecks.jacobExitDownMoveObserved = result.jacobExitDownMoveObserved;
    status.storyChecks.jacobInteractedInPortlock = result.portlockJacobInteracted;
    status.storyChecks.jacobFacesPlayerInPortlock = result.portlockJacobFacedPlayerOnInteract;

    const finalFlags = Array.isArray(result.finalState?.flags) ? result.finalState.flags : [];
    const finalNpcs = Array.isArray(result.finalState?.npcs) ? result.finalState.npcs : [];

    status.storyChecks.demoStartFlag = finalFlags.includes('demo-start');
    status.storyChecks.selectedStarterFlag = finalFlags.includes('selected-starter-critter');
    status.storyChecks.selectedBloomStarterFlag = finalFlags.includes('selected-bloom-starter');
    status.storyChecks.starterSelectionDoneFlag = finalFlags.includes('starter-selection-done');
    status.storyChecks.demoDoneFlag = finalFlags.includes('demo-done');
    status.storyChecks.jacobLeftHouseFlag = finalFlags.includes('jacob-left-house');
    status.storyChecks.jacobSeenInPortlock = Boolean(finalNpcs.find((npc) => String(npc.id) === 'jacob-story'));

    const checks = Object.values(status.storyChecks);
    status.ok = checks.every(Boolean) && consoleErrors.length === 0;
    if (!status.storyChecks.jacobSeenInPortlock) {
      status.notes.push('Jacob was not found in final portlock NPC snapshot.');
    }
    if (!status.storyChecks.playerFrozenAfterCollectionClose) {
      status.notes.push('Player position changed between starter unlock menu close and Jacob cutscene start.');
    }
    if (!status.storyChecks.jacobReachedPlayerPosition) {
      status.notes.push('Jacob did not arrive adjacent to the player before battle start.');
    }
    if (!status.storyChecks.uncleFacesPlayerOnInteract) {
      status.notes.push('Uncle Hank did not face the player during initial interaction.');
    }
    if (!status.storyChecks.jacobMoveFramesObserved) {
      status.notes.push('Did not observe Jacob moving-frame change before duel start.');
    }
    if (!status.storyChecks.jacobExitDownMoveObserved) {
      status.notes.push('Did not observe Jacob moving down at exit start.');
    }
    if (!status.storyChecks.jacobInteractedInPortlock) {
      status.notes.push('Could not trigger Jacob dialogue in Portlock interaction check.');
    }
    if (!status.storyChecks.jacobFacesPlayerInPortlock) {
      status.notes.push('Jacob did not face the player during Portlock interaction check.');
    }
    if (consoleErrors.length > 0) {
      status.notes.push('Console errors were recorded during run.');
    }
  } catch (error) {
    status.ok = false;
    status.notes.push(error instanceof Error ? error.message : String(error));
    await capture(page, runDir, stepRef, 'failure-capture');
  } finally {
    fs.writeFileSync(path.join(runDir, 'status.json'), JSON.stringify(status, null, 2));
    if (consoleErrors.length > 0) {
      fs.writeFileSync(path.join(runDir, 'errors.json'), JSON.stringify(consoleErrors, null, 2));
    }
    await browser.close();
  }

  if (!status.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

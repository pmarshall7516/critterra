import { describe, expect, it } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { Direction } from '@/shared/types';

const TEST_DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];

function createTestSprite() {
  const facingFrames = Object.fromEntries(TEST_DIRECTIONS.map((direction, index) => [direction, index * 4]));
  const walkFrames = Object.fromEntries(
    TEST_DIRECTIONS.map((direction, index) => [direction, [index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3]]),
  );
  return {
    facingFrames,
    walkFrames,
  };
}

describe('GameRuntime walk animation pacing', () => {
  it('spreads walk frames across multiple completed movement steps', () => {
    const runtime = Object.create(GameRuntime.prototype) as GameRuntime & { [key: string]: any };
    const sprite = createTestSprite();

    expect(
      (runtime as any).getSpriteFrameIndex(sprite, 'down', true, 0, {
        moveProgressAndPhase: { progress: 0.99, stridePhase: 0 },
      }),
    ).toBe(0);

    expect(
      (runtime as any).getSpriteFrameIndex(sprite, 'down', true, 0, {
        moveProgressAndPhase: { progress: 0.99, stridePhase: 1 },
      }),
    ).toBe(1);

    expect(
      (runtime as any).getSpriteFrameIndex(sprite, 'down', true, 0, {
        moveProgressAndPhase: { progress: 0.99, stridePhase: 5 },
      }),
    ).toBe(3);
  });
});

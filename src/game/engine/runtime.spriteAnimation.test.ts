import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { TILE_SIZE } from '@/shared/constants';

describe('GameRuntime sprite animation pacing', () => {
  it('paces walking frames by animation time instead of step progress', () => {
    const runtime = Object.create(GameRuntime.prototype) as any;
    const sprite = {
      facingFrames: {
        up: 0,
        down: 1,
        left: 2,
        right: 3,
      },
      walkFrames: {
        right: [30, 31, 32],
      },
      defaultIdleAnimation: 'idle',
      defaultMoveAnimation: 'walk',
    };

    expect(
      runtime.getSpriteFrameIndex(sprite, 'right', true, 0, {
        moveProgressAndPhase: { progress: 0.95, stridePhase: 1 },
      }),
    ).toBe(30);
    expect(
      runtime.getSpriteFrameIndex(sprite, 'right', true, 40, {
        moveProgressAndPhase: { progress: 0.95, stridePhase: 1 },
      }),
    ).toBe(30);
    expect(
      runtime.getSpriteFrameIndex(sprite, 'right', true, 60, {
        moveProgressAndPhase: { progress: 0.1, stridePhase: 0 },
      }),
    ).toBe(31);
  });

  it('renders sprite sheets slightly wider than one tile by default', () => {
    const runtime = Object.create(GameRuntime.prototype) as any;
    const ctx = {
      fillStyle: '',
      imageSmoothingEnabled: true,
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
    } as any;
    const sprite = {
      frameWidth: 64,
      frameHeight: 64,
      renderWidthTiles: 1,
      renderHeightTiles: 2,
      facingFrames: {
        up: 0,
        down: 0,
        left: 0,
        right: 0,
      },
    };
    const sheet = {
      image: {} as HTMLImageElement,
      columns: 8,
    };

    expect(runtime.drawSpriteFrame(ctx, sprite, sheet, 0, { x: 2, y: 2 }, 0, 0)).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage.mock.calls[0][7]).toBeCloseTo(TILE_SIZE * 1.08);
  });
});

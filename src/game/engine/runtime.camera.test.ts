import { describe, expect, it } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';

function getCenteredCameraOrigin(focusCoord: number, viewTiles: number, mapTiles: number): number {
  return (GameRuntime as any).getCenteredCameraOrigin(focusCoord, viewTiles, mapTiles) as number;
}

describe('GameRuntime camera centering', () => {
  it('centers the player on odd-sized camera windows using the tile center', () => {
    const cameraOrigin = getCenteredCameraOrigin(10, 19, 60);
    expect(cameraOrigin).toBe(1);
    expect(10 - cameraOrigin + 0.5).toBe(19 / 2);
  });

  it('centers the player on even-sized camera windows using the tile center', () => {
    const cameraOrigin = getCenteredCameraOrigin(20, 8, 60);
    expect(cameraOrigin).toBe(16.5);
    expect(20 - cameraOrigin + 0.5).toBe(8 / 2);
  });

  it('clamps the camera at map edges when centering would exceed bounds', () => {
    expect(getCenteredCameraOrigin(1, 19, 60)).toBe(0);
    expect(getCenteredCameraOrigin(58, 19, 60)).toBe(41);
  });

  it('keeps the player centered even when the map is smaller than the camera window', () => {
    const cameraOrigin = getCenteredCameraOrigin(2, 10, 6);
    expect(cameraOrigin).toBe(-2.5);
    expect(2 - cameraOrigin + 0.5).toBe(10 / 2);
  });
});

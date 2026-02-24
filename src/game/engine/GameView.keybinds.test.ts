import { describe, expect, it } from 'vitest';
import { resolveGameViewKeyIntent } from '@/game/engine/GameView';

describe('resolveGameViewKeyIntent', () => {
  it('uses Y for fullscreen toggle', () => {
    const lower = resolveGameViewKeyIntent({
      key: 'y',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    const upper = resolveGameViewKeyIntent({
      key: 'Y',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(lower).toBe('toggle-fullscreen');
    expect(upper).toBe('toggle-fullscreen');
  });

  it('keeps Escape focused on battle cancel when battle is active', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: true,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('battle-cancel');
  });

  it('uses Escape for menu toggle when gameplay input is available', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('toggle-menu');
  });

  it('blocks Escape menu toggling while story input is locked', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: false,
      storyInputLocked: true,
      menuOpen: false,
    });
    expect(result).toBe('block-for-menu');
  });

  it('does not forward gameplay input while side menu is open', () => {
    const result = resolveGameViewKeyIntent({
      key: 'w',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: true,
    });
    expect(result).toBe('block-for-menu');
  });

  it('forwards gameplay keys during normal exploration', () => {
    const result = resolveGameViewKeyIntent({
      key: 'w',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('forward-to-runtime');
  });
});

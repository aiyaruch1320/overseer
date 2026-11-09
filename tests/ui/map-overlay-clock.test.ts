// 20-god-ui.md §2 (row "แผนที่เล็ก"): the clock is paused while the full map is open and goes on after it closes, only if it was running before.
import { beforeAll, describe, expect, it } from 'vitest';
import { store } from '../../src/app/store';
import { closeMap, openMap } from '../../src/ui/MapOverlay';
import { loadAll } from '../../scripts/tools/node-data';

beforeAll(() => {
  store.setData(loadAll());
  store.newLife({ seed: 1 });
});

describe('map overlay and the clock', () => {
  it('pauses the clock on open and resumes it on close', () => {
    store.play();
    expect(store.running.value).toBe(true);
    openMap();
    expect(store.running.value).toBe(false);
    closeMap();
    expect(store.running.value).toBe(true);
  });

  it('leaves a clock that was already paused paused', () => {
    store.pause();
    openMap();
    closeMap();
    expect(store.running.value).toBe(false);
  });
});

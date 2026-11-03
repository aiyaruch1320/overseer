// The view model of the map (src/app/views/map.ts): what a game state shows on the map.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, startLife } from '../../scripts/tools/session';
import { mapModel, withSample } from '../../src/app/views/map';
import type { GameData } from '../../src/core/game';
import type { GameState } from '../../src/core/types';
import { actsOf } from '../../src/core/god/acts/state';
import { ruinExt } from '../../src/core/god/ruin/state';
import { DRAGON_BEDS, FATES } from '../../src/map/tuning';

let data: GameData;
let state: GameState;
beforeAll(() => {
  data = loadAll();
  const s = createSession(data, { seed: 3 });
  startLife(s);
  state = s.game.state;
});

describe('map model', () => {
  it('shows a fresh world: no changed continent, no ruin, fifteen dragons asleep, the character at home', () => {
    const m = mapModel(data, state);
    expect(m.fates).toEqual([]);
    expect(m.ruins).toEqual([]);
    expect(m.dragons.length).toBe(15);
    expect(m.dragons.every((d) => d.country === DRAGON_BEDS[d.index][0])).toBe(true);
    expect(m.dragons.filter((d) => d.alive).length).toBeGreaterThan(0);
    expect(m.character?.country).toBe(state.life!.country);
    expect(m.character?.city).toBe(`${state.life!.country}/0`);
    expect(m.omens).toEqual([]);
  });

  it('turns the events that change a continent into the look of its continent (the eight forms)', () => {
    const copy: GameState = JSON.parse(JSON.stringify(state));
    for (const f of FATES) copy.world.happened[f.event] = 10500 + FATES.indexOf(f);
    const m = mapModel(data, copy);
    expect(m.fates.length).toBe(8);
    expect(m.looks.flood).toBe(true);
    expect(m.looks.fates).toEqual({ AZ: 'skyfall', KD: 'ash', AL: 'split', SV: 'withered', MK: 'rust', NB: 'fog' }); // BIO-05 then FG-11: the later wins on Nebulia
  });

  it('turns ruins and fallen countries into marks, and gives them a share of broken towns', () => {
    const copy: GameState = JSON.parse(JSON.stringify(state));
    copy.world.countryFlags['AL-07'] = ['fallen', 'war'];
    ruinExt(copy).ruins.push({ country: 'AL-03', kind: 'MR-17', year: 11000, label: 'ซากทดสอบ', pop: 0.2, fled: [], stayed: [], died: [], due: {}, done: {}, took: [], closed: [], closedLc: [], moved: {} });
    const m = mapModel(data, copy);
    expect(m.ruins.map((r) => [r.country, r.kind]).sort()).toEqual([['AL-03', 'MR-17'], ['AL-07', 'fallen']]);
    expect(m.looks.ruin!['AL-03']).toBeGreaterThan(m.looks.ruin!['AL-07']);
    expect(m.ruins.find((r) => r.country === 'AL-03')!.label).toBe('ซากทดสอบ');
    expect(m.flags['AL-07']).toEqual(['war']); // `fallen` is the ruin, not a small mark
  });

  it('shows the pending miracles as omens with the colour of the line that paid', () => {
    const copy: GameState = JSON.parse(JSON.stringify(state));
    actsOf(copy).pending.push({ n: 1, id: 'MR-17', args: { country: 'AL-02' }, left: 3, paid: { faith: 0, dread: 30 }, year: 10450 });
    actsOf(copy).pending.push({ n: 2, id: 'MR-21', args: { continent: 'AL' }, left: 4, paid: { faith: 50, dread: 0 }, year: 10450 });
    const m = mapModel(data, copy);
    expect(m.omens.map((o) => [o.id, o.country ?? o.continent])).toEqual([['MR-17', 'AL-02'], ['MR-21', 'AL']]);
    expect(m.omens[0].color).not.toBe(m.omens[1].color);
    expect(m.omens[0].name.length).toBeGreaterThan(0);
  });

  it('is pure: it does not change the state, and a sample is added on a copy of the model', () => {
    const before = JSON.stringify(state);
    const m = mapModel(data, state);
    expect(JSON.stringify(state)).toBe(before);
    const s = withSample(m, { fate: 'ash', ruin: 'AL-03' });
    expect(m.fates.length).toBe(0);
    expect(s.looks.fates.KD).toBe('ash');
    expect(s.ruins.length).toBe(1);
  });
});

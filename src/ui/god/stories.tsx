// The stories of the god's screens (code-plan §8.1 rule 5). Each draws one power on a sample game: a seeded life (seed 3) run to its first call of the game,
// the age stop of 5, where the god has three doors for a dream, a prayer waiting and a chest to open. A story may run commands on its sample to reach
// the state it shows (an open chest, a miracle's omen, a ruin). The bridge of a sample runs commands straight on it.
import { useState } from 'preact/hooks';
import { command } from '../../core/command';
import type { Game, GameData } from '../../core/game';
import type { GameState, GodAction } from '../../core/types';
import { allCountries } from '../../core/god/acts/geo';
import { sealCountries } from '../../core/god/ruin';
import { resumeSession, runToCall } from '../../../scripts/tools/session';
import { story } from '../stories';
import { sampleBridge } from './bridge';
import { GodPanel } from './panel';
import type { GodKind } from '../../app/views/god';

const SEED = 3;
const games = new WeakMap<GameState, Game>();

/** The sample game of a story state: a copy of it run to its first call of the game, then shaped by `shape`. Made once per state. */
function gameOf(data: GameData, state: GameState, shape?: (g: Game) => void): Game {
  let g = games.get(state);
  if (!g) {
    g = resumeSession(data, structuredClone(state), { seed: SEED }).game;
    runToCall(g);
    shape?.(g);
    games.set(state, g);
  }
  return g;
}

/** A country that is neither the character's home nor a seal of a dragon (a star there makes a ruin, not a cracked city). */
const farCountry = (g: Game): string => {
  const seals = new Set(sealCountries(g.ctx));
  return allCountries(g.ctx).find((c) => c !== g.state.life?.country && !seals.has(c) && c.startsWith('AZ')) ?? 'AZ-01';
};

const run = (g: Game, action: GodAction, args: Record<string, unknown> = {}) => command(g.ctx, { type: 'god', action, args, confirm: true });

function Sample(p: { data: GameData; state: GameState; kind: GodKind; args?: Record<string, unknown>; shape?: (g: Game) => void }) {
  const [bridge] = useState(() => sampleBridge(gameOf(p.data, p.state, p.shape), p.data));
  return (
    <div style={{ padding: 16 }}>
      <GodPanel inline kind={p.kind} args={p.args} bridge={bridge} onClose={() => undefined} />
    </div>
  );
}

const G = 'พระเจ้า';
const base = { seed: SEED, at: 0 } as const;

const openChest = (g: Game) => void run(g, 'chest.open');
/** A world with a ruin and an omen: light and dread are filled, a star falls on a far country and one season passes. */
const withRuin = (g: Game) => {
  g.state.god.light = 200;
  g.state.god.dread = 200;
  const far = farCountry(g);
  run(g, 'miracle', { id: 'MR-17', country: far });
  for (let i = 0; i < 6; i++) g.beat();
};
const withOmen = (g: Game) => {
  g.state.god.light = 200;
  g.state.god.dread = 200;
  const far = farCountry(g);
  run(g, 'miracle', { id: 'MR-17', country: far });
};
const withDeeds = (g: Game) => {
  openChest(g);
  const slot = (g.state.god.chest as { slots: ({ slot: number } | null)[] } | null)?.slots.find((s) => s)?.slot;
  if (slot) run(g, 'chest.pick', { slot });
  run(g, 'whisper', { hint: 'ระวัง' });
  g.state.god.light = 120;
  run(g, 'miracle', { id: 'MR-01', country: g.state.life?.country });
};

/** Registers one story: the power on a fresh sample game (the key makes the page start a new sample when another story is picked). */
function power(name: string, kind: GodKind, args?: Record<string, unknown>, shape?: (g: Game) => void): void {
  story({ ...base, group: G, name, render: (c) => <Sample key={name} data={c.data} state={c.state} kind={kind} args={args} shape={shape} /> });
}

power('หีบประทาน (ปิด)', 'chest');
power('หีบประทาน (เปิด)', 'chest', undefined, openChest);
power('หีบประทาน (พลังไม่พอ)', 'chest', undefined, (g) => {
  openChest(g);
  g.state.god.light = 6;
  g.state.god.dread = 2;
});
power('เข้าฝัน', 'dream');
power('กระซิบ', 'whisper', { hint: 'จงไป' });
power('คำอธิษฐาน', 'prayer');
power('ปาฏิหาริย์ (เลือกและเล็ง)', 'miracle', { id: 'MR-01' }, (g) => void (g.state.god.light = 120));
power('ปาฏิหาริย์ (ลางที่รออยู่)', 'miracle', { tab: 'omens' }, withOmen);
power('ปาฏิหาริย์ (ซาก)', 'miracle', { tab: 'ruins' }, withRuin);
power('ปาฏิหาริย์ (วันเกิดเหตุ)', 'miracle', { tab: 'day' }, withRuin);
power('ลิขิต', 'miracle', { tab: 'fate' });
power('เสกตามใจ', 'conjure');
power('พงศาวดารพระหัตถ์', 'chronicle', undefined, withDeeds);

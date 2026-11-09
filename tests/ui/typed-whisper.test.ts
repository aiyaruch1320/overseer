// The free words of the player in the whisper panel (src/app/views/typed.ts): offline, the fake provider answers from tests/fixtures/llm/fake.json, no network.
import { beforeAll, describe, expect, it } from 'vitest';
import fixtures from '../fixtures/llm/fake.json';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToCall, startLife } from '../../scripts/tools/session';
import { W } from '../../src/app/views/god-words';
import { understandWords } from '../../src/app/views/typed';
import { command } from '../../src/core/command';
import type { Game, GameData } from '../../src/core/game';
import { fakeLlm, type Fixtures } from '../../src/core/llm';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function atCall(): Game {
  const s = createSession(data, { seed: 7 });
  startLife(s);
  runToCall(s.game);
  const g = s.game;
  g.state.god.light = 200;
  g.state.settings.llm = { master: true, setup: true, director: true, epitaph: true };
  return g;
}

const FX = fixtures as unknown as Fixtures;

describe('typed words to a whisper draft', () => {
  it('with no LLM: the name of a hint in the words is understood, other words show the menu', async () => {
    const g = atCall();
    const hit = await understandWords(g, undefined, 'ขอให้เขาระวังหน่อย');
    expect(hit).toEqual({ ok: true, hint: 'ระวัง', source: 'template' });
    const miss = await understandWords(g, undefined, 'ไปทางเหนือ');
    expect(miss).toMatchObject({ ok: false, line: W.whisper.typed.noFit });
    expect(await understandWords(g, undefined, '   ')).toMatchObject({ ok: false, line: W.whisper.typed.empty });
  });

  it('a hint that points names its target by the name of the place', async () => {
    const g = atCall();
    const r = await understandWords(g, undefined, 'จงไป NB');
    expect(r).toMatchObject({ ok: true, hint: 'จงไป', target: 'NB' });
    expect(r.ok && r.targetName).toBeTruthy();
  });

  it('with the LLM: free words become a hint of the menu, and the draft passes the whisper\'s own preview', async () => {
    const g = atCall();
    const { llm, provider } = fakeLlm(FX);
    const r = await understandWords(g, llm, 'ไปทางเหนือ');
    expect(r).toMatchObject({ ok: true, hint: 'จงไป', target: 'NB', source: 'llm' });
    expect(provider.calls).toHaveLength(1);
    if (!r.ok) return;
    const pre = command(g.ctx, { type: 'god', action: 'whisper', args: { hint: r.hint, target: r.target }, confirm: false });
    expect(pre.ok).toBe(true);
  });

  it('the LLM says nothing fits: the menu is shown and nothing is made up', async () => {
    const g = atCall();
    const { llm } = fakeLlm(FX);
    expect(await understandWords(g, llm, 'ขอให้รวยล้นฟ้า')).toMatchObject({ ok: false, line: W.whisper.typed.noMatch });
  });

  it('the LLM fails (no fixture): the menu is shown, the game goes on', async () => {
    const g = atCall();
    const { llm } = fakeLlm({ responses: [] });
    expect(await understandWords(g, llm, 'ไปทางเหนือ')).toMatchObject({ ok: false });
  });

  it('the switch off: the LLM is not asked, but the name of a hint still works', async () => {
    const g = atCall();
    g.state.settings.llm.setup = false;
    const { llm, provider } = fakeLlm(FX);
    expect(await understandWords(g, llm, 'ไปทางเหนือ')).toMatchObject({ ok: false, line: W.whisper.typed.noFit });
    expect(provider.calls).toHaveLength(0);
    expect(await understandWords(g, llm, 'ระวังนะ')).toMatchObject({ ok: true, hint: 'ระวัง', source: 'template' });
  });
});

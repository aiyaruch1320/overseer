// The offline phrase table of the whisper (docs/systems/god/09-whisper-words.md, data/gen/god.json dreams.whisperWords): typed sentences read with no LLM.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToCall, startLife } from '../../scripts/tools/session';
import { understandWords } from '../../src/app/views/typed';
import type { Game, GameData } from '../../src/core/game';
import { matchTier0, type CommandMenu } from '../../src/core/llm/command';
import { commandMenu } from '../../src/core/llm/menu';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

function atCall(): Game {
  const s = createSession(data, { seed: 7 });
  startLife(s);
  runToCall(s.game);
  return s.game;
}

describe('the phrase table', () => {
  it('every hint has its row, the phrases are unique and none holds the name of another hint', () => {
    const m = commandMenu(atCall().ctx);
    const says = m.says!;
    expect(Object.keys(says).sort()).toEqual(m.hints.map((h) => h.hint).sort());
    const seen = new Map<string, string>();
    for (const [hint, list] of Object.entries(says)) {
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(list.length).toBeLessThanOrEqual(20);
      for (const p of list) {
        expect(seen.get(p), p).toBeUndefined();
        seen.set(p, hint);
        for (const o of m.hints) if (o.hint !== hint) expect(p.includes(o.hint), `${p} holds ${o.hint}`).toBe(false);
      }
    }
  });

  it('reads colloquial sentences with no LLM', async () => {
    const g = atCall();
    const m = commandMenu(g.ctx);
    const cases: [string, string][] = [
      ['อย่าประมาทนะ', 'ระวัง'],
      ['ใจเย็นไว้ก่อน', 'ระวัง'],
      ['ไม่ต้องกลัว ลุยเลย', 'กล้าเถิด'],
      ['อย่าถอยนะ', 'กล้าเถิด'],
      ['ปักหลักอยู่ที่นี่เถอะ', 'จงอยู่'],
      ['อย่าไปไหนเลย', 'จงอยู่'],
      ['หาช่องโหว่ของมันให้เจอ', 'จุดอ่อนของศัตรู'],
      ['ดูท่าทางมันให้ดี', 'จุดอ่อนของศัตรู'],
      ['ปมเก่าในตระกูลยังไม่จบ', 'สางเรื่อง'],
      ['เคลียร์เรื่องเก่าเสียที', 'สางเรื่อง'],
    ];
    for (const [words, hint] of cases) expect(await understandWords(g, undefined, words), words).toMatchObject({ ok: true, hint, source: 'template' });
  });

  it('a phrase of a hint that points needs a place or a person named in the words', async () => {
    const g = atCall();
    const m = commandMenu(g.ctx);
    const person = m.people[0];
    const place = m.places.find((p) => p.id === 'NB')!;
    expect(await understandWords(g, undefined, `เดินทางไป${place.name}เถอะ`)).toMatchObject({ ok: true, hint: 'จงไป', target: 'NB' });
    expect(await understandWords(g, undefined, `อย่าเชื่อ${person.name}`)).toMatchObject({ ok: true, hint: 'คนนั้นโกหก', target: person.id });
    expect(await understandWords(g, undefined, `${person.name}กำลังลำบาก อย่าทิ้ง`)).toMatchObject({ ok: true, hint: 'ช่วย', target: person.id });
    expect(await understandWords(g, undefined, 'เดินทางไปเถอะ')).toMatchObject({ ok: false });
    expect(await understandWords(g, undefined, 'ขอให้รวยล้นฟ้า')).toMatchObject({ ok: false });
  });
});

describe('the phrases the T2 player typed (review/overnight/t2 T2-2)', () => {
  const tried = ['กลับบ้านเถอะ', 'ไปหาครู', 'จงไปหาครู', 'ไปเถอะ', 'กล้าหน่อย', 'ช่วยเขาหน่อย', 'ช่วยเขาด้วย', 'ระวังตัวด้วย'];

  it('none is refused flatly: each is a draft or asks for its target, with the hint picked', async () => {
    const g = atCall();
    for (const words of tried) {
      const r = await understandWords(g, undefined, words);
      if (r.ok) continue;
      expect(r.reason, words).toBe('need_target');
      expect(r.hint, words).toBeTruthy();
    }
    expect(await understandWords(g, undefined, 'กล้าหน่อย')).toMatchObject({ ok: true, hint: 'กล้าเถิด' });
    expect(await understandWords(g, undefined, 'ระวังตัวด้วย')).toMatchObject({ ok: true, hint: 'ระวัง' });
    expect(await understandWords(g, undefined, 'ไปเถอะ')).toMatchObject({ ok: false, reason: 'need_target', hint: 'จงไป', needs: 'place' });
    expect(await understandWords(g, undefined, 'ช่วยเขาด้วย')).toMatchObject({ ok: false, reason: 'need_target', hint: 'ช่วย', needs: 'npc' });
    expect(await understandWords(g, undefined, 'ขอให้รวยล้นฟ้า')).toMatchObject({ ok: false, reason: 'off' });
  });

  it('the home word points at the home country', async () => {
    const g = atCall();
    const m = commandMenu(g.ctx);
    const home = g.state.life!.home;
    expect(m.places.find((p) => p.id === home)?.roles).toEqual(['บ้าน']);
    expect(await understandWords(g, undefined, 'กลับบ้านเถอะ')).toMatchObject({ ok: true, hint: 'จงไป', target: home });
  });

  it('a role word resolves to the person of that role, and the shorter hint wins when the longer has no target', () => {
    const menu: CommandMenu = {
      hints: [{ hint: 'จงไป', needs: 'place' }, { hint: 'ช่วย', needs: 'npc' }, { hint: 'ระวัง' }],
      places: [{ id: 'NB', name: 'เนบูเลีย' }],
      people: [{ id: 'T1', name: 'อารี', roles: ['ครู'] }, { id: 'T2', name: 'บุญ', roles: ['เพื่อน'] }],
      says: { จงไป: ['ไปเถอะ'], ช่วย: ['ไปหา'], ระวัง: ['อย่าประมาท'] },
    };
    expect(matchTier0('ไปหาครู', menu).draft).toEqual({ hint: 'ช่วย', target: 'T1' });
    expect(matchTier0('จงไปหาครู', menu).draft).toEqual({ hint: 'ช่วย', target: 'T1' });
    expect(matchTier0('ช่วยเพื่อนหน่อย', menu).draft).toEqual({ hint: 'ช่วย', target: 'T2' });
    expect(matchTier0('จงไปเนบูเลีย', menu).draft).toEqual({ hint: 'จงไป', target: 'NB' });
    expect(matchTier0('ไปเถอะ', menu)).toEqual({ draft: null, ask: { hint: 'จงไป', needs: 'place' } });
    expect(matchTier0('ช่วยเขาหน่อย', menu)).toEqual({ draft: null, ask: { hint: 'ช่วย', needs: 'npc' } });
    expect(matchTier0('พ่อ', menu)).toEqual({ draft: null });
  });
});

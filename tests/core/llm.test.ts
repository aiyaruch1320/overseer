// The LLM layer, offline (code-plan §11 M4; llm/02-offline.md §6, llm/08-live-test.md): every test runs on the fake provider, which answers from
// tests/fixtures/llm/fake.json. No test builds the real provider on a network; the Anthropic provider is tested with a `fetch` that is a stub.
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/llm/fake.json';
import { badSettings, command } from '../../src/core/command';
import { makeCtx } from '../../src/core/game';
import { load, save } from '../../src/core/save';
import { newGame } from '../../src/core/state';
import type { LifeState } from '../../src/core/types';
import {
  FakeProvider,
  MemoryCache,
  ANTHROPIC_MODEL,
  MODEL,
  MODEL_OF,
  TEMPERATURE,
  anthropicLlm,
  anthropicProvider,
  checkThai,
  deepseekBody,
  deepseekEndpoint,
  deepseekProvider,
  realLlm,
  combineMul,
  configFromEnv,
  directorCount,
  directorDecision,
  directorLine,
  directorMul,
  fakeLlm,
  hashOf,
  interpretWords,
  layered,
  makeLlm,
  matchWords,
  pointOn,
  requestBody,
  summarizeEnding,
  type CommandMenu,
  type DirectorPoint,
  type EndingSummaryInput,
  type Fixtures,
} from '../../src/core/llm';

const FX = fixtures as unknown as Fixtures;

const menu: CommandMenu = {
  hints: [{ hint: 'ระวัง' }, { hint: 'กล้าเถิด' }, { hint: 'จงไป', needs: 'place' }, { hint: 'ช่วย', needs: 'npc' }],
  places: [
    { id: 'NB', name: 'นอร์ธบรันด์' },
    { id: 'AL-01', name: 'ไวลด์มาร์ก' },
  ],
  people: [{ id: 'T12', name: 'เคเรน' }],
};

/** A state with a living character, light enough to need no data. */
function mk() {
  const st = newGame(1);
  st.life = { id: 'L1', name: 'ทอร์เวน', hAge: 30, memory: ['ศิษย์ของครูดาบเคเรน', 'ปฏิเสธความฝันเรื่องทะเลเมื่ออายุสิบห้า'] } as unknown as LifeState;
  return { st, ctx: makeCtx(st, {}) };
}

const point = (id: string, kind: DirectorPoint['kind']): DirectorPoint => ({
  id,
  kind,
  ways: [
    { key: 'a', text: 'ข่าวว่าเคเรนป่วยหนักที่เมืองริมแม่น้ำ' },
    { key: 'b', text: 'พ่อค้าแปลกหน้าชวนไปค้าขายต่างทวีป' },
  ],
});

const summaryInput = (over: Partial<EndingSummaryInput> = {}): EndingSummaryInput => ({
  lifeId: 'L1',
  name: 'ทอร์เวน',
  pronoun: 'เขา',
  race: 'มนุษย์',
  age: 70,
  ending: 'ผู้กลับคืนบ้าน',
  facts: ['เกิดในครอบครัวชาวนาในโซลาริส', 'อายุสิบสี่ น้ำท่วมหมู่บ้าน', 'เป็นศิษย์ของครูดาบเคเรน'],
  template: 'ทอร์เวน มนุษย์ ตายเมื่ออายุเจ็ดสิบ ผู้กลับคืนบ้าน',
  ...over,
});

describe('hash', () => {
  it('is stable across key order and differs for different values', () => {
    expect(hashOf({ a: 1, b: [1, 2] })).toBe(hashOf({ b: [1, 2], a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
    expect(hashOf('x')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('checks of an answer', () => {
  const r = { min: 10, max: 100 };
  it('accepts plain Thai', () => {
    expect(checkThai('เขาเกิดในหมู่บ้านเล็ก ๆ ริมแม่น้ำ', r)).toEqual({ ok: true, value: 'เขาเกิดในหมู่บ้านเล็ก ๆ ริมแม่น้ำ' });
  });
  it('rejects Latin letters, a number the game did not give, an id, and the voice of the god', () => {
    expect(checkThai('เขาไปที่ Solaris เมื่อวาน', r)).toMatchObject({ ok: false, reason: 'latin letters' });
    expect(checkThai('เขาตายเมื่ออายุ 70 ปี ที่บ้าน', r)).toMatchObject({ ok: false });
    expect(checkThai('เขาตายเมื่ออายุ 70 ปี ที่บ้าน', { ...r, allowDigits: '70' }).ok).toBe(true);
    expect(checkThai('ข้าจะพาเขากลับบ้านในวันหนึ่ง', r)).toMatchObject({ ok: false, reason: 'banned word ข้า' });
    expect(checkThai('เราจะพาเขากลับบ้านในวันหนึ่ง', r)).toMatchObject({ ok: false, reason: 'banned word เรา' });
    // words that only contain the letters are fine
    expect(checkThai('เขาเดินข้ามสะพานไปข้างบ้าน แล้วหัวเราะ', r).ok).toBe(true);
  });
  it('rejects text that is too short or far too long, and cuts a little long text at a paragraph', () => {
    expect(checkThai('สั้น', r)).toMatchObject({ ok: false });
    expect(checkThai('ก'.repeat(250), r)).toMatchObject({ ok: false });
    const p = 'เขาเดินไปตามทางเรื่อยมา';
    const two = `${p}${p}\n\n${p}${p}${p}`;
    const cut = checkThai(two, { min: 10, max: 60 });
    expect(cut).toEqual({ ok: true, value: `${p}${p}` });
  });
  it('rejects text that is not mainly Thai', () => {
    expect(checkThai('abc def ghi jkl mno', { ...r, allowLatin: ['abc', 'def', 'ghi', 'jkl', 'mno'] })).toMatchObject({ ok: false, reason: 'not Thai' });
  });
});

describe('switches', () => {
  it('badSettings accepts the llm keys as booleans and refuses the rest', () => {
    expect(badSettings({ llm: { setup: false, director: true, epitaph: false } })).toBeNull();
    expect(badSettings({ llm: { master: false } as never })).toBeNull();
    expect(badSettings({ llm: { dream: true } as never })).toMatch(/สวิตช์ LLM dream/);
    expect(badSettings({ llm: { director: 'yes' } as never })).toMatch(/director/);
  });
  it('a settings command flips a switch and a save keeps it', () => {
    const { st, ctx } = mk();
    expect(command(ctx, { type: 'settings', patch: { llm: { epitaph: false } as never } }).ok).toBe(true);
    expect(st.settings.llm.epitaph).toBe(false);
    expect(load(save(st), {}).state.settings.llm.epitaph).toBe(false);
    expect(command(ctx, { type: 'settings', patch: { llm: { epitaph: 'no' } as never } }).ok).toBe(false);
  });
  it('a point works only when the player and the server both allow it', () => {
    const { st } = mk();
    const { llm } = fakeLlm(FX);
    for (const p of ['command', 'director', 'ending'] as const) expect(pointOn(st, llm.client, p)).toBe(true);
    st.settings.llm.setup = false;
    expect(pointOn(st, llm.client, 'command')).toBe(false);
    expect(pointOn(st, llm.client, 'director')).toBe(true);
    (st.settings.llm as { master?: boolean }).master = false;
    expect(pointOn(st, llm.client, 'director')).toBe(false);
    delete (st.settings.llm as { master?: boolean }).master;
    const off = fakeLlm(FX, { points: { director: false } }).llm;
    expect(pointOn(st, off.client, 'director')).toBe(false);
    expect(pointOn(st, off.client, 'ending')).toBe(true);
    expect(pointOn(st, fakeLlm(FX, { enabled: false }).llm.client, 'ending')).toBe(false);
    expect(pointOn(st, null, 'ending')).toBe(false);
  });
  it('reads the server side from the environment; unset means off', () => {
    expect(configFromEnv({}).enabled).toBe(false);
    expect(configFromEnv({ OVERSEER_LLM: 'off' }).enabled).toBe(false);
    const c = configFromEnv({ OVERSEER_LLM: 'anthropic', OVERSEER_LLM_POINTS_OFF: 'director, ending', OVERSEER_LLM_MODEL: 'claude-x' });
    expect(c).toMatchObject({ enabled: true, points: { command: true, director: false, ending: false }, models: { command: 'claude-x' } });
  });
});

describe('point 1: command the character', () => {
  it('tier 0: the words name a hint, no call', async () => {
    const { ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const out = await llm.interpretWords(ctx, 'อยากให้เขาระวังตัวหน่อย', menu);
    expect(out).toEqual({ command: { type: 'god', action: 'whisper', args: { hint: 'ระวัง' }, confirm: false }, source: 'template' });
    expect(provider.calls).toHaveLength(0);
    expect(matchWords('จงไป ไวลด์มาร์ก', menu)).toEqual({ hint: 'จงไป', target: 'AL-01' });
    expect(matchWords('ช่วยเคเรนด้วย', menu)).toEqual({ hint: 'ช่วย', target: 'T12' });
    // a hint that needs a target and names none is left to the translator
    expect(matchWords('จงไปเถอะ', menu)).toBeNull();
  });

  it('the translator turns free words into a whisper of the menu and the answer is kept in the save', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const out = await llm.interpretWords(ctx, 'อย่าประมาทนะ', menu);
    expect(out).toEqual({ command: { type: 'god', action: 'whisper', args: { hint: 'ระวัง' }, confirm: false }, source: 'llm' });
    expect(provider.calls).toHaveLength(1);
    // the words go to the provider, nothing else of the player; the system text holds no data of the request
    expect(provider.calls[0].user).toContain('อย่าประมาทนะ');
    expect(provider.calls[0].system).not.toContain('อย่าประมาทนะ');
    expect(Object.keys(st.llmAnswers).filter((k) => k.startsWith('command:'))).toHaveLength(1);
    const entry = st.log.find((e) => e.sys === 'llm' && e.kind === 'command')!;
    expect(entry).toMatchObject({ level: 0, id: 'ระวัง', data: { words: 'อย่าประมาทนะ' } });
    expect(String(entry.data.answer)).toContain('ระวัง');
    // the second ask of the same words in the same state needs no provider, even with none given
    const again = await interpretWords(ctx, 'อย่าประมาทนะ', menu, null);
    expect(again.source).toBe('llm');
    expect(again.command?.args).toEqual({ hint: 'ระวัง' });
    expect(provider.calls).toHaveLength(1);
  });

  it('a target is a place or a person of the menu', async () => {
    const { ctx } = mk();
    const { llm } = fakeLlm(FX);
    const out = await llm.interpretWords(ctx, 'ไปทางเหนือ', menu);
    expect(out.command?.args).toEqual({ hint: 'จงไป', target: 'NB' });
  });

  it('"none" and an empty answer give the menu, never a made-up command', async () => {
    const { ctx } = mk();
    const { llm } = fakeLlm(FX);
    expect(await llm.interpretWords(ctx, 'ขอให้รวยล้นฟ้า', menu)).toEqual({ command: null, source: 'llm', reason: 'no_match' });
    const empty = await llm.interpretWords(ctx, 'ตอบว่าง', menu);
    expect(empty).toMatchObject({ command: null, source: 'template' });
    expect(await llm.interpretWords(ctx, '   ', menu)).toMatchObject({ command: null, reason: 'no_words' });
  });

  it('a hint or a target outside the menu is refused: one new request, then the menu', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const bad = await llm.interpretWords(ctx, 'ตอบผิดเสมอ', menu);
    expect(bad).toMatchObject({ command: null, source: 'template' });
    expect(bad.reason).toMatch(/invalid/);
    expect(provider.calls).toHaveLength(2);
    expect(llm.ledger.map((e) => e.result)).toEqual(['invalid', 'invalid']);
    const noTarget = await llm.interpretWords(ctx, 'จงไปไม่บอกที่', menu);
    expect(noTarget).toMatchObject({ command: null, source: 'template' });
    expect(st.log.filter((e) => e.sys === 'llm')).toHaveLength(0);
    expect(Object.keys(st.llmAnswers)).toHaveLength(0);
  });

  it('the first answer is wrong, the second right: the retry is used', async () => {
    const { ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const out = await llm.interpretWords(ctx, 'ตอบผิดก่อน', menu);
    expect(out.command?.args).toEqual({ hint: 'กล้าเถิด' });
    expect(provider.calls).toHaveLength(2);
  });

  it('is off by the switch of the player, the master, the server, or no client: the menu, no call', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    st.settings.llm.setup = false;
    expect(await llm.interpretWords(ctx, 'อย่าประมาทนะ', menu)).toEqual({ command: null, source: 'template', reason: 'off' });
    st.settings.llm.setup = true;
    (st.settings.llm as { master?: boolean }).master = false;
    expect((await llm.interpretWords(ctx, 'อย่าประมาทนะ', menu)).reason).toBe('off');
    delete (st.settings.llm as { master?: boolean }).master;
    expect((await interpretWords(ctx, 'อย่าประมาทนะ', menu, null)).reason).toBe('off');
    expect((await fakeLlm(FX, { enabled: false }).llm.interpretWords(ctx, 'อย่าประมาทนะ', menu)).reason).toBe('off');
    expect(provider.calls).toHaveLength(0);
  });

  it('cuts long words at 300 characters before they are sent', async () => {
    const { ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    await llm.interpretWords(ctx, 'อย่าประมาท' + 'ก'.repeat(500), menu);
    const sent = JSON.parse(provider.calls[0].user).words as string;
    expect(sent.length).toBe(300);
  });

  it('the machine cache stops a second call for the same words in another game', async () => {
    const a = mk();
    const { llm, provider, cache } = fakeLlm(FX);
    await llm.interpretWords(a.ctx, 'อย่าประมาทนะ', menu);
    expect(provider.calls).toHaveLength(1);
    expect(cache.size).toBe(1);
    const b = mk();
    const out = await llm.interpretWords(b.ctx, 'อย่าประมาทนะ', menu);
    expect(out.source).toBe('cache');
    expect(provider.calls).toHaveLength(1);
    expect(llm.ledger.map((e) => e.result)).toEqual(['ok', 'cache']);
  });

  it('works on the real menu of a game and the command it makes passes the game\'s own check', async () => {
    const { createSession, startLife } = await import('../../scripts/tools/session');
    const { loadAll } = await import('../../scripts/tools/node-data');
    const { commandMenu } = await import('../../src/core/llm/menu');
    const s = createSession(loadAll(), { seed: 2, race: 'hu', startYear: 120 });
    startLife(s);
    const ctx = s.game.ctx;
    ctx.state.god.light = 200;
    ctx.state.life!.hAge = 30;
    const m = commandMenu(ctx);
    expect(m.hints.map((h) => h.hint)).toEqual(['ระวัง', 'กล้าเถิด', 'จงไป', 'จงอยู่', 'จุดอ่อนของศัตรู', 'คนนั้นโกหก', 'ช่วย', 'สางเรื่อง', 'ชี้ทายาท']);
    expect(m.hints.find((h) => h.hint === 'จงไป')?.needs).toBe('place');
    expect(m.places.length).toBeGreaterThan(9);
    expect(m.hints.find((h) => h.hint === 'ระวัง')?.needs).toBeUndefined();
    const { llm } = fakeLlm(FX);
    const out = await llm.interpretWords(ctx, 'อย่าประมาทนะ', m);
    expect(out.command).not.toBeNull();
    const r = command(ctx, out.command!);
    expect(r.ok).toBe(true);
    const done = command(ctx, { ...out.command!, confirm: true });
    expect(done.ok).toBe(true);
  });
});

describe('point 2: the director at the key points', () => {
  it('asks ahead, keeps the offer, freezes it at the point, and weighs the chosen way ×1.5', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const p = point('npc_death:T12:30', 'npc_death');
    expect(await llm.requestDirector(ctx, p)).toBe('asked');
    expect(provider.calls).toHaveLength(1);
    expect(JSON.parse(provider.calls[0].user)).toMatchObject({ kind: 'npc_death', memory: ['ศิษย์ของครูดาบเคเรน', 'ปฏิเสธความฝันเรื่องทะเลเมื่ออายุสิบห้า'], ways: [{ key: 'a' }, { key: 'b' }] });
    expect(directorCount(ctx)).toBe(1);
    // nothing is decided until the point comes
    expect(st.llmAnswers['director:L1:npc_death:T12:30']).toBeUndefined();
    expect(directorMul(ctx, p, 'b')).toBe(1.5);
    expect(directorMul(ctx, p, 'a')).toBe(1);
    expect(st.llmAnswers['director:L1:npc_death:T12:30']).toContain('old_face');
    expect(st.log.filter((e) => e.sys === 'llm' && e.kind === 'director')).toHaveLength(1);
    expect(directorLine(ctx, p)).toBe('คนที่เคยพบกลับมาในจังหวะที่ชีวิตนี้ยังจำได้');
    // asking again does nothing
    expect(await llm.requestDirector(ctx, p)).toBe('decided');
    expect(provider.calls).toHaveLength(1);
  });

  it('a save replays the frozen decision with no provider and with the switch off', async () => {
    const { st, ctx } = mk();
    const { llm } = fakeLlm(FX);
    const p = point('npc_death:T12:30', 'npc_death');
    await llm.requestDirector(ctx, p);
    expect(directorMul(ctx, p, 'b')).toBe(1.5);
    const back = load(save(st), {}).state;
    back.settings.llm.director = false;
    const ctx2 = makeCtx(back, {});
    expect(directorMul(ctx2, p, 'b')).toBe(1.5);
    expect(directorMul(ctx2, p, 'a')).toBe(1);
    // a point not yet frozen, with the switch off at the point: the offer is not used
    const q = point('npc_death:K1:31', 'npc_death');
    const on = mk();
    await llm.requestDirector(on.ctx, q);
    on.st.settings.llm.director = false;
    expect(directorMul(on.ctx, q, 'b')).toBe(1);
    on.st.settings.llm.director = true;
    expect(directorMul(on.ctx, q, 'b')).toBe(1); // frozen as none
  });

  it('an answer that comes after the point changes nothing', async () => {
    const { st, ctx } = mk();
    const { llm } = fakeLlm(FX);
    const p = point('repeat_meet:T3:40', 'repeat_meet');
    const asking = llm.requestDirector(ctx, p);
    expect(directorMul(ctx, p, 'a')).toBe(1); // the point comes now: frozen without the answer
    expect(await asking).toBe('decided');
    expect(directorMul(ctx, p, 'a')).toBe(1);
    expect(st.llmAnswers['director.offer:L1:repeat_meet:T3:40']).toBeUndefined();
    expect(st.log.find((e) => e.kind === 'director')?.data.reason).toBe('late');
  });

  it('refuses a way that is not one of the two, and a reason that is not a code', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    expect(await llm.requestDirector(ctx, point('heart:1', 'heart'))).toBe('template');
    expect(provider.calls).toHaveLength(2); // asked, then once again
    expect(Object.keys(st.llmAnswers)).toEqual(['director.asked:L1:heart:1']); // no offer
    expect(directorMul(ctx, point('heart:1', 'heart'), 'a')).toBe(1);
    // a reason outside the codes: refused once, accepted on the second answer
    expect(await llm.requestDirector(ctx, point('quiet:1', 'quiet'))).toBe('asked');
    expect(directorMul(ctx, point('quiet:1', 'quiet'), 'a')).toBe(1.5);
  });

  it('a point with fewer or the same two ways is no point', async () => {
    const { ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const same = { ...point('x', 'quiet'), ways: [{ key: 'a', text: 'ก' }, { key: 'a', text: 'ข' }] } as DirectorPoint;
    expect(await llm.requestDirector(ctx, same)).toBe('bad_point');
    expect(await llm.requestDirector(ctx, { ...point('y', 'quiet'), kind: 'dream' as never })).toBe('bad_point');
    expect(provider.calls).toHaveLength(0);
  });

  it('is off by the switches, leaving no trace, and the rule-based layer keeps the weight', async () => {
    const { st, ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    const p = point('npc_death:T12:30', 'npc_death');
    const before = JSON.stringify(st);
    st.settings.llm.director = false;
    expect(await llm.requestDirector(ctx, p)).toBe('off');
    expect(directorMul(ctx, p, 'b')).toBe(1);
    expect(await requestWith(ctx, p)).toBe('off');
    expect(provider.calls).toHaveLength(0);
    st.settings.llm.director = true;
    expect(directorMul(ctx, p, 'b')).toBe(1); // never asked: nothing is written even with the switch on
    expect(JSON.stringify(st).replace('"director":false', '"director":true')).toBe(before);
  });

  it('asks for no more than ten points a life', async () => {
    const { ctx } = mk();
    const { llm, provider } = fakeLlm(FX);
    for (let i = 0; i < 10; i++) expect(await llm.requestDirector(ctx, point(`npc_death:${i}`, 'npc_death'))).toBe('asked');
    expect(await llm.requestDirector(ctx, point('npc_death:11', 'npc_death'))).toBe('cap');
    expect(provider.calls).toHaveLength(1); // the same input: the other nine came from the cache
    expect(llm.ledger.filter((e) => e.result === 'cache')).toHaveLength(9);
  });

  it('puts the two layers together at ×2.5 at most', () => {
    expect(combineMul(1.75, 1.5)).toBe(2.5);
    expect(combineMul(1.3, 1.5)).toBeCloseTo(1.95);
    expect(combineMul(1.75, 1)).toBe(1.75);
  });
});

/** A request through a client that is not there (the other way to be off). */
const requestWith = async (ctx: ReturnType<typeof mk>['ctx'], p: DirectorPoint) => (await import('../../src/core/llm')).requestDirector(ctx, p, null);

describe('point 3: the end summary', () => {
  it('replaces the template with the retelling when it passes', async () => {
    const { st } = mk();
    const { llm, provider } = fakeLlm(FX);
    const out = await llm.summarizeEnding(summaryInput(), st);
    expect(out.source).toBe('llm');
    expect(out.text).toContain('ทอร์เวนเกิดในครอบครัวชาวนา');
    expect(out.text.split('\n\n')).toHaveLength(3);
    const sent = JSON.parse(provider.calls[0].user);
    expect(sent).toMatchObject({ name: 'ทอร์เวน', pronoun: 'เขา', ending: 'ผู้กลับคืนบ้าน' });
    expect(sent.facts).toHaveLength(3);
    expect(sent.template).toBeUndefined(); // the template is not sent
    expect(st.llmAnswers['ending:L1']).toBe(out.text);
    expect(st.log.find((e) => e.sys === 'llm' && e.kind === 'ending')?.data.text).toBe(out.text);
  });

  it('a save gives the same text with no client', async () => {
    const { st } = mk();
    const { llm } = fakeLlm(FX);
    const first = await llm.summarizeEnding(summaryInput(), st);
    const back = load(save(st), {}).state;
    const again = await summarizeEnding(summaryInput(), null, back);
    expect(again).toEqual(first);
  });

  it('falls back to the template when the answer breaks a rule', async () => {
    const { st } = mk();
    const { llm } = fakeLlm(FX);
    const t = summaryInput().template;
    // Latin letters
    expect(await llm.summarizeEnding(summaryInput({ name: 'เอลิเนีย', lifeId: 'L2' }), st)).toEqual({ text: t, source: 'template' });
    // the voice of the god
    expect(await llm.summarizeEnding(summaryInput({ name: 'โบรก', lifeId: 'L3' }), st)).toEqual({ text: t, source: 'template' });
    // a number the facts did not give
    expect(await llm.summarizeEnding(summaryInput({ name: 'กรุก', lifeId: 'L4' }), st)).toEqual({ text: t, source: 'template' });
    // too short
    expect(await llm.summarizeEnding(summaryInput({ name: 'ไอลีน', lifeId: 'L5' }), st)).toEqual({ text: t, source: 'template' });
    // empty
    expect(await llm.summarizeEnding(summaryInput({ facts: ['ปล่อยว่าง'], lifeId: 'L6' }), st)).toEqual({ text: t, source: 'template' });
    // nothing was kept for any of them
    expect(Object.keys(st.llmAnswers)).toEqual([]);
    expect(llm.ledger.some((e) => e.result === 'invalid')).toBe(true);
    expect(llm.ledger.some((e) => e.result === 'empty')).toBe(true);
  });

  it('a number the facts carry is allowed', async () => {
    const { llm } = fakeLlm({ responses: [{ point: 'ending', answers: ['ทอร์เวนอยู่มาจนถึงอายุ 70 และจากไปอย่างสงบ ท่ามกลางคนที่รักและเคารพเขาเสมอมา'] }] });
    const out = await llm.summarizeEnding(summaryInput({ facts: ['ตายเมื่ออายุ 70'] }));
    expect(out.source).toBe('llm');
  });

  it('a failed call, a refused credit, no client, or a switch off all give the template', async () => {
    const { st } = mk();
    const { llm, provider } = fakeLlm(FX);
    const t = summaryInput().template;
    expect((await llm.summarizeEnding(summaryInput({ facts: ['ล่มเครือข่าย'], lifeId: 'L7' }), st)).source).toBe('template');
    expect((await summarizeEnding(summaryInput(), null)).source).toBe('template');
    st.settings.llm.epitaph = false;
    const calls = provider.calls.length;
    expect(await llm.summarizeEnding(summaryInput(), st)).toEqual({ text: t, source: 'template' });
    expect(provider.calls).toHaveLength(calls);
    st.settings.llm.epitaph = true;
    // without a state only the server side counts
    expect((await llm.summarizeEnding(summaryInput({ lifeId: 'L9' }))).source).toBe('llm');
    expect((await fakeLlm(FX, { points: { ending: false } }).llm.summarizeEnding(summaryInput())).source).toBe('template');
  });

  it('a second summary of the same life from the machine cache costs no call', async () => {
    const { llm, provider } = fakeLlm(FX);
    const a = await llm.summarizeEnding(summaryInput());
    const b = await llm.summarizeEnding(summaryInput());
    expect(b).toEqual(a);
    expect(provider.calls).toHaveLength(1);
    expect(llm.ledger.map((e) => e.result)).toEqual(['ok', 'cache']);
  });
});

describe('failures never reach the player', () => {
  it('a timeout is dropped and the template is used', async () => {
    const { ctx } = mk();
    const { llm } = fakeLlm(FX, { timeoutMs: 30 });
    const out = await llm.interpretWords(ctx, 'ตอบช้า', menu);
    expect(out).toMatchObject({ command: null, source: 'template', reason: 'timeout' });
    expect(llm.ledger[0].result).toBe('timeout');
  });

  it('three failures in a row stop the calls for ten minutes, then one trial', async () => {
    let t = 1000;
    const { llm, provider } = fakeLlm(FX, { now: () => t, breaker: { fails: 3, pauseMs: 600_000 } });
    const down = () => llm.summarizeEnding(summaryInput({ facts: ['ล่มเครือข่าย'] }));
    for (let i = 0; i < 3; i++) expect((await down()).source).toBe('template');
    expect(provider.calls).toHaveLength(3);
    expect(llm.client.available('ending')).toBe(false);
    expect((await llm.summarizeEnding(summaryInput())).source).toBe('template');
    expect(provider.calls).toHaveLength(3); // no call while the breaker is open
    t += 600_001;
    expect(llm.client.available('ending')).toBe(true);
    expect((await llm.summarizeEnding(summaryInput())).source).toBe('llm'); // the trial passes and the breaker closes
    expect(provider.calls).toHaveLength(4);
    expect(llm.client.available('ending')).toBe(true);
  });

  it('a trial that fails opens the breaker again at once', async () => {
    let t = 0;
    const { llm, provider } = fakeLlm(FX, { now: () => t, breaker: { fails: 2, pauseMs: 1000 } });
    const down = () => llm.summarizeEnding(summaryInput({ facts: ['ล่มเครือข่าย'] }));
    await down();
    await down();
    t = 1001;
    await down();
    expect(provider.calls).toHaveLength(3);
    expect(llm.client.available('ending')).toBe(false);
  });

  it('a refusal for credit switches the layer off for the session', async () => {
    const { llm, provider } = fakeLlm(FX);
    await llm.summarizeEnding(summaryInput({ facts: ['เครดิตหมด'] }));
    expect(llm.client.available('command')).toBe(false);
    await llm.summarizeEnding(summaryInput());
    expect(provider.calls).toHaveLength(1);
  });

  it('the soft budget of a life sends the later calls to tier 0', async () => {
    const { llm, provider } = fakeLlm(FX, { lifeTokenBudget: 1 });
    expect((await llm.summarizeEnding(summaryInput())).source).toBe('llm');
    expect((await llm.summarizeEnding(summaryInput({ facts: ['อีกเรื่อง'] }))).source).toBe('template');
    expect(provider.calls).toHaveLength(1);
    // another life has its own budget
    expect((await llm.summarizeEnding(summaryInput({ lifeId: 'L2' }))).source).toBe('llm');
  });

  it('two asks of the same input at once make one request', async () => {
    const { llm, provider } = fakeLlm(FX);
    const [a, b] = await Promise.all([llm.summarizeEnding(summaryInput()), llm.summarizeEnding(summaryInput())]);
    expect(a).toEqual(b);
    expect(provider.calls).toHaveLength(1);
  });

  it('the ledger logs the tokens of every request, and the totals add up', async () => {
    const { llm } = fakeLlm(FX);
    await llm.summarizeEnding(summaryInput());
    await llm.summarizeEnding(summaryInput({ name: 'เอลิเนีย', lifeId: 'L2' }));
    const [ok, bad, bad2] = llm.ledger;
    expect(ok).toMatchObject({ point: 'ending', life: 'L1', result: 'ok', provider: 'fake', model: 'deepseek-flash', attempt: 1 });
    expect(ok.usage.input).toBeGreaterThan(0);
    expect(ok.usage.output).toBeGreaterThan(0);
    expect(bad.result).toBe('invalid');
    expect(bad2.attempt).toBe(2);
    expect(llm.client.totals().ending).toMatchObject({ requests: 3, failed: 2, cached: 0 });
    expect(llm.client.spent('L1')).toBe(ok.usage.input + ok.usage.output);
  });

  it('a cached answer that no longer passes the check is not used', async () => {
    const cache = new MemoryCache();
    const provider = new FakeProvider(FX);
    const llm = makeLlm({ config: { enabled: true }, provider, cache });
    const i = summaryInput();
    const key = llm.client.keyOf({ point: 'ending', input: { name: i.name, pronoun: i.pronoun, race: i.race, age: i.age, ending: i.ending, facts: i.facts } });
    cache.set(key, { text: 'ข้าคือผู้ตัดสินชีวิตของเขา', point: 'ending', model: 'x' });
    const out = await llm.summarizeEnding(i);
    expect(out.source).toBe('llm');
    expect(provider.calls).toHaveLength(1);
    expect(cache.get(key)!.text).toContain('ทอร์เวน');
  });

  it('layered caches copy a hit to the stores before it', () => {
    const mine = new MemoryCache();
    const shared = new MemoryCache({ k: { text: 't', point: 'ending', model: 'm' } });
    const both = layered(mine, shared);
    expect(both.get('k')?.text).toBe('t');
    expect(mine.get('k')?.text).toBe('t');
    both.set('j', { text: 'u', point: 'ending', model: 'm' });
    expect(shared.get('j')?.text).toBe('u');
  });
});

describe('a game with the layer off plays exactly as before', () => {
  it('a whole life is the same with the three points asked and every switch off or no client', async () => {
    const { createSession, startLife, runToDeath } = await import('../../scripts/tools/session');
    const { loadAll } = await import('../../scripts/tools/node-data');
    const data = loadAll();
    const life = async (withLayer: boolean) => {
      const s = createSession(data, { seed: 4 });
      startLife(s);
      const st = s.game.state;
      const { llm, provider } = fakeLlm(FX);
      if (withLayer) {
        st.settings.llm = { setup: false, director: false, epitaph: false };
        (st.settings.llm as { master?: boolean }).master = false;
      }
      const after = () => {
        if (!withLayer) return;
        void llm.requestDirector(s.game.ctx, point(`quiet:${st.life!.hAge}`, 'quiet'));
        void llm.interpretWords(s.game.ctx, 'อย่าประมาทนะ', menu);
        directorMul(s.game.ctx, point(`quiet:${st.life!.hAge}`, 'quiet'), 'a');
      };
      runToDeath(s.game, undefined, after);
      if (withLayer) {
        const sum = await llm.summarizeEnding(summaryInput({ lifeId: st.life!.id }), st);
        expect(sum.source).toBe('template');
        expect(provider.calls).toHaveLength(0);
        st.settings.llm = { setup: true, director: true, epitaph: true };
      }
      return JSON.stringify(st);
    };
    const plain = await life(false);
    const guarded = await life(true);
    expect(guarded).toBe(plain);
    expect(JSON.parse(plain).llmAnswers).toEqual({});
  }, 120_000);
});

describe('the Anthropic provider (a stub fetch; no network)', () => {
  const ok = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
  const req = { point: 'ending' as const, model: 'claude-sonnet-5-5', system: 'S', user: 'U', maxTokens: 50, temperature: 0.7 };

  it('builds the request: key in a header, system marked for the prefix cache, a schema as a forced tool', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const p = anthropicProvider({
      apiKey: 'sk-test',
      fetch: (async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return ok({ content: [{ type: 'text', text: 'สวัสดี' }], usage: { input_tokens: 10, output_tokens: 3, cache_read_input_tokens: 7, cache_creation_input_tokens: 2 }, model: 'claude-sonnet-5-5' });
      }) as unknown as typeof fetch,
    });
    const r = await p.complete(req);
    expect(r).toEqual({ text: 'สวัสดี', model: 'claude-sonnet-5-5', usage: { input: 10, output: 3, cacheRead: 7, cacheWrite: 2 } });
    expect(seen[0].url).toBe('https://api.anthropic.com/v1/messages');
    const h = seen[0].init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-test');
    expect(h['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(seen[0].init.body as string);
    expect(body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 50, system: [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: 'U' }] });
    expect(body.tools).toBeUndefined();
    const schema = { type: 'object', properties: { x: { type: 'string', enum: ['a'] } } };
    expect(requestBody({ ...req, schema })).toMatchObject({ tools: [{ name: 'answer', input_schema: schema }], tool_choice: { type: 'tool', name: 'answer' } });
  });

  it('returns the input of the tool as the answer text', async () => {
    const p = anthropicProvider({ apiKey: 'k', fetch: (async () => ok({ content: [{ type: 'tool_use', name: 'answer', input: { pick: 'a' } }], usage: {} })) as unknown as typeof fetch });
    expect(JSON.parse((await p.complete({ ...req, schema: {} })).text)).toEqual({ pick: 'a' });
  });

  it('reads the key from the environment object it is given, and refuses to call without one', async () => {
    let called = 0;
    const f = (async () => {
      called++;
      return ok({ content: [{ type: 'text', text: 'x' }], usage: {} });
    }) as unknown as typeof fetch;
    await expect(anthropicProvider({ env: {}, fetch: f }).complete(req)).rejects.toMatchObject({ kind: 'bad_request' });
    expect(called).toBe(0);
    await anthropicProvider({ env: { ANTHROPIC_API_KEY: 'sk-env' }, fetch: f }).complete(req);
    expect(called).toBe(1);
  });

  it('maps the failures the docs name', async () => {
    const fail = (status: number, message: string, headers: Record<string, string> = {}) =>
      anthropicProvider({ apiKey: 'k', fetch: (async () => new Response(JSON.stringify({ error: { message } }), { status, headers })) as unknown as typeof fetch }).complete(req);
    await expect(fail(429, 'slow down', { 'retry-after': '7' })).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 7000 });
    await expect(fail(400, 'Your credit balance is too low')).rejects.toMatchObject({ kind: 'credit' });
    await expect(fail(500, 'boom')).rejects.toMatchObject({ kind: 'server' });
    await expect(fail(529, 'overloaded')).rejects.toMatchObject({ kind: 'server' });
    await expect(fail(400, 'bad')).rejects.toMatchObject({ kind: 'bad_request' });
    const net = anthropicProvider({ apiKey: 'k', fetch: (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch });
    await expect(net.complete(req)).rejects.toMatchObject({ kind: 'network' });
  });

  it('works under the client: a failure becomes the template and a good answer passes the check', async () => {
    const llm = makeLlm({
      config: { enabled: true },
      provider: anthropicProvider({ apiKey: 'k', fetch: (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch }),
    });
    expect((await llm.summarizeEnding(summaryInput())).source).toBe('template');
    expect(llm.ledger[0].result).toBe('server');
  });
});

describe('the DeepSeek provider (a stub fetch; no network)', () => {
  const ok = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
  const req = { point: 'ending' as const, model: 'deepseek-flash', system: 'S', user: 'U', maxTokens: 50, temperature: 1.3 };
  const usage = { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 60, prompt_cache_miss_tokens: 40 };

  it('is the model and the temperatures the docs name', () => {
    expect(MODEL).toBe('deepseek-flash');
    expect(Object.values(MODEL_OF)).toEqual(['deepseek-flash', 'deepseek-flash', 'deepseek-flash']);
    expect(TEMPERATURE).toEqual({ command: 0.3, director: 0.3, ending: 1.3 });
  });

  it('builds the request: thinking off, the fixed part first, no user_id, a key in the bearer header, the plain endpoint for prose', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const p = deepseekProvider({
      apiKey: 'sk-test',
      fetch: (async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return ok({ choices: [{ message: { content: 'สวัสดี' } }], usage, model: 'deepseek-flash' });
      }) as unknown as typeof fetch,
    });
    const r = await p.complete(req);
    expect(r).toEqual({ text: 'สวัสดี', model: 'deepseek-flash', usage: { input: 100, output: 20, cacheRead: 60, cacheWrite: 40 } });
    expect(seen[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect((seen[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    const body = JSON.parse(seen[0].init.body as string);
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 50, temperature: 1.3, stream: false, thinking: { type: 'disabled' }, messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] });
    expect(body.user_id).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(body.response_format).toBeUndefined();
  });

  it('a schema is a strict tool call at /beta and the arguments are the answer; json mode asks response_format', async () => {
    const schema = { type: 'object', properties: { pick: { type: 'string', enum: ['a', 'b'] } }, required: ['pick'], additionalProperties: false };
    const body = deepseekBody({ ...req, temperature: 0.3, schema });
    expect(body).toMatchObject({ tools: [{ type: 'function', function: { name: 'answer', strict: true, parameters: schema } }], tool_choice: { type: 'function', function: { name: 'answer' } } });
    expect(deepseekBody({ ...req, jsonMode: true })).toMatchObject({ response_format: { type: 'json_object' } });
    expect(deepseekEndpoint('https://api.deepseek.com/', { schema })).toBe('https://api.deepseek.com/beta/chat/completions');
    let url = '';
    const p = deepseekProvider({
      apiKey: 'k',
      fetch: (async (u: string) => {
        url = u;
        return ok({ choices: [{ message: { content: null, tool_calls: [{ function: { name: 'answer', arguments: '{"pick":"a"}' } }] } }], usage: {} });
      }) as unknown as typeof fetch,
    });
    expect(JSON.parse((await p.complete({ ...req, schema })).text)).toEqual({ pick: 'a' });
    expect(url).toBe('https://api.deepseek.com/beta/chat/completions');
  });

  it('reads the key and the base URL from the environment object it is given, and refuses to call without a key', async () => {
    const urls: string[] = [];
    const f = (async (u: string) => {
      urls.push(u);
      return ok({ choices: [{ message: { content: 'x' } }], usage: {} });
    }) as unknown as typeof fetch;
    await expect(deepseekProvider({ env: {}, fetch: f }).complete(req)).rejects.toMatchObject({ kind: 'bad_request' });
    expect(urls).toHaveLength(0);
    await deepseekProvider({ env: { DEEPSEEK_API_KEY: 'sk-env', DEEPSEEK_BASE_URL: 'http://local.test' }, fetch: f }).complete(req);
    expect(urls).toEqual(['http://local.test/chat/completions']);
  });

  it('maps the failures of the API', async () => {
    const fail = (status: number, message: string, headers: Record<string, string> = {}) =>
      deepseekProvider({ apiKey: 'k', fetch: (async () => new Response(JSON.stringify({ error: { message } }), { status, headers })) as unknown as typeof fetch }).complete(req);
    await expect(fail(429, 'slow down', { 'retry-after': '3' })).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 3000 });
    await expect(fail(402, 'Insufficient Balance')).rejects.toMatchObject({ kind: 'credit' });
    await expect(fail(500, 'boom')).rejects.toMatchObject({ kind: 'server' });
    await expect(fail(503, 'busy')).rejects.toMatchObject({ kind: 'server' });
    await expect(fail(401, 'Authentication Fails')).rejects.toMatchObject({ kind: 'bad_request' });
    await expect(fail(422, 'Invalid Parameters')).rejects.toMatchObject({ kind: 'bad_request' });
    const net = deepseekProvider({ apiKey: 'k', fetch: (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch });
    await expect(net.complete(req)).rejects.toMatchObject({ kind: 'network' });
  });

  it('realLlm builds on DeepSeek by default; the alternative asks for a Claude model; the client sends the model and the temperature of the point', async () => {
    const real = realLlm({ DEEPSEEK_API_KEY: 'k' });
    expect(real.client.provider.name).toBe('deepseek');
    expect(real.client.config.models).toBeUndefined();
    const alt = anthropicLlm({ ANTHROPIC_API_KEY: 'k' });
    expect(alt.client.provider.name).toBe('anthropic');
    expect(alt.client.config.models?.ending).toBe(ANTHROPIC_MODEL);
    const { llm, provider } = fakeLlm(FX);
    await llm.summarizeEnding(summaryInput());
    expect(provider.calls[0]).toMatchObject({ model: 'deepseek-flash', temperature: 1.3 });
  });
});

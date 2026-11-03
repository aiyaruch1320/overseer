// M5 ui: the view models of the start screen and the ending screens (src/app/views/start.ts and end.ts). Pure over (data, state); the components only draw them.
import { beforeAll, describe, expect, it } from 'vitest';
import { GameStore } from '../../src/app/store';
import { cardView, collectionPage, deathOf, goOn, heirChoice, legendView, worldPage, worldEnded, END_LABELS } from '../../src/app/views/end';
import { certificate, emptyDraft, launch, normalize, readWish, scratchLife, sessionOpts, startModes, START_LABELS, vowChoiceView, vowLineOf } from '../../src/app/views/start';
import { reoffer } from '../../src/core/god/goals';
import { command } from '../../src/core/command';
import { endingInput } from '../../src/core/ending';
import { summaryInputOf } from '../../scripts/tools/llm';
import type { GameData } from '../../src/core/game';
import { nextLife } from '../../src/core/lineage';
import { peekLife } from '../../src/core/god/goals';
import type { Command } from '../../src/core/types';
import { loadAll } from '../../scripts/tools/node-data';
import { createSession, runToDeath, startLife } from '../../scripts/tools/session';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const read = (text: string, mode: string | null = null, picks: Record<string, string> = {}) => readWish(data, { text, mode, picks });
const names = (r: ReturnType<typeof read>, row: string) => r.items.filter((i) => i.row === row).map((i) => i.value).filter(Boolean);

describe('synonym parser', () => {
  it('reads Thai digits as Arabic and drops spaces and marks but keeps the marks of Thai letters', () => {
    expect(normalize('ชนชั้น ๔!').norm).toBe('ชนชั้น4');
    expect(normalize('Dark-Elf').norm).toBe('darkelf');
  });

  it('the longer word wins: ดาร์กเอลฟ์ is one race, not ดาร์ก and เอลฟ์', () => {
    const r = read('ดาร์กเอลฟ์');
    expect(r.ask.race).toBe('darkelf');
    expect(names(r, 'sure')).toEqual(['ดาร์กเอลฟ์']);
  });

  it('a negation takes the next value out of the draw and the sheet shows it struck out', () => {
    const r = read('ขอเป็นแวมไพร์ ไม่เอาคนจน');
    expect(r.ask.race).toBe('vampire');
    const cut = r.items.find((i) => i.negated);
    expect(cut?.value).toBe('ชนชั้นล่าง');
    expect(cut?.row).toBe('cannot');
    expect(r.segments.some((s) => s.kind === 'neg')).toBe(true);
    expect(r.segments.find((s) => s.negated)?.text).toBe('คนจน');
  });

  it('prices the request in fate points: a rare race and a rich class cost, an orphan gives points back; the ten points are a limit', () => {
    const a = read('แวมไพร์ รวยมาก');
    expect(a.points.used).toBe(6); // vampire 2 + class 5 (nobility 4): "มาก" moves the rich class one step to the end
    const b = read('กำพร้า');
    expect(b.points.used).toBe(-2);
    expect(b.points.left).toBe(12);
    expect(b.points.beads.filter((x) => x === 'refund')).toHaveLength(2);
    // the asks come in order of typing; the one that no longer fits is cut with the over-budget rule
    const c = read('เผ่ามังกร แวมไพร์ ผู้ถูกอัญเชิญ');
    expect(c.points.used).toBeLessThanOrEqual(10);
  });

  it('keeps the first of a field with one value and cuts the second', () => {
    const r = read('คนแคระ ชาย หญิง');
    expect(r.ask.gender).toBe('m');
    expect(r.items.some((i) => i.row === 'cannot' && i.value === 'หญิง')).toBe(true);
  });

  it('limits the traits to three and the aptitudes to two, in the order typed', () => {
    const r = read('ขี้ขลาด ใจบุญ กล้าบ้าบิ่น ซื่อสัตย์');
    const lean = r.items.filter((i) => i.key === 'trait' && i.row === 'lean');
    expect(lean.length).toBeLessThanOrEqual(3);
    expect(r.items.filter((i) => i.key === 'trait' && i.row === 'cannot').length).toBe(4 - lean.length);
  });

  it('impossible asks and asks outside the form go to the row of what cannot be done, with the reason of the table', () => {
    const r = read('อยากเป็นอมตะ ตั้งชื่อว่าสมชาย');
    const bad = r.items.filter((i) => i.row === 'cannot');
    expect(bad.map((i) => i.value)).toEqual(expect.arrayContaining(['อมตะ', 'ชื่อ']));
    expect(bad.every((i) => i.note.length > 0)).toBe(true);
  });

  it('half-blood: two races and the word make the pair, one race and the word draw the second from the table', () => {
    expect(read('ฮาล์ฟเอลฟ์').ask).toMatchObject({ race: 'elf', second: 'human' });
    expect(read('มนุษย์ ลูกครึ่งเอลฟ์').ask.second).toBeDefined();
  });

  it('a random word alone is understood in full and leaves every field random', () => {
    const r = read('อะไรก็ได้');
    expect(r.understood).toBe('full');
    expect(r.ask).toEqual({});
    expect(r.items.every((i) => i.row === 'random')).toBe(true);
  });

  it('a text it cannot read opens the page of choosing by hand, with no error; picks by hand stand over what was read', () => {
    const r = read('กกกกก ขขขขข ฟฟฟฟฟ');
    expect(r.understood).toBe('none');
    expect(r.byHand).toBe(true);
    const h = read('กกกกก', null, { race: 'dwarf', gender: 'ชาย' });
    expect(h.ask).toMatchObject({ race: 'dwarf', gender: 'm' });
  });

  it('the verdict is full only when no run of three unknown letters is left', () => {
    expect(read('คนแคระ').understood).toBe('full');
    expect(read('คนแคระ ขขขขขขขขขขขขขขขขขขขขขข').understood).toBe('part');
    expect(read('').understood).toBe('empty');
  });

  it('marks as pending only what no system binds yet: the asks of the story part that the vows of the god will read', () => {
    const r = read('ขี้ขลาด รวย');
    expect(r.items.filter((i) => i.row !== 'random').every((i) => !i.pending)).toBe(true);
    expect(read('คนแคระ').items.find((i) => i.key === 'race')?.pending).toBe(false);
    expect(read('อยากมีความรัก').items.find((i) => i.key === 'story')?.pending).toBe(true);
    expect(read('อยากเดินทาง').items.find((i) => i.key === 'story')?.pending).toBe(false);
  });
});

describe('start modes', () => {
  it('a world not begun opens the modes of the start and keeps the heir and the unlocked-by-life ones shut', () => {
    const modes = startModes(data, null, 'slime');
    expect(modes).toHaveLength(12);
    expect(modes.find((m) => m.id === 'summoned')?.open).toBe(true);
    expect(modes.find((m) => m.id === 'heir')?.open).toBe(false);
    expect(modes.find((m) => m.id === 'reincarnated')?.open).toBe(false);
    expect(modes.find((m) => m.id === 'slime')?.chosen).toBe(true);
  });

  it('after a life the modes of the lineage open', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    runToDeath(s.game);
    const modes = startModes(data, s.game.state, null);
    expect(modes.find((m) => m.id === 'heir')?.open).toBe(true);
    expect(modes.find((m) => m.id === 'reincarnated')?.open).toBe(true);
  });

  it('a mode asks the birth for its race', () => {
    const r = read('', 'dragonkin');
    expect(r.ask.race).toBe('dragonkin');
    expect(r.understood).toBe('full');
  });
});

describe('sheet of birth', () => {
  it('moves what the birth refused to the row of what cannot be done, with its reason', () => {
    const c = certificate(data, { ...emptyDraft(5), text: 'ผู้ถูกอัญเชิญ กำพร้า' });
    const fam = c.items.find((i) => i.key === 'family');
    expect(fam?.row).toBe('cannot');
    expect(fam?.note.length).toBeGreaterThan(0);
    expect(c.modeHeld).toBe(true);
    expect(c.born.mode).toBe('summoned');
  });

  it('shows the life that the request makes: the race and the gender asked for are born', () => {
    const d = { ...emptyDraft(5), text: 'คนแคระ ชาย' };
    const c = certificate(data, d);
    expect(c.born.race).toBe('dwarf');
    expect(c.born.gender).toBe('m');
    expect(c.story.length).toBeGreaterThan(0);
    expect(c.items.find((i) => i.key === 'race')?.row).toBe('sure');
  });

  it('offers three vows and the fallen one, with the condition and the reward the data gives', () => {
    const c = certificate(data, { ...emptyDraft(5), text: 'คนแคระ' });
    expect(c.vows).toHaveLength(4);
    expect(c.vows[3].name).toBe(START_LABELS.noVow);
    expect(c.vows.slice(0, 3).every((v) => v.name && v.done && v.reward)).toBe(true);
  });

  it('only the natural rhythm is open in a new lineage', () => {
    const c = certificate(data, emptyDraft(5));
    expect(c.rhythms.filter((r) => r.open).map((r) => r.id)).toEqual(['natural']);
  });

  it('the life the sheet shows is the life the bridge bears (same seed, same options)', () => {
    const d = { ...emptyDraft(7), text: 'ชาย คนแคระ' };
    const r = readWish(data, d);
    const c = certificate(data, d, r);
    const store = new GameStore();
    store.setData(data);
    const res = launch(store, r, d);
    expect(res.ok).toBe(true);
    expect(store.state?.life?.name).toBe(c.born.name);
    expect(store.phase.value).toBe('watch');
  });

  it('launching confirms the vow and the rhythm before the first beat', () => {
    const d = { ...emptyDraft(5), text: 'คนแคระ', vow: 2 };
    const r = readWish(data, d);
    const store = new GameStore();
    store.setData(data);
    expect(launch(store, r, d).ok).toBe(true);
    const life = store.state!.life!;
    expect(peekLife(life).decided).toBe(true);
    expect(peekLife(life).vow).toBe(peekLife(life).offers[1]);
    expect(store.state!.life!.hAge).toBe(0);
  });

  it('a rhythm that is not open is refused by the core, and the launch says so', () => {
    const d = { ...emptyDraft(5), rhythm: 'sorrow' };
    const store = new GameStore();
    store.setData(data);
    const res = launch(store, readWish(data, d), d);
    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
  });

  it('builds the options of the bridge: the sheet of the wish goes to the birth of the core, no birther of the view', () => {
    expect(sessionOpts(read(''), 3).wish).toBeUndefined();
    expect(sessionOpts(read('คนแคระ'), 3).birther).toBeUndefined();
    expect(sessionOpts(read('คนแคระ ชาย'), 3).wish?.ask).toMatchObject({ race: 'dwarf', gender: 'm' });
    const a = scratchLife(data, sessionOpts(read('คนแคระ ชาย'), 3), 'k1');
    expect(a.life.gender).toBe('m');
  });
});

describe('ending screens', () => {
  const lived = (seed: number, vow?: number) => {
    const s = createSession(data, { seed });
    startLife(s);
    if (vow) command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args: { pick: vow }, confirm: true });
    runToDeath(s.game);
    return s;
  };

  it('the death scene and the card tell the death and every section of the record', () => {
    const s = lived(5, 1);
    const d = deathOf(s.game.state)!;
    expect(d.sentence).toContain('ตาย');
    const c = cardView(data, s.game.state)!;
    expect(c.sections.map((x) => x.id)).toEqual(['question', 'moments', 'people', 'traces', 'hand']);
    expect(c.sections.find((x) => x.id === 'moments')!.lines).toHaveLength(3);
    expect(c.vow?.head).toBeTruthy();
    expect(c.epitaph.text).toBeTruthy();
    expect(c.earned.length).toBeGreaterThan(0);
    expect(c.sections.find((x) => x.id === 'hand')!.lines[0]).toContain('พระหัตถ์');
  });

  it('a life with no vow has no vow page', () => {
    expect(cardView(data, lived(6).game.state)!.vow).toBeNull();
  });

  it('the heirs are the children with their traits; the eldest is the default; the player picks one and the next life is that child', () => {
    const s = lived(5);
    const h = heirChoice(data, s.game.ctx);
    expect(h.extinct).toBe(false);
    expect(h.candidates.length).toBeGreaterThan(1);
    expect(h.candidates.filter((c) => c.chosen)).toHaveLength(1);
    expect(h.candidates[0].traits.length).toBeGreaterThan(0);
    const store = new GameStore();
    store.setData(data);
    store.newLife({ seed: 5 });
    runToDeath(store.game!);
    const second = h.candidates[1];
    const r = goOn(store, { tie: second.tie });
    expect(r?.ok).toBe(true);
    expect(store.state!.life!.name).toBe(second.name);
    expect(store.phase.value).toBe('watch');
  });

  it('a family with no heir is extinct and may ask for a newcomer', () => {
    const s = lived(1);
    const h = heirChoice(data, s.game.ctx);
    expect(h.extinct).toBe(true);
    expect(h.candidates).toHaveLength(0);
    const r = nextLife(s.game, {});
    expect(r.ok).toBe(false);
    const store = new GameStore();
    store.setData(data);
    store.newLife({ seed: 1 });
    runToDeath(store.game!);
    expect(goOn(store, { newcomer: true })?.ok).toBe(true);
  });

  it('the legend page lists the lives with the chronicle and what each threshold opened', () => {
    const s = lived(5);
    nextLife(s.game, { newcomer: true });
    runToDeath(s.game);
    const v = legendView(data, s.game.state);
    expect(v.lives).toHaveLength(2);
    expect(v.lives.every((l) => l.card && l.line)).toBe(true);
    expect(v.chronicle.fruits.length).toBe(6);
    expect(v.chronicle.fruits[0].opens).not.toContain('](');
    expect(v.chronicle.lines).toHaveLength(2);
  });

  it('the collection page counts the entries found and draws the rest as shadows without names', () => {
    const s = lived(5);
    const p = collectionPage(data, s.game.state);
    expect(p.have).toBeGreaterThan(0);
    expect(p.have).toBeLessThan(p.total);
    const nodes = p.categories.find((c) => c.id === 'node')!;
    expect(nodes.have + nodes.shadows).toBeLessThanOrEqual(nodes.total);
    expect(nodes.shadows).toBeGreaterThan(0);
    expect(p.categories.find((c) => c.id === 'conjure')!.unlimited).toBe(true);
    expect(p.modes.filter((m) => m.used).length).toBeGreaterThan(0);
  });

  it('the summary of the world has a section for each row of the doc and the legend of the world', () => {
    const s = lived(5);
    const w = worldPage(data, s.game.state);
    expect(w.sections.map((x) => x.id)).toEqual(['head', 'time', 'dragons', 'countries', 'keys', 'events', 'you', 'hand']);
    expect(w.sections.every((x) => x.lines.length > 0)).toBe(true);
    expect(w.legend.text.length).toBeGreaterThan(20);
    expect(w.ended).toBe(false);
    expect(END_LABELS.world).toBe('หน้าสรุปโลก');
  });
});

describe('the ending card of an ordered life', () => {
  const ordered = () => {
    const r = read('อยากเป็นดาร์กเอลฟ์ ชาย ขี้ขลาด ผู้กล้า อมตะ รวยมาก ดาบ');
    const s = createSession(data, { seed: 5, race: r.ask.race, wish: r.sheet });
    startLife(s);
    runToDeath(s.game);
    return s;
  };

  it('shows "ถูกสั่ง", what the birth gave (sure, then a tendency) and what it could not, with the reason', () => {
    const s = ordered();
    const v = cardView(data, s.game.state)!;
    expect(v.wish?.mark).toBe('ถูกสั่ง');
    expect(v.wish?.text).toContain('ดาร์กเอลฟ์');
    expect(v.wish?.sure).toEqual(expect.arrayContaining(['เผ่า: ดาร์กเอลฟ์', 'เพศ: ชาย']));
    expect(v.wish?.lean).toEqual(expect.arrayContaining(['นิสัย: ขี้ขลาด', 'ความถนัด: ดาบ']));
    const cut = v.wish?.refused.find((r) => r.text.includes('อมตะ'));
    expect(cut?.reason).toMatch(/เอลฟ์/);
  });

  it('a life nobody ordered has no mark; the saved card and the input of the llm layer carry the wish only for the ordered one', () => {
    const plain = createSession(data, { seed: 5 });
    startLife(plain);
    runToDeath(plain.game);
    expect(cardView(data, plain.game.state)!.wish).toBeNull();
    expect(endingInput(plain.game.state)!.wish).toBeUndefined();
    const s = ordered();
    const input = endingInput(s.game.state)!;
    expect(input.wish?.granted.map((g) => g.value)).toContain('ดาร์กเอลฟ์');
    expect(JSON.parse(JSON.stringify(input.wish))).toEqual(input.wish);
    // the llm layer is told the life was asked for, and what it was given
    expect(summaryInputOf(data, s.game.state)?.wish).toMatch(/ดาร์กเอลฟ์.*ไม่ได้: อมตะ/);
    expect(summaryInputOf(data, plain.game.state)?.wish).toBeUndefined();
  });
});

describe('M5 fix S5 S7 M1 M4: the start sheet, the vows, the words and the pages', () => {
  const sheetOf = (text: string, mode: string | null = null) => {
    const d = { ...emptyDraft(7), text, mode };
    return certificate(data, d, readWish(data, d));
  };
  const dev = /[A-Za-z]{3,}|\]\(|\.md|แถว/;

  it('the blurb tells only what the granted rows say, and the reasons are in player words', () => {
    const c = sheetOf('ไม่เอาคนจน อยากเป็นแวมไพร์ ชอบผจญภัย');
    const granted = c.items.filter((i) => i.row === 'sure' || i.row === 'lean').map((i) => i.value);
    expect(c.story[0]).toContain('แวมไพร์');
    expect(c.story.join(' ')).not.toMatch(/ครอบครัว|ฐานะ|ดวง|ชนชั้น/);
    expect(granted.length).toBeGreaterThan(0);
    for (const i of c.items.filter((x) => x.row === 'cannot')) expect(i.note).not.toMatch(dev);
    const imp = sheetOf('อยากเป็นเอลฟ์ อมตะ').items.find((i) => i.key === 'impossible');
    expect(imp?.note).not.toMatch(dev);
    expect(imp?.note).toContain('เอลฟ์');
  });

  it('a blank wish has a blurb of no granted rows', () => {
    expect(sheetOf('').story[0]).toMatch(/ยังไม่มีอะไรถูกกำหนด/);
  });

  it('choosing a mode puts the mode and its race in the rows of what is sure and gives its mood line', () => {
    const c = sheetOf('', 'dragonkin');
    const sure = c.items.filter((i) => i.row === 'sure');
    expect(sure.map((i) => i.key)).toEqual(expect.arrayContaining(['startMode', 'race']));
    expect(sure.find((i) => i.key === 'startMode')?.value).toBe('ผู้ขี่มังกร');
    const modes = startModes(data, null, 'dragonkin');
    for (const m of modes) expect(m.mood.length).toBeGreaterThan(5);
    expect(modes.find((m) => m.chosen)?.mood).toMatch(/ไม่ได้แน่นอน/);
    expect(modes.map((m) => m.mood).join(' ')).not.toMatch(/dk\.|\.md/);
  });

  it('the vow conditions carry no link or id; a life that begins past 15 has no vow to take', () => {
    const c = sheetOf('');
    for (const v of c.vows) expect(v.done).not.toMatch(/\]\(|\.md|GV-/);
    expect(c.vowOpen).toBe(true);
    expect(sheetOf('', 'summoned').vowOpen).toBe(false);
  });

  it('VowChoice has its table at birth and at 15, and the pick reaches the life', () => {
    const s = createSession(data, { seed: 5 });
    const life = startLife(s);
    const first = vowChoiceView(s.game.ctx);
    expect(first?.phase).toBe('first');
    expect(first?.vows).toHaveLength(3);
    expect(first?.vows.every((v) => !/\]\(|GV-/.test(v.name + v.done))).toBe(true);
    expect(command(s.game.ctx, { type: 'god', action: 'vow.pick' as Extract<Command, { type: 'god' }>['action'], args: { pick: 2 }, confirm: true }).ok).toBe(true);
    expect(vowLineOf(s.game.ctx)?.name).toBe(first?.vows[1].name);
    expect(vowChoiceView(s.game.ctx)).toBeNull();
    life.hAge = 15;
    reoffer(s.game.ctx, life);
    const change = vowChoiceView(s.game.ctx);
    expect(change?.phase).toBe('change');
    expect(change?.current).toBe(first?.vows[1].name);
  });

  it('the ending pages hold no id or link, and the world summary is for the fall of the world only', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    runToDeath(s.game);
    const v = cardView(data, s.game.state)!;
    const all = [v.head, v.summary.text, v.epitaph.text, ...v.sections.flatMap((x) => x.lines), ...v.titles, ...(v.vow ? [v.vow.head, ...v.vow.lines] : []), ...v.earned.flatMap((g) => g.names)];
    for (const t of all) expect(t).not.toMatch(/\b[A-Z]{2,4}-\d{1,3}\b|\]\(|\.md/);
    expect(worldEnded(data, s.game.state)).toBe(false);
  });
});

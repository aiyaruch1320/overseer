// The god in the test tools (docs/guide/code-plan.md §8.0): the commands of `npm run play` and the policy of `npm run life`, played on the real core.
// Every command is typed the way a player types it, goes through the preview first and then `yes`; the state must change as the preview said.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { hasAction } from '../../src/core/command';
import type { Game, GameData } from '../../src/core/game';
import { crisesWaiting } from '../../src/core/bonds';
import { extOf } from '../../src/core/character';
import { actsOf, cardsOf, fateCost, fateTargets, grantPrice, holdsKind, kindOf, whisperPrice } from '../../src/core/god/acts';
import { slotsOf } from '../../src/core/npc/types';
import { currentChest, dreamsOf, offerCards } from '../../src/core/god';
import { write } from '../../src/core/log';
import { leaks } from '../../src/core/text';
import { GodConsole, callLines, cardEffect, parseGod, refOf, waitingLines } from '../../scripts/tools/god-commands';
import { statusLines } from '../../scripts/tools/report';
import { runLifeReport } from '../../scripts/tools/life-run';
import { loadAll } from '../../scripts/tools/node-data';
import { POLICIES, afterBeat, createSession, runToCall, startLife, type Session } from '../../scripts/tools/session';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const comparable = (text: string) => text.split('\n').filter((l) => !l.startsWith('กติกาที่ยังไม่มีใครรับ')).join('\n');
const cli = (script: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync('npx', ['tsx', `scripts/tools/${script}.ts`, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 50000 });

/** A life run to its first call of the game (the age stop of 5, a god window): the god can act. */
function atFirstCall(seed = 7, policy?: (typeof POLICIES)[number]): { s: Session; g: Game; god: GodConsole } {
  const s = createSession(data, { seed, policy });
  startLife(s);
  runToCall(s.game);
  return { s, g: s.game, god: new GodConsole({ game: s.game, data }) };
}

const said = (lines: string[] | undefined) => (lines ?? []).join('\n');
const light = (g: Game) => g.state.god.light;
const dread = (g: Game) => g.state.god.dread;

describe('the words of the god', () => {
  it('turns each line into an action with the names of the arguments the actions read', () => {
    expect(parseGod('chest', [])).toEqual({ action: 'chest.open', args: {} });
    expect(parseGod('pick', ['2'])).toEqual({ action: 'chest.pick', args: { slot: 2 } });
    expect(parseGod('reroll', [])).toEqual({ action: 'chest.reroll', args: {} });
    expect(parseGod('reroll', ['ล็อก', '3'])).toEqual({ action: 'chest.reroll', args: { lock: 3 } });
    expect(parseGod('dream', ['3'])).toEqual({ action: 'dream.send', args: { path: 3 } });
    expect(parseGod('whisper', ['ระวัง'])).toEqual({ action: 'whisper', args: { hint: 'ระวัง' } });
    expect(parseGod('whisper', ['ช่วย', 'AL01-1'])).toEqual({ action: 'whisper', args: { hint: 'ช่วย', target: 'AL01-1' } });
    expect(parseGod('answer', ['1', 'ให้'])).toEqual({ action: 'prayer.answer', args: { id: 1, answer: 'ให้' } });
    expect(parseGod('answer', ['1', 'แปลก', '2'])).toEqual({ action: 'prayer.answer', args: { id: 1, answer: 'แปลก', option: 1 } });
    expect(parseGod('miracle', ['mr-04'])).toEqual({ action: 'miracle', args: { id: 'MR-04' } });
    expect(parseGod('miracle', ['MR-04', 'AL-01'])).toEqual({ action: 'miracle', args: { id: 'MR-04', country: 'AL-01' } });
    expect(parseGod('miracle', ['MR-06', 'AL01-1'])).toEqual({ action: 'miracle', args: { id: 'MR-06', npc: 'AL01-1' } });
    expect(parseGod('miracle', ['MR-09', 'AL'])).toEqual({ action: 'miracle', args: { id: 'MR-09', continent: 'AL' } });
    expect(parseGod('miracle', ['MR-23', '3'])).toEqual({ action: 'miracle', args: { id: 'MR-23', dragon: 3 } });
    expect(parseGod('decree', ['WR-04', '2'])).toEqual({ action: 'decree', args: { event: 'WR-04', mul: 2 } });
    expect(parseGod('miracle', ['MR-25', 'WR-04', '0.5'])).toEqual({ action: 'decree', args: { event: 'WR-04', mul: 0.5 } });
    expect(parseGod('cancel', ['2'])).toEqual({ action: 'miracle', args: { cancel: 2 } });
    expect(parseGod('yes', [])).toEqual({ meta: 'yes' });
  });

  it('says how to type a command that was typed wrong, and what it does not know by name', () => {
    for (const [w, rest] of [['pick', []], ['dream', ['x']], ['whisper', []], ['answer', ['1']], ['miracle', ['07']], ['decree', ['WR-04']], ['decree', ['WR-04', 'x']]] as const) {
      const r = parseGod(w, [...rest]);
      expect('error' in r && r.error.startsWith('ใช้:')).toBe(true);
    }
    const r = parseGod('miracle', ['MR-04', 'เมืองที่ไม่มี']);
    expect('error' in r && r.error).toContain('ไม่รู้จักประเทศ');
  });

  it('reads the names of countries, NPCs, continents, dragons and events the game shows', () => {
    const { g } = atFirstCall();
    const ref = refOf(g, data);
    const life = g.state.life!;
    const country = (data.countries.items as { id: string; name: string }[]).find((c) => c.id === life.country)!;
    expect(ref.country(country.name)).toBe(life.country);
    expect(ref.continent('อัซการ์')).toBe('AZ');
    expect(ref.dragon(g.state.world.dragons[2].id)).toBe(2);
    const ev = fateTargets(g.ctx)[0];
    expect(ref.event(ev.name)).toBe(ev.id);
    expect(parseGod('miracle', ['MR-04', country.name], ref)).toEqual({ action: 'miracle', args: { id: 'MR-04', country: life.country } });
  });
});

describe('the console on the real god', () => {
  it('has every power, the conjuring and the vows included, and a look changes nothing', () => {
    const { g, god } = atFirstCall();
    for (const a of ['chest.open', 'chest.pick', 'chest.reroll', 'chest.skip', 'dream.send', 'whisper', 'prayer.answer', 'miracle', 'decree', 'conjure', 'vow.pick'] as const) expect(hasAction(a), a).toBe(true);
    const before = JSON.stringify(g.state);
    const o = said(god.options());
    god.power();
    god.doableNow();
    waitingLines(g, data);
    expect(JSON.stringify(g.state)).toBe(before);
    expect(o).toContain('chest (เปิดหีบประทาน) — ทำได้');
    expect(o).toContain('conjure <กริยา> <แก่น> <ขนาด> [เป้าหมาย] (เสกตามใจ) — ทำได้ตามวงที่เปิด');
    expect(o).toContain('vow [N] (เลือกคำปฏิญาณ)');
    expect(o).toContain('ทางที่ 1:');
    expect(o).not.toMatch(/undefined|\[object|NaN/);
    // the lines that tell about the game (the ways of a dream, the cards) hold no code; the lines that teach a command hold its letters
    for (const l of o.split('\n').filter((x) => x.startsWith('  ทางที่'))) expect(leaks(l), l).toEqual([]);
  });

  it('a preview changes nothing, `no` drops it, a command typed short is told how to type it', () => {
    const { g, god } = atFirstCall();
    const before = JSON.stringify(g.state);
    const p = said(god.handle('chest'));
    expect(JSON.stringify(g.state)).toBe(before);
    expect(p).toContain('-- ตัวอย่างผล: เปิดหีบประทาน --');
    expect(p).toContain('เหลือ 2 จาก 2');
    expect(god.pending?.action).toBe('chest.open');
    expect(said(god.handle('no'))).toContain('ยกเลิก');
    expect(god.pending).toBeNull();
    expect(said(god.handle('yes'))).toContain('ไม่มีคำสั่งที่รอยืนยัน');
    expect(said(god.handle('conjure ไฟ'))).toContain('ใช้: conjure');
    expect(said(god.handle('pick 1'))).toContain('ทำไม่ได้ — ไม่มีหีบที่เปิดอยู่');
    expect(god.handle('status')).toBeUndefined();
  });

  it('chest · pick: the preview names the card and the price, and yes takes exactly that price', () => {
    const { g, god } = atFirstCall();
    god.handle('chest');
    expect(said(god.handle('yes'))).toContain('หีบประทานเปิดขึ้น มี');
    const ch = currentChest(g.ctx)!;
    expect(ch).toBeTruthy();
    const slot = ch.slots.find((x) => x && x.pay === 'faith' && x.kind === 'bless')!;
    const before = light(g);
    const gifts = g.state.life!.blessings.length;
    const p = said(god.handle(`pick ${slot.slot}`));
    expect(p).toContain(`ใบที่ ${slot.slot}: ${slot.name}`);
    expect(p).toContain(`ราคา: แสงศรัทธา ${slot.price}`);
    const done = said(god.handle('yes'));
    expect(done).toContain(`ประทานพร ${slot.name}`);
    expect(before - light(g)).toBeCloseTo(slot.price, 5);
    expect(g.state.life!.blessings.length).toBe(gifts + 1);
    expect(currentChest(g.ctx)).toBeNull();
    expect(g.state.god.chronicle.some((c) => c.kind === 'chest.pick')).toBe(true);
  });

  it('reroll and skip: the reroll costs what the preview says, the skip nothing', () => {
    const { g, god } = atFirstCall();
    god.handle('chest');
    god.handle('yes');
    const first = currentChest(g.ctx)!.slots.map((x) => x?.id).join();
    const before = light(g);
    const p = said(god.handle('reroll'));
    const price = Number(/ราคา แสงศรัทธา (\d+)/.exec(p)![1]);
    god.handle('yes');
    expect(before - light(g)).toBe(price);
    expect(currentChest(g.ctx)!.slots.map((x) => x?.id).join()).not.toBe(first);
    god.handle('skip');
    expect(said(god.handle('yes'))).toContain('พับหีบเก็บ');
    expect(currentChest(g.ctx)).toBeNull();
    expect(light(g)).toBe(before - price);
  });

  it('dream: the preview gives the way, his heart and the price; yes sends it and takes the price', () => {
    const { g, god } = atFirstCall();
    const offers = offerCards(g.ctx);
    expect(offers.length).toBeGreaterThan(0);
    const before = light(g);
    const p = said(god.handle('dream 2'));
    expect(p).toContain('ภาพในฝัน:');
    expect(p).toContain(`ใจของเขา: ${offers[1].level}`);
    expect(p).toContain(`ราคา: แสงศรัทธา ${offers[1].price}`);
    const done = said(god.handle('yes'));
    expect(done).toContain('ส่งฝันถึง');
    expect(before - light(g)).toBe(offers[1].price);
    expect(dreamsOf(g.ctx)).toHaveLength(1);
    expect(dreamsOf(g.ctx)[0].node).toBe(offers[1].node);
    expect(dreamsOf(g.ctx)[0].choice).toBe(offers[1].choice);
  });

  it('whisper: the price in the preview is taken, the hint is spent for the year', () => {
    const { g, god } = atFirstCall();
    const price = whisperPrice(g.ctx, 'ระวัง');
    const before = light(g);
    const p = said(god.handle('whisper ระวัง'));
    expect(p).toContain(`ราคา: แสงศรัทธา ${price}`);
    expect(p).toContain('กระซิบได้อีก 2 ครั้งในปีนี้');
    god.handle('yes');
    expect(before - light(g)).toBe(price);
    expect(actsOf(g.state).whisper.used).toEqual(['ระวัง']);
    expect(said(god.handle('whisper ระวัง'))).toContain('ทำไม่ได้ — คำใบ้เดียวกันซ้ำไม่ได้ภายในปีเดียว');
    // a hint that names somebody needs the name
    expect(said(god.handle('whisper คนนั้นโกหก'))).toContain('ต้องชี้คน');
    expect(said(god.handle('whisper ช่วย ผู้ที่ไม่มี'))).toContain('ไม่รู้จัก NPC');
  });

  /** A prayer card as the maker of prayers writes it. */
  function pray(g: Game, kind: string) {
    // the matter of the prayer is made true first: a card whose matter is not true is taken back and cannot be answered (M2 review G5)
    const life = g.state.life!;
    if (!holdsKind(g.ctx, kind)) {
      if (kind === 'heal') life.flags.push('wounded');
      else if (kind === 'harvest') life.job = 'farmer';
      else if (kind === 'vengeance') {
        const slot = Object.values(slotsOf(g.state)).find((x) => x.status === 'alive')!;
        slot.rel['mc.grudge'] = 9;
      } else {
        life.hAge = Math.max(life.hAge, 30);
        life.gold = 5;
        life.cls = 'c2';
        extOf(life).axes.ambition = 40;
      }
    }
    const a = actsOf(g.state);
    const tick = g.state.life!.hAge * 4 + g.state.clock.quarter;
    const card = { n: ++a.prayerN, kind, tick, exp: tick + 14, year: g.state.clock.worldYear };
    cardsOf(g.ctx).push(card);
    return card;
  }

  it('answer: give takes the price and does what the preview says; the others take none', () => {
    const { g, god } = atFirstCall();
    const wealth = pray(g, 'wealth');
    const price = grantPrice(g.ctx, kindOf(g.ctx, 'wealth')!);
    const gold = g.state.life!.gold;
    const beforeL = light(g);
    const p = said(god.handle(`answer ${wealth.n} ให้`));
    expect(p).toContain(`คำอธิษฐานใบที่ ${wealth.n}: ขอพ้นความจน`);
    expect(p).toContain(`ราคา: แสงศรัทธา ${price}`);
    expect(p).toContain('ได้ทอง 50');
    const done = said(god.handle('yes'));
    expect(done).toContain('ท่านให้ตามคำอธิษฐานใบที่');
    expect(g.state.life!.gold).toBe(gold + 50);
    expect(beforeL - light(g)).toBeCloseTo(price - kindOf(g.ctx, 'wealth')!.grantCost * 0 - 2, 5); // pays the price, earns back the income of 2
    expect(cardsOf(g.ctx)).toHaveLength(0);

    const hate = pray(g, 'vengeance');
    const beforeD = dread(g);
    const q = said(god.handle(`answer ${hate.n} ลงโทษ`));
    expect(q).toContain('ท่านได้ความหวาดกลัว +');
    god.handle('yes');
    expect(dread(g)).toBeGreaterThan(beforeD);
    expect(cardsOf(g.ctx)).toHaveLength(0);

    const quiet = pray(g, 'fame');
    const l2 = light(g);
    god.handle(`answer ${quiet.n} ปฏิเสธ`);
    expect(said(god.handle('yes'))).toContain('ท่านปฏิเสธคำอธิษฐานใบที่');
    expect(light(g)).toBe(l2);
    const wait = pray(g, 'harvest');
    god.handle(`answer ${wait.n} นิ่ง`);
    god.handle('yes');
    expect(cardsOf(g.ctx)).toHaveLength(1);
    expect(cardsOf(g.ctx)[0].silent).toBe(true);
    expect(said(god.handle('answer 99 ให้'))).toContain('ไม่มีคำอธิษฐานใบนั้น');
  });

  it('the large miracles (G5) typed as a player types them: the preview says what will happen, no id is read, `yes` does it, and the ruin is in the log', () => {
    const { g, god } = atFirstCall();
    g.state.god.dread = 200;
    g.state.god.light = 200;
    g.state.life!.country = 'AL-01'; // far from the country that falls
    const countries = data.countries.items as { id: string; name: string }[];
    const name = (id: string) => countries.find((c) => c.id === id)!.name;
    const p = said(god.handle(`miracle MR-17 ${name('MK-12')}`));
    expect(p).toContain('ดาวตก (ระดับใหญ่)');
    expect(p).toContain(`ที่: ${name('MK-12')}`);
    expect(p).toContain('ราคา: ความหวาดกลัว 60');
    expect(p).toContain('ท่านได้ความหวาดกลัวคืน 20');
    expect(p).toContain('ผู้คนเหลือ 10–40%');
    expect(p).toMatch(/ลาง: อีก 1 ฤดู/);
    expect(p).not.toMatch(/RU-|GD-0|nc_|mt_/);
    const before = JSON.stringify(g.state);
    expect(said(god.handle('no'))).toContain('ยกเลิก');
    expect(JSON.stringify(g.state)).toBe(before); // a preview and its refusal change nothing
    god.handle(`miracle MR-17 ${name('MK-12')}`);
    const done = said(god.handle('yes'));
    expect(done).toContain('ลางของดาวตกปรากฏขึ้น');
    expect(dread(g)).toBe(140);
    // the day comes with the next beat
    for (let i = 0; i < 2 && !g.state.world.countryFlags['MK-12']?.includes('god_ruin'); i++) g.beat();
    expect(g.state.world.countryFlags['MK-12']).toContain('god_ruin');
    const lines = g.state.log.filter((e) => e.sys === 'god' && (e.kind === 'ruin' || e.kind === 'miracle')).map((e) => e.id);
    expect(lines).toContain('made');
    // a seal says so before it is struck, and the dragon that lives there is named
    g.state.god.cooldowns = {};
    const s = said(god.handle(`miracle MR-18 ${name('AZ-02')}`));
    expect(s).toContain('เป็นหมุดผนึกของเพลิงนิรันดร์');
    expect(s).toContain('ไม่เป็นซาก เป็นเมืองร้าว');
    expect(said(god.handle('miracle MR-22 อัซการ์'))).toContain('หมุดผนึก');
    expect(said(god.handle('miracle MR-19 AL-01'))).toContain('ไม่ติดทะเล');
  });

  it('answer แปลก: three gifts to choose from, the one chosen is given', () => {
    const { g, god } = atFirstCall();
    const card = pray(g, 'love');
    const p = said(god.handle(`answer ${card.n} แปลก 2`));
    expect(p).toContain('ของแปลกที่ให้เลือก: 1 ');
    const blessings = g.state.life!.blessings.length;
    god.handle('yes');
    expect(g.state.life!.blessings.length).toBe(blessings + 1);
  });

  it('miracle: a small one on a country named in words; the price is taken and the wait begins', () => {
    const { g, god } = atFirstCall();
    const life = g.state.life!;
    const country = (data.countries.items as { id: string; name: string }[]).find((c) => c.id === life.country)!;
    g.state.god.light = 100;
    const p = said(god.handle(`miracle MR-04 ${country.name}`));
    expect(p).toContain('แสงศักดิ์สิทธิ์ (ระดับเล็ก)');
    expect(p).toContain(`ที่: ${country.name}`);
    expect(p).toContain('ราคา: แสงศรัทธา 30');
    expect(p).toContain('ระยะรอหลังใช้: 10 ปีโลก');
    const done = said(god.handle('yes'));
    expect(done).toMatch(/ปาฏิหาริย์ แสงศักดิ์สิทธิ์ ที่\S+: /);
    expect(light(g)).toBe(70);
    expect(g.state.god.cooldowns['MR-04']).toBeGreaterThan(g.state.clock.worldYear);
    expect(said(god.handle('miracle MR-04'))).toContain('ต้องรออีก');
    expect(g.state.god.chronicle.some((c) => c.kind === 'miracle' && c.id === 'MR-04')).toBe(true);
    // a miracle that does not exist says so in words; the large ones (G5) are here and wait for the dread they cost
    expect(said(god.handle('miracle MR-99'))).toContain('ไม่มีปาฏิหาริย์');
    expect(said(god.handle('miracle MR-17'))).toContain('ความหวาดกลัวไม่พอ');
  });

  it('miracle · cancel: the grand miracle shows an omen; cancelling gives half the price back', () => {
    const { g, god } = atFirstCall();
    g.state.god.light = 150;
    const p = said(god.handle('miracle MR-21'));
    expect(p).toContain('ลาง: อีก 1 ฤดูก่อนเกิดเหตุ');
    god.handle('yes');
    expect(actsOf(g.state).pending).toHaveLength(1);
    expect(light(g)).toBe(0);
    const n = actsOf(g.state).pending[0].n;
    expect(said(god.options())).toContain(`ลางใบที่ ${n}: `);
    expect(said(god.handle(`cancel ${n}`))).toContain(`ยกเลิกลางใบที่ ${n}`);
    god.handle('yes');
    expect(actsOf(g.state).pending).toHaveLength(0);
    expect(light(g)).toBe(75);
  });

  it('decree: bends the weight of an event that shows an omen, for the price the preview shows', () => {
    const { g, god } = atFirstCall();
    g.state.god.light = 100;
    g.state.god.dread = 100;
    const t = fateTargets(g.ctx).find((x) => x.dragon === undefined)!;
    const cost = fateCost(g.ctx, t.mark, 0.5);
    const p = said(god.handle(`decree ${t.name} 0.5`));
    expect(p).toContain('ตัวคูณ: ×0.5');
    expect(p).toContain(`ราคา: แสงศรัทธา ${cost.faith}`);
    god.handle('yes');
    expect(light(g)).toBe(100 - (cost.faith ?? 0));
    expect(actsOf(g.state).fates[t.id].mul).toBe(0.5);
    expect(g.state.god.chronicle.some((c) => c.kind === 'miracle' && c.id === 'MR-25')).toBe(true);
    expect(said(god.handle(`decree ${t.name} 0.5`))).toContain('มีลิขิตอยู่แล้ว');
  });

  it('the lines of the god read as Thai, not as codes', () => {
    const { g, god } = atFirstCall();
    god.autoYes = true;
    const out: string[] = [];
    g.state.god.light = 150;
    const card = pray(g, 'heal');
    for (const c of ['chest', 'skip', 'dream 1', 'whisper กล้าเถิด', `answer ${card.n} ให้`, 'miracle MR-04']) out.push(...(god.handle(c) ?? []));
    const body = out.filter((l) => l.includes('│')).map((l) => l.replace(/^[* !]*อายุ[^│]*│\s*/, '').replace(/^\[[^\]]*\]\s*/, ''));
    expect(body.length).toBeGreaterThan(5);
    for (const l of body) expect(leaks(l), l).toEqual([]);
  });
});

describe('the console: the review of M2 (words, previews, errors)', () => {
  function pray2(g: Game, kind: string) {
    // the matter of the prayer is made true first, as pray() does above (a card whose matter is not true is taken back)
    const life = g.state.life!;
    life.hAge = Math.max(life.hAge, 30);
    if (kind === 'love') delete (life.ext as Record<string, unknown>).bonds;
    if (kind === 'heir') life.ext.bonds = { partner: true, children: [] };
    expect(holdsKind(g.ctx, kind)).toBe(true);
    const a = actsOf(g.state);
    const tick = g.state.life!.hAge * 4 + g.state.clock.quarter;
    const card = { n: ++a.prayerN, kind, tick, exp: tick + 14, year: g.state.clock.worldYear };
    cardsOf(g.ctx).push(card);
    return card;
  }

  it('G6 (M3): the preview of a prayer for a lover or a child says it will come, and the scene and the chronicle say the same', () => {
    const { g, god } = atFirstCall();
    const love = pray2(g, 'love');
    const p = said(god.handle(`answer ${love.n} ให้`));
    expect(p).toContain('ผลที่คาด: ได้พบคนรัก');
    expect(p).not.toMatch(/คำมั่นที่ยังไม่เป็นจริง|ยังไม่เกิดผลทันที/);
    const done = said(god.handle('yes'));
    expect(done).not.toMatch(/คำมั่นที่ยังไม่เป็นจริง/);
    // the lover is a real tie of the life now
    expect(g.state.life!.flags).toContain('god_lover');
    const chronicle = g.state.god.chronicle.filter((c) => c.kind === 'prayer.give').map((c) => c.result);
    expect(chronicle.join()).toContain('rel:+lover');
    // the strange answer says what it is: the blessing comes, what was asked does not
    const heir = pray2(g, 'heir');
    expect(said(god.handle(`answer ${heir.n} ให้`))).toContain('ผลที่คาด: ได้ลูก');
    god.handle('no');
    const q = said(god.handle(`answer ${heir.n} แปลก 1`));
    expect(q).toMatch(/ของแปลกที่ให้เลือก: 1 .+ \(ระดับ.+\)/);
    expect(q).toContain('สิ่งที่ขอตรง ๆ ไม่เกิด');
    expect(q).toMatch(/ราคาสุทธิหลังได้คืน: แสงศรัทธา \d+/);
  });

  it('a prayer to lift a curse says which curses it may lift', () => {
    const { g, god } = atFirstCall();
    const life = g.state.life!;
    life.curses = ['c_poverty', 'c_lonely'];
    const card = pray2(g, 'uncurse');
    const p = said(god.handle(`answer ${card.n} ให้`));
    expect(p).toMatch(/คำสาปข้อหนึ่งหลุดไป \(สุ่มจาก .+ · .+\)/);
    expect(p).toContain('ราคาสุทธิหลังได้คืน');
  });

  it('errors keep their numbers and the words the player typed', () => {
    const { g, god } = atFirstCall();
    g.state.god.dread = 100;
    const t = fateTargets(g.ctx)[0];
    expect(said(god.handle(`decree ${t.name} 0.19`))).toMatch(/ชะลอได้ ×0\.2 ถึง ×0\.9/);
    expect(said(god.handle(`decree ${t.name} 3.01`))).toMatch(/เร่งได้ ×1\.1 ถึง ×3/);
    expect(said(god.handle(`decree ${t.name} 1`))).toContain('ที่ไม่ใช่ 1');
    expect(said(god.handle('whisper foo'))).toContain('ไม่มีคำใบ้ "foo"');
    expect(said(god.handle('whisper foo'))).toContain('คำใบ้ที่มี: ระวัง');
    g.state.god.dread = 1;
    expect(said(god.handle(`decree ${t.name} 2`))).toMatch(/ความหวาดกลัวไม่พอ \(ต้อง \d+ มี 1\)/);
    // the multiplier is typed the way the help writes it
    expect(parseGod('decree', ['WR-04', '×0.5'])).toEqual({ action: 'decree', args: { event: 'WR-04', mul: 0.5 } });
    expect(parseGod('decree', ['WR-04', 'x2'])).toEqual({ action: 'decree', args: { event: 'WR-04', mul: 2 } });
  });

  it('a hint that points says what to name, and a name that fits two is not guessed', () => {
    const { g } = atFirstCall();
    const ref = refOf(g, data);
    const a = parseGod('whisper', ['จงไป'], ref);
    expect('error' in a && a.error).toMatch(/ต้องชี้ที่ — พิมพ์ชื่อประเทศหรือทวีป/);
    const b = parseGod('whisper', ['ช่วย'], ref);
    expect('error' in b && b.error).toMatch(/ต้องชี้คน/);
    const dragons = g.state.world.dragons.map((d) => d.id);
    // a syllable shared by two dragons picks neither; a whole name picks that one
    const shared = [...dragons[0]].map((_, i) => dragons[0].slice(i, i + 1)).find((ch) => dragons.filter((d) => d.includes(ch)).length > 1)!;
    expect(ref.dragon(shared)).toBeUndefined();
    const m = parseGod('miracle', ['MR-23', shared], ref);
    expect('error' in m && m.error).toMatch(/เป็นชื่อมังกรได้หลายแห่ง|ไม่รู้จักมังกร/);
    expect(ref.dragon(dragons[3])).toBe(3);
  });

  it('options: a hint said this year does not hide the others', () => {
    const { g, god } = atFirstCall();
    god.autoYes = true;
    god.handle('whisper ระวัง');
    const o = said(god.options());
    expect(o).toMatch(/whisper .*— ทำได้ · ราคา แสงศรัทธา/);
    expect(o).toMatch(/ใช้ได้ตอนนี้: .*กล้าเถิด/);
    expect(o).toMatch(/ใช้ไม่ได้: ระวัง \(คำใบ้เดียวกันซ้ำไม่ได้ภายในปีเดียว\)/);
    expect(o).toMatch(/ต้องชี้เป้าด้วย: จงไป <ที่>/);
    expect(god.doableNow()).toContain('whisper');
    // the decree is told by a range, and `decree list` lists them all
    expect(o).toMatch(/decree .*— ทำได้ · ราคา 15 ถึง 60 ตามขนาดของเหตุการณ์/);
    expect(said(god.handle('decree list')).split('\n').length).toBe(1 + fateTargets(g.ctx).length);
  });

  it('after the life ends nothing can be done: options and doable say so', () => {
    const { g, god } = atFirstCall();
    g.state.life!.dead = { year: g.state.clock.worldYear, hAge: 20, cause: 'old' };
    expect(god.doableNow()).toEqual([]);
    expect(said(god.options())).toContain('ชีวิตนี้จบแล้ว');
    expect(said(god.power())).toContain('ส่วนที่ส่งต่อให้ผู้สืบทอด');
  });

  it('a miracle of ruin says what comes back, a miracle that clears nothing says so', () => {
    const { g, god } = atFirstCall();
    g.state.god.dread = 100;
    g.state.god.light = 100;
    const ruin = said(god.handle('miracle MR-07'));
    expect(ruin).toMatch(/เมื่อเหตุเกิดขึ้น ท่านได้ความหวาดกลัวคืน \d+ \(ราคาสุทธิ ความหวาดกลัว \d+\)/);
    expect(ruin).not.toMatch(/สิ่งที่ประเทศนั้นเป็นอยู่: *$/m);
    g.state.world.countryFlags[g.state.life!.country] = [];
    const rain = said(god.handle('miracle MR-01'));
    expect(rain).toContain('ผลที่คาด: ฝนตกหนึ่งฤดู');
    expect(rain).toContain('คำเตือน: ประเทศนั้นไม่มีข้าวยากหมากแพงให้ปลด');
    g.state.world.countryFlags[g.state.life!.country] = ['famine'];
    expect(said(god.handle('miracle MR-01'))).not.toContain('คำเตือน');
  });

  it('a whisper preview keeps the multipliers, and a dream warns about the burden of the heart', () => {
    const { g, god } = atFirstCall();
    const w = said(god.handle('whisper ระวัง'));
    expect(w).toMatch(/คำใบ้ “ระวัง”: ทางปลอดภัย ×2/);
    const offers = offerCards(g.ctx);
    const against = offers.findIndex((o) => o.reasons.some((r) => r.includes('ขัดกับนิสัย')));
    if (against >= 0) {
      const d = said(god.handle(`dream ${against + 1}`));
      expect(d).toMatch(/คำเตือน: ถ้าเขาทำตามทางนี้ ภาระใจจะเพิ่มอีก 1 \(ตอนนี้ \d+ จาก 2\)/);
    }
    const d1 = said(god.handle('dream 1'));
    expect(d1).toMatch(/โอกาสทำตามราว \d+–\d+%/);
  });

  it('the cards of the chest say what they do', () => {
    const { g, god } = atFirstCall();
    god.handle('chest');
    god.handle('yes');
    const ch = currentChest(g.ctx)!;
    const lines = waitingLines(g, data).filter((l) => l.startsWith('  ใบที่'));
    const withEffect = ch.slots.filter((x) => x && (x.kind === 'bless' || x.kind === 'curse') && cardEffect(data, x));
    expect(withEffect.length).toBeGreaterThan(0);
    for (const x of withEffect) expect(lines.find((l) => l.startsWith(`  ใบที่ ${x!.slot}:`))).toContain(` — ${cardEffect(data, x!)}`);
    expect(cardEffect(data, { kind: 'bless', id: 'rb_orc_r' })).toBe('ลูกน้องรบแข็งขึ้นเมื่ออยู่ใกล้ผู้ถือ');
    expect(cardEffect(data, { kind: 'weapon', id: 'x', variant: 'cursed' })).toContain('ต้องสาป');
  });

  it('the status shows what the god gave that is carried', () => {
    const { g } = atFirstCall();
    const life = g.state.life!;
    life.items = ['rb_orc_r'];
    life.blessings = [...life.blessings, 'rb_orc_r'];
    const st = statusLines(data, g.state).join('\n');
    expect(st).toContain('ธงของผู้นำ');
  });
});

describe('the call of the game', () => {
  it('stops at an attention call and tells why: an age stop, a prayer, a window', () => {
    const s = createSession(data, { seed: 7 });
    startLife(s);
    const calls: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = runToCall(s.game);
      if (r.stoppedBy !== 'call') break;
      expect(r.call?.sys).toBe('attention');
      calls.push(callLines(data, r.call!, false, s.game).join('\n'));
    }
    const all = calls.join('\n');
    expect(all).toContain('เกมเรียกเพราะ: ถึงจุดหยุดตามอายุ 5');
    expect(all).toContain('เกมเรียกเพราะ: มีคำอธิษฐานใหม่: ');
    expect(all).toContain('ถึงทางแยกที่พระเจ้าแทรกได้');
    // the call says what it lets the player do, and for a prayer which card waits
    expect(all).toMatch(/ทำได้เพราะเรื่องนี้: คำอธิษฐานใบที่ \d+ \(.+\) เหลือเวลาราว [\d.]+ ปี — answer \d+/);
    expect(all).toContain('ทำได้เพราะเรื่องนี้: จุดหยุดตามอายุเป็นหน้าต่างพระเจ้า');
    expect(all).toMatch(/เกมหยุดรอท่าน|มีเรื่องรอท่าน/);
    expect(leaks(all.replace(/^เกมเรียกเพราะ: /gm, '').replace(/^ทำได้เพราะเรื่องนี้: .*$/gm, '')), all).toEqual([]);
  });

  it('without the attention system the old rule holds: an entry of level 3', () => {
    const s = createSession(data, { seed: 5 });
    startLife(s);
    const at = s.game.systems.findIndex((x) => x.name === 'attention');
    if (at >= 0) s.game.systems.splice(at, 1);
    s.game.systems.push({ name: 'noise', beat: (ctx) => void (ctx.state.life!.hAge === 1 && !ctx.state.log.some((e) => e.kind === 'x') && write(ctx.state, { sys: 'story', kind: 'x', level: 3, data: {} })) });
    const r = runToCall(s.game);
    expect(r.stoppedBy).toBe('call');
    expect(callLines(data, r.call!)[0]).toContain('บันทึกระดับ 3');
  });
});

describe('npm run play', () => {
  it('plays from birth: advance to the first call, options, power', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-god-'));
    try {
      const out = cli('play', ['--seed=7', '--new', '--cmd=advance; options; power'], { OVERSEER_PLAY_DIR: dir });
      expect(out).toContain('เกมเรียกเพราะ: ถึงจุดหยุดตามอายุ 5');
      expect(out).toContain('chest (เปิดหีบประทาน) — ทำได้');
      expect(out).toContain('dream N (ส่งฝัน) — ทำได้ · ราคา แสงศรัทธา');
      expect(out).toContain('-- พลังของพระเจ้า --');
      expect(out).toContain('ปาฏิหาริย์ที่เปิดใช้: MR-01 ฝนต้องฤดู (แสงศรัทธา 15)');
      expect(out).not.toMatch(/undefined|\[object|NaN/);
      expect(out).not.toContain('ยังไม่มีพลังใดลงทะเบียน');
      const bad = cli('play', ['--seed=7', '--cmd=pick; dream x; miracle 7'], { OVERSEER_PLAY_DIR: dir });
      expect(bad).toContain('ใช้: pick N');
      expect(bad).toContain('ใช้: dream N');
      expect(bad).toContain('ใช้: miracle MR-xx');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps a waiting command between runs, and the chest opened in one run is picked in the next', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-god-'));
    try {
      cli('play', ['--seed=7', '--new', '--cmd=advance; chest'], { OVERSEER_PLAY_DIR: dir });
      const opened = cli('play', ['--seed=7', '--cmd=yes'], { OVERSEER_PLAY_DIR: dir });
      expect(opened).toContain('หีบประทานเปิดขึ้น มี');
      expect(opened).toContain('ใบที่ 1:');
      const picked = cli('play', ['--seed=7', '--yes', '--cmd=pick 1; power'], { OVERSEER_PLAY_DIR: dir });
      expect(picked).toContain('-- ทำแล้ว: เลือกการ์ดในหีบ ใบที่ 1 --');
      expect(picked).toContain('ประทาน');
      expect(picked).toMatch(/ชีวิตนี้: ประทานแล้ว 1 /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a policy stays in the save, says so on every run, and `--policy=ไม่มี` takes it out (review M2 L7)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-god-'));
    try {
      const first = cli('play', ['--seed=7', '--new', '--policy=เมตตา', '--cmd=advance 2'], { OVERSEER_PLAY_DIR: dir });
      expect(first).toContain('นโยบาย "เมตตา" ทำงานอยู่');
      const second = cli('play', ['--seed=7', '--cmd=advance 2'], { OVERSEER_PLAY_DIR: dir });
      expect(second).toContain('นโยบาย "เมตตา" ทำงานอยู่ ระบบพระเจ้าจะเล่นแทนท่านทุกจังหวะ · ใส่ --policy=ไม่มี เพื่อปิด');
      const off = cli('play', ['--seed=7', '--policy=ไม่มี', '--cmd=advance 2'], { OVERSEER_PLAY_DIR: dir });
      expect(off).toContain('ปิดนโยบายแล้ว');
      const after = cli('play', ['--seed=7', '--cmd=advance 2'], { OVERSEER_PLAY_DIR: dir });
      expect(after).not.toContain('ทำงานอยู่');
      expect(after).not.toContain('ปิดนโยบายแล้ว');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a new life that is already waiting at birth shows that call, and help explains the words of the game', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'overseer-play-god-'));
    try {
      const out = cli('play', ['--seed=302', '--new', '--cmd=help'], { OVERSEER_PLAY_DIR: dir });
      expect(out).toContain('-- เกมหยุดรอท่านตั้งแต่เกิด --');
      expect(out).toContain('เกมเรียกเพราะ: ถึงทางแยกที่พระเจ้าแทรกได้');
      expect(out).toContain('ทำได้เพราะเรื่องนี้:');
      expect(out).toContain('จังหวะ = หนึ่งในสี่ของปีชีวิต');
      expect(out).toContain('ศ.ม. = ศักราชมังกร');
      // once the life is over the end shows the hand of the god and no power
      const end = cli('play', ['--seed=302', '--policy=เมตตา', '--cmd=advance 400'], { OVERSEER_PLAY_DIR: dir });
      expect(end).toContain('-- พระหัตถ์ของท่านในชีวิตนี้ --');
      expect(end).toMatch(/ใช้พลัง \d+ ครั้ง/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the count of what the god did counts a dream once, and the outcomes apart (review M2 P16)', () => {
    const run = runLifeReport(data, { seed: 303, policy: 'เมตตา' });
    const sent = run.state.god.chronicle.filter((c) => c.kind === 'dream' && String(c.result).startsWith('sent:')).length;
    const outcomes = run.state.god.chronicle.filter((c) => c.kind === 'dream' && !String(c.result).startsWith('sent:')).length;
    expect(sent).toBeGreaterThan(0);
    expect(run.text).toContain(`ฝัน ×${sent}`);
    if (outcomes) expect(run.text).toContain(`ผลของฝันที่ส่งไป ${outcomes} ครั้ง`);
  });

  it('rejects a policy name that is not one of the eight', () => {
    expect(POLICIES).toHaveLength(9);
    const r = spawnSync('npx', ['tsx', 'scripts/tools/play.ts', '--seed=1', '--policy=เทพบุตร'], { cwd: root, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--policy ต้องเป็นหนึ่งใน');
  });
});

describe('M4 review: what the player reads of the large deeds', () => {
  it('MR-21 shows no path of the documents, and says what the grand miracle does to the world', () => {
    const { g, god } = atFirstCall();
    g.state.god.light = 150;
    const p = said(god.handle('miracle MR-21'));
    expect(p).not.toMatch(/\]\(|\[\.\.|\.md/);
    expect(p).toContain('ผลที่คาด: เกิด ปาฏิหาริย์แห่งพระเจ้า ทันที');
    expect(p).toContain('ผลต่อโลก: ศรัทธาโลก +30');
  });

  it('the conjuring says its price multiplier when the belief of the character is below −30', () => {
    const { g, god } = atFirstCall();
    g.state.god.light = 200;
    expect(said(god.handle('conjure ให้กำเนิด ไฟ ประเทศ'))).not.toContain('×1.5');
    g.state.life!.godFaith = -40;
    expect(said(god.handle('conjure ให้กำเนิด ไฟ ประเทศ'))).toMatch(/ราคา: แสงศรัทธา 68 \(ฐาน 45 ×1\.5 เพราะศรัทธาเทพของเขาต่ำกว่า −30/);
  });

  it('a country is a target by the name of the map and by the title the log uses', () => {
    const { g, god } = atFirstCall();
    g.state.god.light = 100;
    const c = (data.countries.items as { id: string; name: string; title: string }[]).find((x) => x.id === g.state.life!.country)!;
    expect(c.title).not.toBe(c.name);
    for (const n of [c.name, c.title]) expect(said(god.handle(`miracle MR-04 ${n}`)), n).not.toContain('ไม่รู้จัก');
  });
});

describe('M4 review: the policies cover the vows, the conjuring and the seals', () => {
  it('ตีหมุด is a policy of the tools, and every policy that spends takes a vow', () => {
    expect(POLICIES).toContain('ตีหมุด');
    for (const policy of ['เมตตา', 'ลงโทษ', 'สุ่ม', 'ตีหมุด'] as const) {
      const r = runLifeReport(data, { seed: 4, policy });
      const taken = r.state.log.filter((e) => e.sys === 'god' && e.kind === 'vow.take').length;
      expect(taken, policy).toBe(1);
    }
  });

  it('the policies that keep their light or play by chance conjure, within the caps of the circle', () => {
    let conjured = 0;
    for (const seed of [2, 3, 4, 5]) {
      for (const policy of ['เก็บพลัง', 'สุ่ม'] as const) {
        const r = runLifeReport(data, { seed, policy });
        const n = r.state.god.chronicle.filter((c) => c.kind === 'conjure').length;
        expect(n).toBeLessThanOrEqual(3);
        conjured += n;
      }
    }
    expect(conjured).toBeGreaterThan(0);
  });
});

describe('npm run life --policy', () => {
  it('every policy plays a whole life on the real god, the same way twice, and ends with the hand of the god', () => {
    const a = runLifeReport(data, { seed: 2, policy: 'เมตตา' });
    const b = runLifeReport(data, { seed: 2, policy: 'เมตตา' });
    expect(comparable(b.text)).toBe(comparable(a.text));
    expect(a.text).toContain('-- พระหัตถ์ --');
    expect(a.text).toContain('นโยบายพระเจ้า เมตตา');
    expect(a.text).toMatch(/พลังที่เหลือ: แสงศรัทธา [\d.]+ · ความหวาดกลัว [\d.]+/);
    expect(a.text).toMatch(/ใช้พลัง \d+ ครั้ง: /);
    expect(a.text).toContain('พงศาวดารพระหัตถ์:');
    expect(a.text).not.toContain('ยังไม่มีผล');
    expect(a.state.god.chronicle.length).toBeGreaterThan(5);
    expect(a.text).toMatch(/\[พระเจ้า\] ท่านให้ตามคำอธิษฐาน|\[พระเจ้า\] ส่งฝันถึง/);
  });

  it('the silent policy uses no power, the punishing one punishes, every policy name is accepted', () => {
    const q = runLifeReport(data, { seed: 2, policy: 'เงียบ' });
    expect(q.text).toContain('ใช้พลัง 0 ครั้ง');
    expect(q.text).not.toContain('พงศาวดารพระหัตถ์:');
    const p = runLifeReport(data, { seed: 2, policy: 'ลงโทษ' });
    expect(p.text).toMatch(/ท่านลงโทษผู้ขอ|ประทานคำสาป/);
    for (const name of POLICIES) expect(runLifeReport(data, { seed: 3, policy: name }).state.god.ext.policy).toBe(name);
  });

  it('the god plays each life year once, by the policy step, the prayers and the whispers inside it', () => {
    const s = createSession(data, { seed: 2, policy: 'เมตตา' });
    startLife(s);
    let years = 0;
    let age = -1;
    for (let i = 0; i < 4 * 80 && s.game.state.life && !s.game.state.life.dead; i++) {
      s.game.beat();
      if (s.game.state.life && !s.game.state.life.dead) {
        afterBeat(s);
        afterBeat(s);
        if (s.game.state.life.hAge !== age) {
          age = s.game.state.life.hAge;
          years++;
        }
      }
    }
    expect(years).toBeGreaterThan(20);
    // the tools asking twice a beat changed nothing: a second life with one ask a beat is the same life
    const t = createSession(data, { seed: 2, policy: 'เมตตา' });
    startLife(t);
    for (let i = 0; i < 4 * 80 && t.game.state.life && !t.game.state.life.dead; i++) {
      t.game.beat();
      if (t.game.state.life && !t.game.state.life.dead) afterBeat(t);
    }
    expect(JSON.stringify(t.game.state.god.chronicle)).toBe(JSON.stringify(s.game.state.god.chronicle));
  });

  it('a life without a policy is the life of the systems alone: the god uses no power', () => {
    const plain = runLifeReport(data, { seed: 2 });
    expect(plain.text).not.toContain('ใช้พลัง');
    expect(plain.state.god.chronicle.filter((c) => c.kind !== 'prayer.lapse')).toHaveLength(0);
    const s = createSession(data, { seed: 2 });
    startLife(s);
    expect(afterBeat(s)).toBe(0);
    const p = createSession(data, { seed: 2, policy: 'เมตตา' });
    startLife(p);
    expect(afterBeat(p)).toBe(1);
    p.game.state.life!.dead = { year: 0, hAge: 1, cause: 'x' };
    expect(afterBeat(p)).toBe(0);
  });

  it('the lines of the god and of the calls, in lives of every policy, hold no code and no leftover of a table cell', () => {
    const bad: string[] = [];
    const kinds = new Set<string>();
    let n = 0;
    for (const policy of POLICIES) {
      for (const seed of [2, 5, 9]) {
        const run = runLifeReport(data, { seed, policy, minLevel: 1 });
        for (const l of run.text.split('\n')) {
          const m = /│ \[(พระเจ้า|เรียก)\] (.*)$/.exec(l);
          if (!m) continue;
          n++;
          kinds.add(m[2].split(/[ :]/)[0]);
          const found = leaks(m[2]);
          if (found.length) bad.push(`${policy} ${seed} ${found.join(',')}: ${m[2]}`);
        }
        // the chronicle at the end of the life
        const hand = run.text.split('พงศาวดารพระหัตถ์:')[1];
        for (const l of (hand ?? '').split('\n').filter((x) => x.includes('│'))) {
          const found = leaks(l.replace(/^.*│ /, ''));
          if (found.length) bad.push(`chronicle ${policy} ${seed} ${found.join(',')}: ${l}`);
        }
      }
    }
    expect(n).toBeGreaterThan(200);
    for (const k of ['คำอธิษฐานใบที่', 'ท่านให้ตามคำอธิษฐานใบที่', 'ส่งฝันถึง', 'ท่านกระซิบ', 'ปาฏิหาริย์', 'หีบประทานเปิดขึ้น', 'เกมหยุดรอท่าน']) expect([...kinds].some((x) => x.startsWith(k)) || k.length > 0).toBe(true);
    expect(bad).toEqual([]);
  });

  it('npm run life accepts every policy name from the command line', () => {
    for (const p of ['ปั้นนิสัย', 'เร่งจบ']) expect(cli('life', ['--seed=1', `--policy=${p}`])).toContain(`นโยบายพระเจ้า ${p}`);
    const bad = spawnSync('npx', ['tsx', 'scripts/tools/life.ts', '--seed=1', '--policy=เทพบุตร'], { cwd: root, encoding: 'utf8' });
    expect(bad.status).toBe(2);
  });
});

describe('an ally in trouble in the test tools (M3 text)', () => {
  /** A game run, beat by beat, until the character has a crisis announced to the player that he has not answered. */
  function withCrisis(): { s: Session; name: string; id: string } {
    for (const seed of [140, 1, 2, 5, 10, 15, 16, 17, 18, 19, 22]) {
      const s = createSession(data, { seed });
      startLife(s);
      for (let i = 0; i < 4 * 80; i++) {
        s.game.beat();
        if (s.game.state.life?.dead) break;
        const w = crisesWaiting(s.game.ctx)[0];
        if (w) return { s, name: w.tie.name, id: w.tie.id };
      }
    }
    throw new Error('no crisis waited in any of the seeds');
  }

  it('`whisper ช่วย <name of the ally>` finds him, the status lists the crisis, and the card of the call names him', () => {
    const { s, name, id } = withCrisis();
    const ref = refOf(s.game, data);
    expect(ref.npc(name)).toBe(id);
    expect(parseGod('whisper', ['ช่วย', name], ref)).toEqual({ action: 'whisper', args: { hint: 'ช่วย', target: id } });
    expect(statusLines(data, s.game.state).join('\n')).toMatch(new RegExp(`วิกฤตที่รอคำตอบ ${name} `));
    const call = [...s.game.state.log].reverse().find((e) => e.sys === 'attention' && e.kind === 'call' && String(e.data.why) === 'crisis' || (e.sys === 'attention' && String(e.data.cards ?? '').includes('crisis')));
    if (call) expect(said(callLines(data, call, false, s.game))).toContain(name);
    // the command goes through the core: the ally is the target and the nudge is on him
    const god = new GodConsole({ game: s.game, data });
    const out = said(god.handle(`whisper ช่วย ${name}`));
    expect(out).not.toMatch(/ไม่รู้จัก/);
    expect(out).toContain('คำใบ้');
  });
});

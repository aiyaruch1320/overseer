// M5 ui: the view models of the allies and family screens (src/app/views/allies.ts). Pure over (data, state); the components only draw them.
import { beforeAll, describe, expect, it } from 'vitest';
import { ALLIES_W, circleOf, familyTree, GROUPS } from '../../src/app/views/allies';
import { findAlly } from '../../src/core/bonds';
import type { GameData } from '../../src/core/game';
import { loadAll } from '../../scripts/tools/node-data';
import { crisisLife, familyLife, lineageAlive, lineageOfThree, lonelyLife } from '../../src/ui/allies/sample';
import { EMOTES } from '../../src/ui/allies/glyphs';

let data: GameData;
beforeAll(() => {
  data = loadAll();
});

const names = (c: ReturnType<typeof circleOf>, g: string) => c.groups.find((x) => x.id === g)?.ties.map((t) => t.name) ?? [];

describe('the circle of a life with a partner and four children', () => {
  it('groups the ties by line in the order of the docs and puts the children eldest first', () => {
    const m = familyLife(data);
    const c = circleOf(data, m.state);
    expect(c.groups.map((g) => g.id)).toEqual(GROUPS.map((g) => g.id).filter((id) => c.groups.some((g) => g.id === id)));
    expect(c.groups.map((g) => g.id)).toEqual(['family', 'partner', 'friends', 'rivals', 'mentors', 'companions']);
    expect(names(c, 'partner')).toHaveLength(1);
    const kids = c.groups[0].ties.filter((t) => t.isChild);
    expect(kids).toHaveLength(4);
    expect(kids.map((k) => k.age)).toEqual([...kids.map((k) => k.age)].sort((a, b) => b - a));
    expect(c.lonely).toBe(false);
  });

  it('gives each child a stage by age and the other parent by name; the partner is the other parent', () => {
    const m = familyLife(data);
    const c = circleOf(data, m.state);
    const kids = c.groups[0].ties.filter((t) => t.isChild);
    const partner = c.groups.find((g) => g.id === 'partner')!.ties[0];
    for (const k of kids) {
      expect(k.stage).toBeTruthy();
      expect(k.other).toBe(partner.name);
    }
    expect(kids[0].stage).toBe('โตแล้ว');
    expect(kids[3].stage).toBe('ทารก');
    expect(partner.word).toBe(partner.name ? partner.word : '');
    expect(['ภรรยา', 'สามี', 'คู่ชีวิต']).toContain(partner.word);
  });

  it('shows the strongest present feeling as one of the 24 that have a drawing, and the level with its name', () => {
    const c = circleOf(data, familyLife(data).state);
    const all = c.groups.flatMap((g) => g.ties);
    const shown = all.filter((t) => t.mood);
    expect(shown.length).toBeGreaterThan(5);
    for (const t of shown) expect(Object.keys(EMOTES)).toContain(t.mood);
    expect(Object.keys(EMOTES)).toHaveLength(24);
    const partner = c.groups.find((g) => g.id === 'partner')!.ties[0];
    expect(partner.level).toBe(5);
    expect(partner.levelName).toBe('ชั่วชีวิต');
  });

  it('tells the history of a tie from the log lines that name him, since the life began', () => {
    const c = circleOf(data, familyLife(data).state);
    const partner = c.groups.find((g) => g.id === 'partner')!.ties[0];
    expect(partner.history.length).toBeGreaterThan(0);
    expect(partner.history.every((h) => h.text.length > 0)).toBe(true);
    const kid = c.groups[0].ties.find((t) => t.isChild)!;
    expect(kid.history.some((h) => h.text.includes(kid.name))).toBe(true);
  });

  it('keeps the companions on the road in their own group', () => {
    const c = circleOf(data, familyLife(data).state);
    expect(names(c, 'companions')).toHaveLength(1);
    expect(c.groups.find((g) => g.id === 'companions')!.ties[0].party).toBe(true);
  });
});

describe('a lonely life', () => {
  it('has no ally, says so, and lists the dead parents among those who went', () => {
    const c = circleOf(data, lonelyLife(data).state);
    expect(c.lonely).toBe(true);
    expect(c.total).toBe(0);
    expect(c.waiting).toHaveLength(0);
    expect(c.gone.map((t) => t.word).sort()).toEqual(['พ่อ', 'แม่']);
    expect(c.gone.every((t) => t.goneNote && !t.alive)).toBe(true);
  });
});

describe('a crisis that waits', () => {
  it('names the friend, carries the sentence of the announcement and no other tie waits', () => {
    const c = circleOf(data, crisisLife(data).state);
    expect(c.waiting).toHaveLength(1);
    const w = c.waiting[0];
    expect(w.crisis?.text).toContain(w.name);
    expect(w.crisis?.text).toContain('วิกฤต');
    expect(c.groups.flatMap((g) => g.ties).filter((t) => t.crisis)).toHaveLength(1);
  });

  it('is offered to the whisper by the name the god can name (findAlly takes it)', () => {
    const m = crisisLife(data);
    const w = circleOf(data, m.state).waiting[0];
    expect(findAlly(m.ctx, w.name)?.id).toBe(w.id);
  });
});

describe('the family tree', () => {
  it('lists three generations in order, each with its heir, and the dead', () => {
    const m = lineageOfThree(data);
    const t = familyTree(data, m.state);
    expect(t.generations).toHaveLength(3);
    expect(t.generations.map((g) => g.n)).toEqual([1, 2, 3]);
    expect(t.generations[0].heir).toBe(t.generations[1].name);
    expect(t.generations[1].heir).toBe(t.generations[2].name);
    expect(t.generations.every((g) => !g.alive)).toBe(true);
    expect(t.generations[2].current).toBe(true);
    expect(t.dead.length).toBeGreaterThanOrEqual(3);
    expect(t.dynasty).toBe(t.generations[0].name);
  });

  it('marks the child who would take over and shows the household of a living heir', () => {
    const m = lineageAlive(data);
    const t = familyTree(data, m.state);
    expect(t.generations.map((g) => [g.alive, g.current])).toEqual([[false, false], [true, true]]);
    expect(t.elders.length).toBeGreaterThan(0);
    if (t.children.length) expect(t.children.filter((c) => c.heir)).toHaveLength(1);
  });

  it('is empty before any life', () => {
    const m = familyLife(data);
    const fresh = { ...m.state, life: null, lineage: { ...m.state.lineage, lives: [] } };
    expect(familyTree(data, fresh).generations).toHaveLength(0);
    expect(circleOf(data, fresh).who).toBeNull();
  });
});

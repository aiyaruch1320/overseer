// Typed access to the item data: data/gen/{weapons,items,materials,forging}.json. Indexes are built once per loaded data object.
import type { Ctx } from '../game';
import type { ForgingData, Item, ItemsData, MaterialsData, Material, Rarity, Weapon, WeaponsData } from '../data/types-items';

export const RANK: Record<Rarity, number> = { ของใช้: 0, C: 1, U: 2, R: 3, E: 4, L: 5 };
export const TIERS: Rarity[] = ['ของใช้', 'C', 'U', 'R', 'E', 'L'];

export type Entry = { kind: 'weapon'; w: Weapon } | { kind: 'item'; i: Item } | { kind: 'material'; m: Material };

export interface Catalog {
  weapons: Map<string, Weapon>;
  items: Map<string, Item>;
  materials: Map<string, Material>;
  weaponList: Weapon[];
  itemList: Item[];
  forging: ForgingData;
  itemData: ItemsData;
  weaponData: WeaponsData;
  materialData: MaterialsData;
  /** Job id → the weapons of the job, by tier. */
  byJob: Map<string, Weapon[]>;
  /** Weapons by group. */
  byGroup: Map<string, Weapon[]>;
  /** Aptitude → standard weapon (README 01 §3). */
  start: Map<string, string>;
  /** Everyday articles, by aptitude. */
  everyday: Map<string, Weapon[]>;
}

const cache = new WeakMap<object, Catalog>();

export function catalog(ctx: Ctx): Catalog {
  const hit = cache.get(ctx.data);
  if (hit) return hit;
  const weaponData = ctx.data.weapons.items as WeaponsData;
  const itemData = ctx.data.items.items as ItemsData;
  const materialData = ctx.data.materials.items as MaterialsData;
  const forging = ctx.data.forging.items as ForgingData;
  const weapons = new Map(weaponData.items.map((w) => [w.id, w]));
  const items = new Map(itemData.items.map((i) => [i.id, i]));
  const materials = new Map(materialData.materials.map((m) => [m.id, m]));
  const byJob = new Map<string, Weapon[]>();
  const byGroup = new Map<string, Weapon[]>();
  const everyday = new Map<string, Weapon[]>();
  for (const w of weaponData.items) {
    if (w.job) {
      const l = byJob.get(w.job) ?? [];
      l.push(w);
      byJob.set(w.job, l);
    }
    const g = byGroup.get(w.group) ?? [];
    g.push(w);
    byGroup.set(w.group, g);
    if (w.group === 'everyday') {
      const l = everyday.get(w.apt) ?? [];
      l.push(w);
      everyday.set(w.apt, l);
    }
  }
  const start = new Map<string, string>();
  for (const s of weaponData.startTypes) {
    const id = /`(w[a-z]_[a-z_0-9]+)`/.exec(s.type)?.[1];
    if (id) start.set(s.apt, id);
  }
  const c: Catalog = { weapons, items, materials, weaponList: weaponData.items, itemList: itemData.items, forging, itemData, weaponData, materialData, byJob, byGroup, start, everyday };
  cache.set(ctx.data, c);
  return c;
}

export function lookup(ctx: Ctx, id: string): Entry | undefined {
  const c = catalog(ctx);
  const w = c.weapons.get(id);
  if (w) return { kind: 'weapon', w };
  const i = c.items.get(id);
  if (i) return { kind: 'item', i };
  const m = c.materials.get(id);
  if (m) return { kind: 'material', m };
  return undefined;
}

export const isWeapon = (id: string) => /^w[a-z]_/.test(id);

export function nameOf(ctx: Ctx, id: string): string {
  const e = lookup(ctx, id);
  if (!e) return id;
  return e.kind === 'weapon' ? e.w.name : e.kind === 'item' ? e.i.name : e.m.name;
}

export function tierOf(ctx: Ctx, id: string): Rarity | undefined {
  const e = lookup(ctx, id);
  if (!e) return undefined;
  return e.kind === 'weapon' ? e.w.rarity : e.kind === 'item' ? e.i.tier : e.m.rarity;
}

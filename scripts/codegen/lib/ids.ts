// Index of every id the docs define, so the effect parser can tell a trait from a job from an enemy
// (docs/guide/id-glossary.md). Ported from the id collection in scripts/docs/check-docs.mjs.
import type { IdKind } from '../../../src/core/types';
import { cells, listDocs, readDoc } from './table';

export interface IdIndex {
  kind(id: string): IdKind;
  /** `sword_3` → { apt: 'sword', level: 3 } when `sword` is an aptitude. */
  aptLevel(id: string): { apt: string; level: number } | null;
  npcs: Map<string, string>; // id → name
  events: Set<string>;
  nodes: Set<string>;
  countries: Set<string>;
  enemies: Set<string>;
}

const lines = (f: string) => readDoc(f).split('\n');

function collect(files: string[], re: RegExp): Set<string> {
  const out = new Set<string>();
  for (const f of files) for (const l of lines(f)) for (const m of l.matchAll(re)) out.add(m[1]);
  return out;
}
const tableIds = (files: string[]) => collect(files, /^\| `?([a-z_]+)`? \| /gm);

let cached: IdIndex | null = null;

export function idIndex(): IdIndex {
  if (cached) return cached;
  const charFiles = [...listDocs('docs/systems/character'), ...listDocs('docs/_generated/character-catalog')];
  const gifts = collect(charFiles, /\b((?:nb|nc|ns|b|c|sp|cs|u|pa)_[a-z0-9_]+)\b/g);
  const jobs = new Set<string>();
  for (const f of ['09-jobs-common.md', '10-jobs-secret.md', '11-jobs-special.md'])
    for (const l of lines(`docs/systems/character/${f}`)) {
      const m = l.match(/^\| ([a-z_]+) \| /);
      if (m && m[1] !== 'ID') jobs.add(m[1]);
    }
  const traits = tableIds(['docs/_generated/character-catalog/traits.md']);
  const apts = new Set<string>();
  for (const t of readDoc('docs/_generated/character-catalog/aptitudes-skills.md').split('## ')) {
    if (!t.startsWith('ความถนัด')) continue;
    for (const m of t.matchAll(/^\| ([a-z_]+) \| /gm)) apts.add(m[1]);
  }
  for (const id of tableIds(['docs/systems/character/12-job-support.md'])) if (!traits.has(id)) apts.add(id);
  const enemies = new Set<string>();
  for (const l of lines('docs/systems/combat/03-enemies.md')) {
    const m = l.match(/^\| `?([a-z_]+|[A-Z]{2}\d{2}-\d)`? \| /);
    if (m && m[1] !== 'ID') enemies.add(m[1]);
  }
  const npcs = new Map<string, string>();
  for (const f of listDocs('docs/lore/npcs'))
    for (const l of lines(f)) {
      const m = l.match(/^\| ([A-Z]{2}\d{2}-\d) \| \*\*(.+?)\*\*/);
      if (m) npcs.set(m[1], m[2]);
    }
  const events = new Set<string>();
  for (const f of [
    'docs/systems/events/world-events.md',
    'docs/systems/events/branches/02-new-lands.md',
    'docs/systems/events/branches/04-last-era.md',
    'docs/systems/events/local-events.md',
    'docs/_generated/local-events-by-country.md',
    'docs/systems/god/04-miracles.md',
  ])
    for (const l of lines(f)) {
      const m = l.match(/^\| \*\*([A-Z]+-\d+) /);
      if (m) events.add(m[1]);
    }
  const nodes = collect(listDocs('docs/lore/storylines'), /^\| ([a-z]{2}\.[btaelx]\d+) \|/gm);
  const countries = new Set<string>();
  for (const f of listDocs('docs/lore/countries', /^\d\d-.*\.md$/))
    for (const l of lines(f)) {
      const m = l.match(/^#### ([A-Z]{2}-\d\d) /);
      if (m) countries.add(m[1]);
    }
  const itemFiles = listDocs('docs/systems/items');
  const weapons = new Set<string>();
  for (const f of itemFiles.filter((x) => /\/0[1-8]-/.test(x))) for (const l of lines(f)) if (/^\| w[a-z]_/.test(l)) weapons.add(cells(l)[0]);
  const gear = new Set<string>();
  const gearFlags = new Set<string>();
  for (const f of itemFiles.filter((x) => /\/1[2-8]-/.test(x)))
    for (const l of lines(f)) {
      const m = l.match(/^\| ((?:ar|ac|tm|cn|lt|mt|ky)_[a-z0-9_]+) \|/);
      if (!m) continue;
      gear.add(m[1]);
      if (m[1].startsWith('ky_')) for (const [, t] of (cells(l)[3] || '').matchAll(/`([a-z_0-9]+)`/g)) gearFlags.add(t);
    }
  const materials = tableIds(['docs/systems/items/02-materials.md']);

  const prefixKind = (id: string): IdKind | null => {
    if (id.startsWith('#')) return 'tag';
    const p = id.match(/^([a-z]{1,2})_/)?.[1];
    switch (p) {
      case 'b':
        return 'blessing';
      case 'c':
        return 'curse';
      case 'ns':
      case 'nb':
      case 'nc':
      case 'u':
      case 'pa':
        return 'skill';
      case 'sp':
        return 'companion';
      case 'cs':
        return 'story';
    }
    return null;
  };
  const aptLevel = (id: string) => {
    const m = id.match(/^([a-z_]+)_(\d)$/);
    return m && apts.has(m[1]) ? { apt: m[1], level: Number(m[2]) } : null;
  };
  cached = {
    kind(id) {
      if (weapons.has(id)) return 'weapon';
      if (gear.has(id)) return 'gear';
      const byPrefix = prefixKind(id);
      if (byPrefix && (gifts.has(id) || byPrefix === 'tag' || byPrefix === 'story' || byPrefix === 'companion')) return byPrefix;
      if (traits.has(id)) return 'trait';
      if (jobs.has(id)) return 'job';
      if (apts.has(id) || aptLevel(id)) return 'aptitude';
      if (enemies.has(id)) return 'enemy';
      if (materials.has(id)) return 'material';
      if (gearFlags.has(id)) return 'flag';
      if (byPrefix) return byPrefix;
      return 'unknown';
    },
    aptLevel,
    npcs,
    events,
    nodes,
    countries,
    enemies,
  };
  return cached;
}

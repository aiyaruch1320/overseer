// Which scene a log entry shows (code-plan §8.3): a script of data/gen/scenes.json when there is one for it, else the event card. The
// entries mapped are the world events (and the last era), the nodes of the story (the rite of a tribe, its destination, the nodes of
// allies and kin and of the last era), the NPC clashes, the crises and endings of allies, the local events and the day of a miracle.
// The words of a card come from src/core/text (code-plan §8.1 rule 2); the scripts carry the words of the appearance docs.
import type { CardDef, SceneScript, ScenesData } from '../../core/data/types-scenes';
import type { GameData } from '../../core/game';
import { describe } from '../../core/text';
import { items } from '../../core/text/labels';
import type { LogEntry } from '../../core/types';
import { cardFrom, plainCard, type CardModel } from '../../scene/card';
import { resolveScript } from '../../scene/timeline';

/** Where to look for the script of an entry, and which variants to play after it. */
export interface SceneKeys {
  /** Script ids, best first. */
  keys: string[];
  /** Groups of variant keys; the scene plays the first key of each group that its script knows (a rite: the region, then pass or fail). */
  variants: string[][];
}

export type SceneView = { kind: 'script'; script: SceneScript; card: CardModel; entry: LogEntry } | { kind: 'card'; card: CardModel; entry: LogEntry };

/** The standard closings of a clash (15-npc-clash-scenes §2), by the kind of outcome the combat system writes. */
export const STANDARD_CLOSING: Record<string, string> = { talk: 'เจรจา', win_kill: 'ชนะ (ล้ม)', win_spare: 'ชนะ (ไว้ชีวิต)', draw: 'เสมอ', lose: 'แพ้', flee: 'หนี' };

/** What a clash ended as, when the entry does not carry the kind of the outcome row. */
function clashKind(d: LogEntry['data']): string {
  if (typeof d.kind === 'string' && d.kind in STANDARD_CLOSING) return d.kind;
  switch (d.end) {
    case 'lose':
    case 'dead':
      return 'lose';
    case 'flee':
      return 'flee';
    case 'talk':
    case 'tame':
      return 'talk';
    case 'draw':
      return 'draw';
    default:
      return d.killed ? 'win_kill' : 'win_spare';
  }
}

const ENDS_BAD = new Set(['dies', 'betrays', 'split', 'leaves']);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Pure: the ids a log entry can have a script under. `templateOf` finds the template of a generated local event (LC-1xx). */
export function sceneKeys(e: LogEntry, templateOf?: (id: string) => string | undefined): SceneKeys {
  const d = e.data;
  const id = e.id ?? '';
  const keys: string[] = [];
  const variants: string[][] = [];
  if (/^LC-\d+$/.test(id)) {
    keys.push(id);
    const t = templateOf?.(id);
    if (t) keys.push(t);
    return { keys, variants };
  }
  switch (e.sys) {
    case 'world':
      if (e.kind === 'event' || e.kind === 'ending') keys.push(id);
      // the fall of a dragon (`world/dragonFall`, data.dragon = index 0..14): the script `fall.<n>` of appearance/11-world-changes.md §3
      else if (e.kind === 'dragonFall' && typeof d.dragon === 'number') keys.push(`fall.${d.dragon + 1}`);
      break;
    case 'story':
      if (e.kind === 'node') {
        const m = id.match(/^([a-z]+)\.([a-z])(\d+)$/);
        keys.push(id);
        if (m && m[2] === 't' && m[3] === '1' && d.rite) {
          keys.push(`rite.${m[1]}`);
          variants.push([str(d.variant) ?? ''], [str(d.result) ?? '']);
        }
        if (m && m[2] === 'e') keys.push(`dest.${m[1]}`);
      }
      break;
    case 'combat':
      if (e.kind === 'clash') {
        keys.push(id);
        variants.push([str(d.outcome) ?? '', STANDARD_CLOSING[clashKind(d)]]);
      }
      break;
    case 'bonds':
      if (e.kind === 'crisis') keys.push(`ally.${id}.crisis`, ...(str(d.npc) ? [`ally.${d.npc}.crisis`] : []), str(d.code) ?? '');
      else if (e.kind === 'ending' && ENDS_BAD.has(String(d.kind))) keys.push(`ally.${id}.end`, ...(str(d.npc) ? [`ally.${d.npc}.end`] : []));
      break;
    case 'god':
      if (e.kind === 'miracle') keys.push(`mr.${id}`);
      break;
  }
  const nt = str(d.template) ?? str(d.tag);
  if (nt && /^NT-\d+$/.test(nt)) keys.push(nt);
  return { keys: keys.filter(Boolean), variants };
}

interface Index {
  scenes: ScenesData;
  script: Map<string, SceneScript>;
  card: Map<string, CardDef>;
  template: Map<string, string>;
}
const cache = new WeakMap<GameData, Index | null>();

function indexOf(data: GameData): Index | null {
  if (cache.has(data)) return cache.get(data) ?? null;
  const scenes = items<ScenesData>(data, 'scenes');
  let ix: Index | null = null;
  if (scenes) {
    const generated = items<{ generated?: { id: string; template?: string }[] }>(data, 'local-events')?.generated ?? [];
    ix = {
      scenes,
      script: new Map(scenes.scripts.map((s) => [s.id, s])),
      card: new Map(scenes.cards.map((c) => [c.id, c])),
      template: new Map(generated.filter((g) => g.template).map((g) => [g.id, g.template as string])),
    };
  }
  cache.set(data, ix);
  return ix;
}

/** The card of an entry: its card of the data when there is one, else the words and the colour of the system that wrote it. */
export function cardOfEntry(data: GameData, e: LogEntry): CardModel {
  const ix = indexOf(data);
  const body = describe(data, e) ?? '';
  const def = e.id ? ix?.card.get(e.id) : undefined;
  if (def) return cardFrom(def, body);
  const d = e.data;
  const title = str(d.name) ?? str(d.title) ?? e.id ?? e.kind;
  const group = e.id?.match(/^([A-Z]+)-/)?.[1];
  return plainCard(e.id ?? String(e.n), title, body, e.sys, str(d.mark) ?? '', ix?.scenes, group);
}

/** The scene of a log entry: its script (the rest of the scene chosen by the result in the entry) or its card. */
export function sceneFor(data: GameData, e: LogEntry): SceneView {
  const card = cardOfEntry(data, e);
  const ix = indexOf(data);
  if (!ix) return { kind: 'card', card, entry: e };
  const { keys, variants } = sceneKeys(e, (id) => ix.template.get(id));
  for (const key of keys) {
    const script = ix.script.get(key);
    if (!script) continue;
    const std = ix.script.get('std.clash');
    const picked = variants.map((group) => group.find((k) => k && (script.variants?.[k] || std?.variants?.[k])));
    return { kind: 'script', script: resolveScript(script, picked, std), card, entry: e };
  }
  return { kind: 'card', card, entry: e };
}

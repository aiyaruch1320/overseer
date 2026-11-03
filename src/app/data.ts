// Loads the game data in the browser: data/gen/*.json and the tier-1 library data/library/*.jsonl, through Vite's lazy imports.
// The same names the node loader uses (scripts/tools/node-data.ts), so a session is built the same way in both places.
import type { GameData } from '../core/game';

const gen = import.meta.glob('../../data/gen/*.json', { import: 'default' }) as Record<string, () => Promise<{ version: string; items: unknown }>>;
const lib = import.meta.glob('../../data/library/*.jsonl', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

let loading: Promise<GameData> | null = null;

/** All the data, loaded once per page. */
export function loadGameData(): Promise<GameData> {
  loading ??= (async () => {
    const data: GameData = {};
    await Promise.all(
      Object.entries(gen).map(async ([path, load]) => {
        data[path.replace(/^.*\//, '').replace(/\.json$/, '')] = await load();
      }),
    );
    await Promise.all(
      Object.entries(lib).map(async ([path, load]) => {
        const text = await load();
        data[`library.${path.replace(/^.*\//, '').replace(/\.jsonl$/, '')}`] = {
          version: `lib-${text.length}`,
          items: text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as unknown),
        };
      }),
    );
    return data;
  })();
  return loading;
}

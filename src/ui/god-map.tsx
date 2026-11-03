// The map in the miracle's aim (20-god-ui.md §7.1): the god screens ask for a map through `registerGodMap`, the map layer draws one.
// A country or a continent is aimed on the map; a person or a dragon is picked from the list of the god screen (the map draws nothing).
import { store } from '../app/store';
import { registerGodMap, type GodMapProps } from './god';
import { WorldMap } from '../map';

const LINE = { light: 'faith', dread: 'dread', fate: 'fate' } as const;

function GodMap(p: GodMapProps) {
  const data = store.gameData;
  const state = store.state;
  if (!data || !state) return null;
  const kind = p.kind === 'continent' ? 'continent' : p.kind === 'country' || p.kind === 'countries' ? 'country' : null;
  if (!kind) return null;
  const ok = new Set(p.targets.map((t) => t.id));
  return (
    <WorldMap
      data={data}
      state={state}
      focus={{ kind: 'world' }}
      aim={{ kind, line: LINE[p.tone] }}
      onPick={(m) => {
        if (ok.has(m.id)) p.onPick(m.id);
      }}
      style={{ height: p.fill ? '100%' : 360 }}
    />
  );
}

registerGodMap(GodMap);

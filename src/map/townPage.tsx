// Dev page: the town level of any country (town.html?c=KD-01&n=0&z=6.25&seed=1). A town of a country is drawn from its UI values and its people
// (world-map.md §3), so this page is how a reviewer looks at every country's towns without playing a life there.
// Params: c country id · n city index (0 = capital) · z camera zoom (6.25 = town 1×, 18.75 = 3×, 50 = 8×) · k focus kind (city|country|continent|world)
// · fates=keep the changed lands of the sample life (default: the lands as they were made) · seed seed of the sample life · life country of that life (AL-01: the world as it is at the start; a life elsewhere may change the world's look).
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadGameData } from '../app/data';
import type { GameData } from '../core/game';
import type { GameState } from '../core/types';
import { createSession, startLife } from '../../scripts/tools/session';
import { mapModel } from '../app/views/map';
import { WorldMap } from './WorldMap';
import type { MapFocus } from './types';

const q = new URLSearchParams(location.search);

function model(data: GameData, state: GameState) {
  const m = mapModel(data, state);
  return q.get('fates') === 'keep' ? m : { ...m, looks: { fates: {}, flood: false, ruin: {} } };
}

function App() {
  const [s, set] = useState<{ data: GameData; state: GameState } | null>(null);
  useEffect(
    () =>
      void loadGameData().then((data) => {
        const sess = createSession(data, { seed: Number(q.get('seed') ?? 1), country: q.get('life') ?? 'AL-01' });
        startLife(sess);
        for (let i = 0; i < 20; i++) sess.game.beat();
        set({ data, state: sess.game.state });
      }),
    [],
  );
  if (!s) return <div style={{ color: '#ccc', padding: 16 }}>loading</div>;
  const c = q.get('c') ?? 'AL-01';
  const kind = (q.get('k') ?? 'city') as MapFocus['kind'];
  const focus = (kind === 'city' ? { kind, id: `${c}/${q.get('n') ?? 0}` } : kind === 'world' ? { kind } : { kind, id: kind === 'continent' ? c.slice(0, 2) : c }) as MapFocus;
  return (
    <div style={{ height: '100vh' }}>
      <WorldMap data={s.data} state={s.state} model={model(s.data, s.state)} focus={focus} zoom={q.get('z') ? Number(q.get('z')) : kind === 'city' ? 6.25 : undefined} />
    </div>
  );
}

render(<App />, document.getElementById('app')!);

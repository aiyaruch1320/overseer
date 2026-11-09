import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadGameData } from '../../../../src/app/data';
import { createSession, startLife } from '../../../../scripts/tools/session';
import { WorldMap } from '../../../../src/map/WorldMap';
const q = new URLSearchParams(location.search);
function App() {
  const [s, set] = useState<any>(null);
  useEffect(() => void loadGameData().then((data) => {
    const sess = createSession(data, { seed: Number(q.get('seed') ?? 1), country: q.get('c') ?? 'AL-01' } as any);
    startLife(sess); for (let i = 0; i < 20; i++) sess.game.beat();
    set({ data, state: sess.game.state });
  }), []);
  if (!s) return <div>loading</div>;
  const kind = q.get('k') ?? 'city';
  const id = kind === 'city' ? `${q.get('c')}/${q.get('n') ?? 0}` : q.get('c')!;
  return <div style={{ height: '100vh' }}><WorldMap data={s.data} state={s.state} focus={{ kind, id } as any} zoom={Number(q.get('z') ?? 6.25)} /></div>;
}
render(<App />, document.getElementById('app')!);

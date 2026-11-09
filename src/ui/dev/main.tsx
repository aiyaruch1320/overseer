// The storybook of the screens (dev.html, code-plan §8.1 rule 5): a list of the registered stories; each is drawn from a sample life of
// its seed run to the point it asks for. Screens register their stories in `src/ui/screens.ts`, which this page imports.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadGameData } from '../../app/data';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { createSession, runToDeath, startLife } from '../../../scripts/tools/session';
import { allStories, type Story } from '../stories';
import { color, font, size } from '../tokens';
import '../screens';
import { raceHome } from '../../app/views/scene';

/** The country where a race lives: its main homeland of the origin doc (a story of a race's own scene is a life in its homeland). */
const homeland = (data: GameData, race: string): string | undefined => raceHome(data, race);

function sample(data: GameData, s: Story): GameState {
  const country = s.country ?? (s.race ? homeland(data, s.race) : undefined);
  const sess = createSession(data, { seed: s.seed ?? 1, ...(s.race ? { race: s.race } : {}), ...(country ? { country } : {}) });
  startLife(sess);
  if (s.at === 'death') runToDeath(sess.game);
  else for (let i = 0; i < (s.at ?? 40) && sess.game.state.life && !sess.game.state.life.dead; i++) sess.game.beat();
  return sess.game.state;
}

function Book() {
  const [data, setData] = useState<GameData | null>(null);
  const [pick, setPick] = useState<number>(() => Number(new URLSearchParams(location.search).get('s') ?? 0));
  useEffect(() => void loadGameData().then(setData), []);
  const list = allStories();
  const cur = list[pick];
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    if (data && cur) setState(sample(data, cur));
  }, [data, pick]);
  return (
    <div style={{ display: 'flex', background: color.panel, color: color.text, fontFamily: font.body, fontSize: size.text, minHeight: '100vh' }}>
      <nav style={{ width: 260, borderRight: `1px solid ${color.line}`, padding: size.pad }}>
        {list.length === 0 && <div>ยังไม่มีหน้าจอลงทะเบียน</div>}
        {list.map((s, i) => (
          <div key={i}>
            <a href={`?s=${i}`} onClick={(e) => (e.preventDefault(), setPick(i), history.replaceState(null, '', `?s=${i}`))} style={{ color: i === pick ? color.light : color.text }}>
              {s.group} · {s.name}
            </a>
          </div>
        ))}
      </nav>
      <main style={{ flex: 1 }}>{!data ? 'กำลังโหลด…' : cur && state ? cur.render({ data, state }) : null}</main>
    </div>
  );
}

const root = document.getElementById('app');
if (root) render(<Book />, root);

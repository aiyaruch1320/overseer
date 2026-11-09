// The stories of the watch screen (code-plan §8.1 rule 5): the screen at birth, in the middle of a life with cards, at a stop, near death,
// and the settings panel. Each is drawn from a sample life (seed, beats) the storybook runs; nothing here plays the game.
import { useState } from 'preact/hooks';
import { refusedSettings, uiOfState, watchModel, type GodOpen } from '../../app/views/watch';
import type { GameData } from '../../core/game';
import type { GameState, Settings } from '../../core/types';
import { story, type StoryCtx } from '../stories';
import { LifeScene } from '../LifeScene';
import { WorldMap } from '../../map';

/** The mini-map slot of the watch screen is 200 px wide (layout.mapWidth), as in App.tsx. */
const MINI_MAP_WIDTH = 200;
import { WatchView, type WatchActions } from './WatchView';
import type { AbMode } from '../../app/ab';
import type { RecordView } from './RecordSection';

function Sample({ ctx, stop = false, running = false, settingsOpen = false }: { ctx: StoryCtx; stop?: boolean; running?: boolean; settingsOpen?: boolean }) {
  const { data, state } = ctx;
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [pct, setPct] = useState(false);
  const [last, setLast] = useState<GodOpen | null>(null);
  const [speed, setSpeed] = useState(state.settings.speed);
  const [run, setRun] = useState(running);
  // the play record and the A/B block of the settings panel, with local state only (the page's own is src/app/record.ts)
  const [recOn, setRecOn] = useState(true);
  const [ab, setAb] = useState<AbMode>('alternate');
  const record: RecordView = { on: recOn, size: recOn ? 137 : 0, lives: recOn ? 1 : 0, onToggle: setRecOn, onExport: () => 'overseer-record-sample.json', onClear: () => setRecOn(false), ab, onAb: setAb, arm: ab === 'off' ? null : 'on' };
  // the model is read from a copy of the state with the settings the story changed
  const shown: GameState = { ...state, settings };
  const model = { ...watchModel(data, shown, uiOfState(shown, { running: run, stop })), speed };
  const actions: WatchActions = {
    onOpenGod: setLast,
    setSpeed: (s) => (setSpeed(s), setRun(s !== 'pause')),
    togglePause: () => setRun((r) => !r),
    resume: () => undefined,
    setSettings: (patch) => {
      const bad = refusedSettings(patch);
      if (bad) return bad;
      setSettings((s) => ({ ...s, ...patch, llm: { ...s.llm, ...patch.llm } }));
      if (patch.speed) actions.setSpeed(patch.speed);
      return null;
    },
  };
  return (
    <>
      <WatchView data={data as GameData} model={model} settings={settings} actions={actions} candlePct={pct} onCandlePct={setPct} settingsOpen={settingsOpen} record={record} scene={<LifeScene data={data as GameData} state={shown} />} map={<WorldMap data={data as GameData} state={shown} mini width={MINI_MAP_WIDTH} />} />
      {last && (
        <div style={{ position: 'fixed', left: 12, bottom: 12, background: '#000a', padding: 8, fontSize: 12, zIndex: 99 }} data-testid="opened">
          onOpenGod {last.kind} {JSON.stringify(last.args)}
        </div>
      )}
    </>
  );
}

story({ group: 'หน้าเฝ้ามอง', name: 'แรกเกิด', seed: 1, at: 1, render: (ctx) => <Sample ctx={ctx} running /> });
story({ group: 'หน้าเฝ้ามอง', name: 'กลางชีวิต การ์ดสองใบ', seed: 2, at: 107, render: (ctx) => <Sample ctx={ctx} running /> });
story({ group: 'หน้าเฝ้ามอง', name: 'ท้ายชีวิต', seed: 1, at: 270, render: (ctx) => <Sample ctx={ctx} running /> });
story({ group: 'การเรียก', name: 'หน้าหยุด จุดหยุดตามอายุ', seed: 1, at: 20, render: (ctx) => <Sample ctx={ctx} stop /> });
story({ group: 'การเรียก', name: 'หน้าหยุด มีการ์ดรออยู่', seed: 2, at: 200, render: (ctx) => <Sample ctx={ctx} stop /> });
story({ group: 'การเรียก', name: 'หน้าหยุด ใกล้ตาย', seed: 1, at: 296, render: (ctx) => <Sample ctx={ctx} stop /> });
story({ group: 'ตั้งค่า', name: 'แผงตั้งค่า', seed: 1, at: 80, render: (ctx) => <Sample ctx={ctx} running settingsOpen /> });

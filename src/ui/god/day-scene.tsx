// The day of a miracle (20-god-ui.md §7.3 "วันเกิดเหตุ", code-plan §8.3 row "วันเกิดเหตุ"): the scene of the miracle that happened last, played by the scene
// player with the same mapping the watch screen uses (src/app/views/scene.ts). A miracle with no script of its own shows its event card instead.
import { useMemo } from 'preact/hooks';
import { figuresOf, labelsOf, sceneFor, sceneryOf } from '../../app/views/scene';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { EventCard, ScenePlayer } from '../../scene';

export function DayScene({ n, data, state }: { n: number; data: GameData; state: GameState }) {
  const view = useMemo(() => {
    const e = state.log.find((x) => x.n === n);
    return e ? sceneFor(data, e, state) : null;
  }, [n, data, state.log.length]);
  const staged = useMemo(() => (view ? { figureOf: figuresOf(data, state, view), scenery: sceneryOf(data, state, view), labelOf: labelsOf(data, state, view) } : undefined), [view, data]);
  if (!view) return null;
  return (
    <div style={{ width: 'min(100%, 880px)', margin: '0 auto' }} data-testid="day-scene" data-kind={view.kind}>
      {view.kind === 'script' ? <ScenePlayer script={view.script} controls figureOf={staged?.figureOf} scenery={staged?.scenery} labelOf={staged?.labelOf} /> : <EventCard card={view.card} />}
    </div>
  );
}

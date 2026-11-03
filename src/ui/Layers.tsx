// Screens laid over the watch screen (code-plan §8.2: ศึก · พวกพ้องและครอบครัว · ตัวละคร): a small bar opens them, Escape or the back button
// of each screen closes them. The clock is paused while one is open and goes on after, like the god's screens.
import { signal } from '@preact/signals';
import { store } from '../app/store';
import { AlliesScreen } from './allies';
import { BattleView, WarPanel, battleEntries, battleModelAt, currentWar } from './battle';
import { CharacterScreen } from './character';
import { askGod } from './god';
import { color, font, size } from './tokens';

type Layer = 'character' | 'allies' | 'battle' | 'war';

/** Labels of the bar (chrome words, not game text: code-plan §8.1 rule 2 covers the game's words). */
const LABEL: Record<Layer, string> = { character: 'ตัวละคร', allies: 'พวกพ้อง', battle: 'ศึกล่าสุด', war: 'สงคราม' };
/** The whisper the allies screen asks for on a person in a crisis (god/acts whisper hint "ช่วย"). */
const HELP_HINT = 'ช่วย';

const layer = signal<Layer | null>(null);
let resumeAfter = false;

function open(l: Layer): void {
  if (!layer.value) {
    resumeAfter = store.running.value;
    store.pause();
  }
  layer.value = l;
}

function close(): void {
  layer.value = null;
  if (resumeAfter) store.play();
  resumeAfter = false;
}

/** The bar of the watch screen and the open layer. */
export function Layers() {
  void store.rev.value;
  const st = store.state;
  const data = store.gameData;
  if (!st || !data || !st.life) return null;
  const lastBattle = battleEntries(st).at(-1);
  const war = currentWar(data, st);
  const shown: Layer[] = ['character', 'allies', ...(lastBattle ? (['battle'] as const) : []), ...(war ? (['war'] as const) : [])];
  const l = layer.value;
  return (
    <>
      <div style={{ position: 'fixed', left: '50%', top: size.pad, transform: 'translateX(-50%)', display: 'flex', gap: size.gap, zIndex: 5 }}>
        {shown.map((k) => (
          <button
            key={k}
            onClick={() => (l === k ? close() : open(k))}
            style={{ background: l === k ? color.light : color.panel, color: l === k ? color.panel : color.text, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: `2px ${size.pad}px`, fontFamily: font.body, fontSize: size.small, cursor: 'pointer' }}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>
      {l && (
        <div style={{ position: 'fixed', inset: 0, background: color.panel, zIndex: 4, overflow: 'auto', paddingTop: size.pad * 4 }}>
          {l === 'character' && <CharacterScreen onBack={close} />}
          {l === 'allies' && <AlliesScreen onClose={close} onWhisper={(name) => askGod('whisper', { hint: HELP_HINT, target: name })} />}
          {l === 'battle' && lastBattle && (() => {
            const m = battleModelAt(data, st, lastBattle.n);
            return m ? <BattleView model={m} autoplay onClose={close} /> : null;
          })()}
          {l === 'war' && <WarPanel war={war} onClose={close} />}
        </div>
      )}
    </>
  );
}

// The event card (code-plan §8.3 step 2): ONE layout for every event. What changes is the colour of the frame, the corner marks (the icon
// of the category at the left, the size of the effect at the right) and the picture. The picture slot is a gradient and drifting
// particles drawn in code; a picture file replaces it through `src` in M6 to M7 without changing the card.
import { useEffect, useRef, useState } from 'preact/hooks';
import { TITLE_LINE, color, font, size } from '../ui/tokens';
import type { CardModel } from './card';
import { drawFx, seedOf } from './particles';
import { WORDS } from './tuning';

const FORM_NAME: Record<string, string> = { X: 'ฉากเต็มจอ', M: 'ชั้นแผนที่', L: 'ฉากท้องถิ่น', C: 'การ์ดและเสียง' };

function Picture({ card, src }: { card: CardModel; src?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const seed = seedOf(card.id);
  useEffect(() => {
    if (src || !card.fx.length) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [card.id, src]);
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (c) drawFx(c, 480, 320, card.fx.map((kind) => ({ kind, amount: 0.7 })), t, seed);
  }, [t, card.id]);
  return (
    <div data-slot="picture" style={{ position: 'relative', aspectRatio: '3 / 2', background: src ? `url(${src}) center / cover` : `linear-gradient(to bottom, ${card.sky} 0%, ${card.sky} 60%, #07070a 100%)`, borderRadius: 4, overflow: 'hidden' }}>
      {!src && <canvas ref={canvas} width={480} height={320} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
      {!src && card.form === 'M' && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(45deg, ${card.frame}22 0 6px, transparent 6px 14px)`, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6, fontSize: 11, color: card.frame }}>
          {WORDS.layer}
        </div>
      )}
      {!src && card.picture && <div style={{ position: 'absolute', left: 8, right: 8, bottom: 6, fontSize: 11, color: color.textDim, lineHeight: 1.35 }}>{card.picture}</div>}
    </div>
  );
}

export function EventCard({ card, src, width = 340, onClose }: { card: CardModel; src?: string; width?: number; onClose?: () => void }) {
  return (
    <div
      data-event-card={card.id}
      style={{
        width,
        boxSizing: 'border-box',
        background: color.panel,
        color: color.text,
        fontFamily: font.body,
        border: `3px solid ${card.frame}`,
        borderRadius: 8,
        padding: size.pad,
        display: 'flex',
        flexDirection: 'column',
        gap: size.gap,
        boxShadow: `0 0 14px ${card.frame}44`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: size.small }}>
        <span data-corner="icon" style={{ color: card.frame, border: `1px solid ${card.frame}`, borderRadius: 12, padding: '0 8px' }}>{card.icon || card.id.replace(/-.*/, '')}</span>
        <span data-corner="mark" style={{ fontSize: size.title, color: card.frame }}>{card.mark}</span>
      </div>
      <Picture card={card} src={src} />
      <div style={{ fontFamily: font.title, fontSize: size.title, lineHeight: TITLE_LINE }}>{card.title}</div>
      {card.form && <div style={{ fontSize: 11, color: card.frame }}>{card.id} · {FORM_NAME[card.form]}</div>}
      {card.body && <div style={{ fontSize: size.text, lineHeight: 1.5 }}>{card.body}</div>}
      {card.sound && <div style={{ fontSize: 11, color: color.textDim }}>♪ {card.sound}</div>}
      {onClose && (
        <button onClick={onClose} style={{ alignSelf: 'flex-end', background: 'transparent', color: color.text, border: `1px solid ${color.line}`, borderRadius: size.radius, padding: '2px 12px', cursor: 'pointer', fontFamily: font.body }}>
          {WORDS.close}
        </button>
      )}
    </div>
  );
}

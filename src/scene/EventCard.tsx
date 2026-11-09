// The event card (code-plan §8.3 step 2): ONE layout for every event. What changes is the colour of the frame, the corner marks (the icon
// of the category at the left, the size of the effect at the right) and the picture. The picture slot is a small pixel picture of the place of the event with the
// card's effects (src/scene/cardpic.ts, M7 ก4); a picture file replaces it through `src` without changing the card.
import { useEffect, useRef } from 'preact/hooks';
import { TITLE_LINE, color, font, size } from '../ui/tokens';
import type { CardModel } from './card';
import { cardPicture } from './cardpic';
import { ICON_SIZE, cornerIcon, iconPixels } from './corner';
import { specKey } from './scenery';
import { ART, WORDS } from './tuning';

const FORM_NAME: Record<string, string> = { X: 'ฉากเต็มจอ', M: 'ชั้นแผนที่', L: 'ฉากท้องถิ่น', C: 'การ์ดและเสียง' };

/** The corner icon: a pixel picture of the category's word (src/scene/corner.ts), in the colour of the frame; a word with no picture is shown as the word. */
function CornerIcon({ word, color: c }: { word: string; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bits = cornerIcon(word);
  useEffect(() => {
    const g = canvas.current?.getContext('2d');
    if (!g || !bits) return;
    g.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    for (const [x, y, lit] of iconPixels(bits)) {
      g.fillStyle = c;
      g.globalAlpha = lit ? 0.65 : 1;
      g.fillRect(x, y, 1, 1);
    }
  }, [word, c]);
  if (!bits) return <span data-corner="icon" style={{ color: c, border: `1px solid ${c}`, borderRadius: 12, padding: '0 8px' }}>{word}</span>;
  return <canvas ref={canvas} data-corner="icon" data-icon={word} title={word} aria-label={word} width={ICON_SIZE} height={ICON_SIZE} style={{ width: ICON_SIZE * 3, height: ICON_SIZE * 3, imageRendering: 'pixelated' }} />;
}

function Picture({ card, src }: { card: CardModel; src?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = `${card.id}|${card.sky}|${card.fx.join(',')}|${card.form ?? ''}|${card.frame}|${card.scenery ? specKey(card.scenery) : ''}`;
  // the picture: the place of the event and the card's effects, one still frame of 320 × 180 art pixels on a plain canvas (src/scene/cardpic.ts), scaled without smoothing
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c || src) return;
    const pic = cardPicture(card);
    c.putImageData(new ImageData(pic.data, pic.w, pic.h), 0, 0);
  }, [key, src]);
  return (
    <div data-slot="picture" style={{ position: 'relative', aspectRatio: '16 / 9', background: src ? `url(${src}) center / cover` : card.sky, borderRadius: 4, overflow: 'hidden' }}>
      {!src && <canvas ref={canvas} width={ART.w} height={ART.h} data-card-picture style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />}
      {!src && card.form === 'M' && (
        <div style={{ position: 'absolute', right: 0, top: 0, padding: '2px 6px', fontSize: 11, color: card.frame, background: 'rgba(0,0,0,0.55)', borderBottomLeftRadius: 4 }}>{WORDS.layer}</div>
      )}
      {!src && card.picture && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 8px 5px', fontSize: 11, color: color.text, lineHeight: 1.35, textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000, 0 2px 5px #000', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.78))' }}>{card.picture}</div>}
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
        {/* no code of the data in the player's text (M5 review round two R5): a card with no icon word has no pill */}
        {card.icon ? <CornerIcon word={card.icon} color={card.frame} /> : <span />}
        <span data-corner="mark" style={{ fontSize: size.title, color: card.frame }}>{card.mark}</span>
      </div>
      <Picture card={card} src={src} />
      <div style={{ fontFamily: font.title, fontSize: size.title, lineHeight: TITLE_LINE }}>{card.title}</div>
      {card.form && <div style={{ fontSize: 11, color: card.frame }}>{FORM_NAME[card.form]}</div>}
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

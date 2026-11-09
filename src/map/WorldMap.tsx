// The map as a Preact component (code-plan §8.4): `<WorldMap data state focus zoom onPick aim mini />`.
//
// The full map mounts a Phaser game in a div (scene.ts, loaded on demand so the page that never opens the map never loads Phaser): Phaser gives the
// one camera with continuous zoom, the layers with depth, and pointer and wheel input that the five zoom levels need. The mini-map (the watch
// screen) is a plain canvas and does not load Phaser at all: it is one picture of the world tile with a few marks on it, redrawn at a few frames a
// second, so a game engine would be heavy for it.
//
// The component is controlled by its props: `state` is read every time the parent renders (the page renders after each beat), `focus` moves the
// camera when it changes, `aim` turns the map into the aiming of a miracle. The model of what to show comes from `mapModel` (src/app/views/map.ts).
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mapModel, type MapModel } from '../app/views/map';
import type { Continent, ContinentsFile, Country } from '../core/data/types-npcs';
import type { GameData } from '../core/game';
import type { GameState } from '../core/types';
import { color, font, size } from '../ui/tokens';
import { pageProvider } from './assets';
import { crowdOf } from './crowd';
import type { CodeProvider } from './codeProvider';
import { CONT_IDS, type ContId } from './geo';
import { layoutOf, type MapLayout } from './layout';
import type { MapArtProvider, TileImage } from './provider';
import { requestFor } from './tiles';
import type { MapAim, MapFocus, MapHover, MapPick } from './types';
import { DRAGON_SIZE, OMEN_COLOR, RUIN, SHEET, ZOOM_LEVELS, type ZoomId } from './tuning';
import type { MapController } from './scene';

export interface WorldMapProps {
  data: GameData;
  state: GameState;
  /** Where the camera looks. Moves the camera when it changes; omit for the whole world. */
  focus?: MapFocus;
  /** Camera zoom in pixels per world unit (world-map.md §3); omit to fit the focus. */
  zoom?: number;
  /** A click on a place. By default a click picks what the zoom level shows: a continent in the world view, a country on the continent, a town close up. */
  onPick?: (p: MapPick) => void;
  /** What a click picks, whatever the zoom; `false` turns picking off (the map only pans). */
  pick?: MapPick['kind'] | false;
  /** Aiming of a miracle: the circle follows the cursor, the target is lit and a click picks `aim.kind`. */
  aim?: MapAim | null;
  /** The mini-map of the watch screen: one picture and a few marks, no camera. */
  mini?: boolean;
  /** Size of the mini-map in px (the map fills its parent otherwise). */
  width?: number;
  /** Told when the zoom level changes. */
  onLevel?: (level: ZoomId, zoom: number) => void;
  /** A model to show instead of the one made from `state` (the storybook uses it to show a ruin or an omen). */
  model?: MapModel;
  /** An art provider; the page's own (code-drawn, with the generated pictures when they ship) by default. */
  provider?: MapArtProvider;
  seed?: number;
  style?: JSX.CSSProperties;
}

const SEED = 1;

interface Env {
  layout: MapLayout;
  provider: MapArtProvider;
  code?: CodeProvider;
}

function useEnv(data: GameData, provider?: MapArtProvider): Env | null {
  const [env, setEnv] = useState<Env | null>(null);
  useEffect(() => {
    let live = true;
    if (provider) setEnv({ layout: layoutOf(data), provider });
    else pageProvider(data).then((p) => live && setEnv({ layout: p.code.layout, provider: p.provider, code: p.code }));
    return () => { live = false; };
  }, [data, provider]);
  return env;
}

const paletteOf = (data: GameData): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const c of (data.continents?.items as ContinentsFile | undefined)?.continents ?? []) out[c.id] = c.ui.palette;
  return out;
};

const namesOf = (data: GameData) => {
  const conts = new Map<string, string>(((data.continents?.items as ContinentsFile | undefined)?.continents ?? []).map((c: Continent) => [c.id as string, c.name]));
  const countries = new Map(((data.countries?.items as Country[] | undefined) ?? []).map((c) => [c.id, c]));
  return {
    continent: (id: string) => conts.get(id) ?? id,
    country: (id: string) => ({ name: countries.get(id)?.name ?? id, title: countries.get(id)?.title ?? '' }),
  };
};

/** Name of a zoom level as the data writes it (continents.json world.zoomLevels). */
const levelName = (data: GameData, id: ZoomId): string => (data.continents?.items as ContinentsFile | undefined)?.world.zoomLevels.find((l) => l.id === id)?.name ?? id;

export function WorldMap(props: WorldMapProps) {
  return props.mini ? <MiniMap {...props} /> : <FullMap {...props} />;
}

// ---------- the full map ----------

function FullMap(props: WorldMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<MapController | null>(null);
  const env = useEnv(props.data, props.provider);
  const model = props.model ?? mapModel(props.data, props.state);
  const [hover, setHover] = useState<MapHover | null>(null);
  const [level, setLevel] = useState<{ id: ZoomId; zoom: number }>({ id: 'world', zoom: 0.2 });
  const mouse = useRef({ x: 0, y: 0 });
  const cb = useRef(props);
  cb.current = props;
  const cur = useRef(model);
  cur.current = model;

  useEffect(() => {
    if (!env || !host.current) return;
    let dead = false;
    let made: MapController | null = null;
    const names = namesOf(props.data);
    import('./scene').then(({ MapController }) => {
      if (dead || !host.current) return;
      made = new MapController(host.current, {
        layout: env.layout,
        provider: env.provider,
        seed: props.seed ?? SEED,
        palettes: paletteOf(props.data),
        names,
        town: env.code ? (id) => { const t = env.code!.town(id, { looks: cur.current.looks, seed: props.seed ?? SEED }); return t && { plan: t.plan, look: t.look, ground: t.ground, country: t.country }; } : undefined,
        crowd: crowdOf(props.data),
        crowdScale: Number(new URLSearchParams(location.search).get('crowd')) || 1,
        onPick: (p) => cb.current.onPick?.(p),
        onHover: (h) => setHover(h ? { ...h, x: mouse.current.x, y: mouse.current.y } : null),
        onLevel: (id, zoom) => setLevel((o) => (o.id === id && Math.abs(o.zoom - zoom) < 0.005 ? o : { id, zoom })),
      });
      ctl.current = made;
      made.setModel(model);
      made.setFocus(cb.current.focus ?? { kind: 'world' }, cb.current.zoom);
      made.setAim(cb.current.aim);
      made.setPick(cb.current.pick);
    });
    return () => { dead = true; made?.destroy(); ctl.current = null; };
  }, [env]);

  // the model is read again on every render; the scene compares it with the last and redraws only what changed
  useEffect(() => { ctl.current?.setModel(model); });
  useEffect(() => { ctl.current?.setAim(props.aim); }, [props.aim?.kind, props.aim?.line, props.aim?.radius, props.aim?.hold, !!props.aim]);
  useEffect(() => { ctl.current?.setPick(props.pick); }, [props.pick]);
  useEffect(() => { ctl.current?.setFocus(props.focus ?? { kind: 'world' }, props.zoom); }, [props.focus?.kind, props.focus?.id, props.zoom]);
  useEffect(() => { props.onLevel?.(level.id, level.zoom); }, [level.id]);

  const key = (down: boolean) => (e: KeyboardEvent) => { if (ctl.current?.key(e, down)) e.preventDefault(); };
  const zoomBtn = (k: string) => () => ctl.current?.key({ key: k } as KeyboardEvent, true);

  return (
    <div
      ref={host}
      class="wm-root"
      data-world-map
      tabIndex={0}
      role="group"
      aria-label="แผนที่โลก (ลูกศรหรือ W A S D เลื่อน · + − ซูม · Home กลับ)"
      onKeyDown={key(true) as never}
      onKeyUp={key(false) as never}
      onPointerDown={() => host.current?.focus()}
      onPointerMove={(e) => { const r = host.current!.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; }}
      onPointerLeave={() => setHover(null)}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 240, overflow: 'hidden', background: '#14355a', outline: 'none', touchAction: 'none', cursor: props.aim ? 'crosshair' : 'grab', ...props.style }}
    >
      <style>{`.wm-root:focus-visible { box-shadow: inset 0 0 0 3px ${color.light}; }`}</style>
      {!env && <div style={{ ...hudBase, left: size.pad, top: size.pad }}>กำลังวาดแผนที่…</div>}
      <div style={{ ...hudBase, right: size.pad, top: size.pad, display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ marginRight: 6 }}>{levelName(props.data, level.id)}</span>
        <button style={btn} onClick={zoomBtn('+')} aria-label="+">+</button>
        <button style={btn} onClick={zoomBtn('-')} aria-label="-">−</button>
        <button style={btn} onClick={zoomBtn('Home')} aria-label="home">◎</button>
      </div>
      {hover && (
        <div style={{ ...hudBase, left: Math.min(hover.x + 14, (host.current?.clientWidth ?? 600) - 200), top: hover.y + 16, pointerEvents: 'none' }}>
          <div style={{ fontFamily: font.title, fontSize: size.title - 4 }}>{hover.name}</div>
          {hover.title && <div style={{ color: color.textDim, fontSize: size.small }}>{hover.title}</div>}
        </div>
      )}
    </div>
  );
}

const hudBase: JSX.CSSProperties = {
  position: 'absolute', zIndex: 5, padding: '4px 10px', background: 'rgba(14,15,20,0.78)', color: color.text, border: `1px solid ${color.line}`,
  borderRadius: size.radius, fontFamily: font.body, fontSize: size.small,
};
const btn: JSX.CSSProperties = { background: 'transparent', color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: '20px', padding: 0 };

// ---------- the mini-map ----------

function MiniMap(props: WorldMapProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const env = useEnv(props.data, props.provider);
  const model = props.model ?? mapModel(props.data, props.state);
  const w = props.width ?? 320;
  const h = Math.round((w * SHEET.h) / SHEET.w);
  const base = useRef<{ key: string; img: TileImage } | null>(null);
  const cur = useRef({ model, env });
  cur.current = { model, env };

  // the picture of the sheet: asked again only when the look of the world changes
  const lookSig = useMemo(() => JSON.stringify(model.looks), [model]);
  useEffect(() => {
    if (!env) return;
    let live = true;
    Promise.resolve(env.provider.tile(requestFor(env.layout, 'world', 'world', model.looks, props.seed ?? SEED))).then((t) => {
      if (live && t) base.current = { key: lookSig, img: t };
    });
    return () => { live = false; };
  }, [env, lookSig]);

  useEffect(() => {
    let id = 0;
    const draw = (time: number) => {
      const c = cv.current;
      const e = cur.current;
      if (c && e.env) {
        const ctx = c.getContext('2d');
        if (ctx) paintMini(ctx, c.width, c.height, e.model, e.env.layout, base.current?.img ?? null, time);
      }
      id = window.setTimeout(() => draw(performance.now()), 100);
    };
    draw(performance.now());
    return () => window.clearTimeout(id);
  }, []);

  const click = (ev: JSX.TargetedMouseEvent<HTMLCanvasElement>) => {
    const e = cur.current.env;
    if (!e) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * SHEET.w, y = ((ev.clientY - r.top) / r.height) * SHEET.h;
    const c = e.layout.countryAt(x, y);
    if (!c) return;
    const kind = props.pick === 'continent' ? 'continent' : 'country';
    props.onPick?.(kind === 'continent' ? { kind, id: c.continent } : { kind, id: c.id });
  };

  return <canvas ref={cv} role="img" aria-label="แผนที่เล็ก: ทวีปของตัวละคร" width={w * 2} height={h * 2} onClick={click} style={{ width: w, height: h, borderRadius: size.radius, border: `1px solid ${color.line}`, background: '#14355a', cursor: props.onPick ? 'pointer' : 'default', ...props.style }} />;
}

function paintMini(ctx: CanvasRenderingContext2D, W: number, H: number, m: MapModel, layout: MapLayout, base: TileImage | null, time: number): void {
  ctx.clearRect(0, 0, W, H);
  if (base) ctx.drawImage(base.source, 0, 0, W, H);
  else { ctx.fillStyle = '#14355a'; ctx.fillRect(0, 0, W, H); }
  const k = W / SHEET.w;
  const pulse = 0.5 + 0.5 * Math.sin(time / 500);
  // ruins and fallen lands: ash over the country and a dark pit at its capital
  for (const r of m.ruins) {
    const c = layout.byId.get(r.country);
    if (!c) continue;
    const cap = layout.citiesOf(c.id)[0] ?? c;
    ctx.fillStyle = r.healed ? 'rgba(90,86,80,0.35)' : 'rgba(90,86,80,0.7)';
    ctx.beginPath(); ctx.arc(c.x * k, c.y * k, Math.max(3, Math.sqrt(c.area / Math.PI) * k * 0.9), 0, Math.PI * 2); ctx.fill();
    if (r.kind !== 'fallen') { ctx.fillStyle = r.kind === 'MR-18' || r.lake ? RUIN.water : RUIN.pit; ctx.beginPath(); ctx.arc(cap.x * k, cap.y * k, Math.max(2, 5 * k), 0, Math.PI * 2); ctx.fill(); }
  }
  // dragons: a glow at the bed
  for (const d of m.dragons) {
    const c = layout.byId.get(d.country);
    if (!c) continue;
    ctx.fillStyle = d.alive ? d.color : '#9a9486';
    ctx.globalAlpha = d.alive ? 0.35 + 0.25 * pulse : 0.5;
    ctx.beginPath(); ctx.arc(c.x * k, c.y * k, Math.max(2, DRAGON_SIZE[d.index] * k * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // omens: rings of the colour of the line that paid
  for (const o of m.omens) {
    const c = o.country ? layout.byId.get(o.country) : undefined;
    const cont = o.continent ? layout.continents[o.continent as ContId] : undefined;
    const x = c ? c.x : cont ? cont.box.x + cont.box.w / 2 : -1, y = c ? c.y : cont ? cont.box.y + cont.box.h / 2 : -1;
    if (x < 0) continue;
    ctx.strokeStyle = o.color; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.beginPath(); ctx.arc(x * k, y * k, 9 * k * (c ? 1 : 3) + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the marks of small and middle miracles: a ring that fades over the year
  for (const o of m.marks ?? []) {
    const c = o.country ? layout.byId.get(o.country) : undefined;
    const cont = o.continent ? layout.continents[o.continent as ContId] : undefined;
    const x = c ? c.x : cont ? cont.box.x + cont.box.w / 2 : -1, y = c ? c.y : cont ? cont.box.y + cont.box.h / 2 : -1;
    if (x < 0) continue;
    ctx.strokeStyle = o.color; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.3 + 0.6 * o.fresh;
    ctx.beginPath(); ctx.arc(x * k, y * k, 7 * k * (c ? 1 : 3) + 2 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the character
  const ch = m.character;
  if (ch && !ch.dead) {
    const city = layout.cities.find((q) => q.id === ch.city) ?? layout.citiesOf(ch.country)[0];
    if (city) {
      ctx.fillStyle = `rgba(232,195,106,${0.25 + 0.25 * pulse})`;
      ctx.beginPath(); ctx.arc(city.x * k, city.y * k, 8 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8c36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(city.x * k, city.y * k, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.arc(city.x * k, city.y * k, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export { CONT_IDS, OMEN_COLOR, ZOOM_LEVELS };

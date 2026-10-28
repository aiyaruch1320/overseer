// Paints map textures off the main thread so zooming and scrolling never wait for pixels.
import { makePainter, type PaintWorld } from './mappaint';

let paint: ReturnType<typeof makePainter> | null = null;

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'init') { paint = makePainter(m.world as PaintWorld); return; }
  if (m.type === 'paint' && paint) {
    const data = paint(m.x0, m.y0, m.w, m.h, m.ppt);
    (self as unknown as Worker).postMessage({ type: 'painted', key: m.key, w: m.w, h: m.h, data }, [data.buffer]);
  }
};

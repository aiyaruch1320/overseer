// Gives a prebuilt map picture (world, continent, country) the flat palette of pixel art: every channel is snapped to a step, so the soft gradients
// of the painters become bands of a few colours. The picture is made at the pixel density of its level and shown at 1× or more (never shrunk).
export interface PixelCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

export function posterize(canvas: PixelCanvas, step = 12): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !ctx.getImageData) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!img?.data) return;
  const d = img.data;
  const half = step / 2;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.floor((d[i] + half) / step) * step);
    d[i + 1] = Math.min(255, Math.floor((d[i + 1] + half) / step) * step);
    d[i + 2] = Math.min(255, Math.floor((d[i + 2] + half) / step) * step);
    if (d[i + 3] !== 0) d[i + 3] = d[i + 3] < 128 ? 0 : 255; // no soft edge
  }
  ctx.putImageData(img, 0, 0);
}

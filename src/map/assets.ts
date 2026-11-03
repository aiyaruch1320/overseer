// Finds the generated pictures that ship with the game (data/art/map/) through Vite's lazy imports and builds the provider of the page:
// code-drawn alone while the folder is empty or missing, `layered([image, code])` once data/art/map/manifest.json exists.
import type { GameData } from '../core/game';
import { codeProvider, type CodeProvider, type CodeProviderOpts } from './codeProvider';
import { imageProvider, parseManifest } from './imageProvider';
import { layered, type MapArtProvider } from './provider';

const manifests = import.meta.glob('../../data/art/map/manifest.json', { import: 'default' }) as Record<string, () => Promise<unknown>>;
const pictures = import.meta.glob('../../data/art/map/**/*.{png,webp,jpg,jpeg}', { query: '?url', import: 'default', eager: false }) as Record<string, () => Promise<string>>;

const loadPicture = (url: string) =>
  new Promise<{ source: CanvasImageSource; width: number; height: number }>((ok, fail) => {
    const im = new Image();
    im.onload = () => ok({ source: im, width: im.naturalWidth, height: im.naturalHeight });
    im.onerror = () => fail(new Error(url));
    im.src = url;
  });

export interface PageProvider {
  provider: MapArtProvider;
  code: CodeProvider;
  /** `code` while no picture ships, `image+code` with a manifest. */
  kind: 'code' | 'image+code';
}

let built: Promise<PageProvider> | null = null;

/** The provider of the page, made once. Pass `opts.canvas` in a test. */
export function pageProvider(data: GameData, opts?: CodeProviderOpts): Promise<PageProvider> {
  built ??= (async () => {
    const code = codeProvider(data, opts);
    const mf = Object.values(manifests)[0];
    if (!mf) return { provider: code, code, kind: 'code' as const };
    const manifest = parseManifest(await mf());
    if (!manifest.tiles.length) return { provider: code, code, kind: 'code' as const };
    // resolve a manifest path to the URL Vite gives the file: the key is the path under data/art/map/
    const urls = new Map<string, () => Promise<string>>();
    for (const [path, load] of Object.entries(pictures)) urls.set(path.replace(/^.*data\/art\/map\//, ''), load);
    const resolved = new Map<string, string>();
    await Promise.all(manifest.tiles.map(async (t) => {
      const base = manifest.base ? `${manifest.base.replace(/\/$/, '')}/` : '';
      const load = urls.get(base + t.file);
      if (load) resolved.set(base + t.file, await load());
    }));
    const image = imageProvider(manifest, code.layout, { url: (p) => resolved.get(p) ?? null, load: loadPicture });
    return { provider: layered([image, code]), code, kind: 'image+code' as const };
  })();
  return built;
}

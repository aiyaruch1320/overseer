#!/usr/bin/env python3
"""Build the game's painted assets from art/manifest.json with ComfyUI. See art/README.md.

  python3 art/tools/gen.py list
  python3 art/tools/gen.py build <asset-id> [--root DIR] [--seed N] [--keep DIR]

The manifest is the source of truth: prompt, seed, size and the workflow file are read from it, so an asset can be rebuilt
(or tried with another --seed) without remembering how it was made. Needs Pillow and a reachable ComfyUI (COMFY_URL).
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # `check` must still run (and say no) on a machine without Pillow
    Image = None

sys.dont_write_bytecode = True  # keep art/tools free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
import comfy  # noqa: E402

ART = Path(__file__).resolve().parents[1]
REPO = ART.parent


def first_image(paths):
    return next(p for p in paths if p.lower().endswith('.png'))


def matte(img):
    """Soft cut-out of a glowing or translucent item sitting on a flat grey background (BiRefNet drops these).

    The background colour is the average of the four corners; alpha grows with the distance from it, and the colour is
    un-mixed from the background so the glow does not carry a grey fringe onto a dark panel.
    """
    w, h = img.size
    px = img.load()
    pts = [px[x, y] for x0, y0 in ((0, 0), (w - 24, 0), (0, h - 24), (w - 24, h - 24)) for y in range(y0, y0 + 24, 4) for x in range(x0, x0 + 24, 4)]
    bg = [sum(p[i] for p in pts) / len(pts) for i in range(3)]
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            a = min(1.0, max(0.0, (max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) - 9) / 45.0))
            if a <= 0.02:
                continue
            f = [min(255, max(0, round((v - (1 - a) * bg[i]) / a))) for i, v in enumerate((r, g, b))]
            op[x, y] = (f[0], f[1], f[2], round(a * 255))
    return out


def opaque(img):
    """Share of pixels that are clearly visible."""
    return sum(img.getchannel('A').histogram()[41:]) / (img.width * img.height)


def square(img, margin, size):
    box = img.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    img = img.crop(box)
    s = max(img.size)
    pad = round(s * margin)
    sq = Image.new('RGBA', (s + 2 * pad, s + 2 * pad), (0, 0, 0, 0))
    sq.alpha_composite(img, ((s - img.width) // 2 + pad, (s - img.height) // 2 + pad))
    return sq.resize((size, size), Image.LANCZOS)


def build(asset_id, spec, root, seed, work):
    wf = ART / 'workflows' / spec['workflow']
    settings = dict(spec['set'])
    if seed is not None:
        settings[spec['seed_key']] = seed
    print(f'[{asset_id}] generating ({spec["workflow"]})', flush=True)
    raw = Path(first_image(comfy.run(wf, settings, work, asset_id)))
    if spec['kind'] == 'image':
        dst = root / spec['out']
        dst.parent.mkdir(parents=True, exist_ok=True)
        Image.open(raw).convert('RGB').save(dst, quality=spec.get('quality', 85), method=6)
        print(f'  wrote {dst}')
        return
    # icon sheet: BiRefNet for solid items, colour matte for glowing ones, then one square WebP per icon
    cut_wf = ART / 'workflows' / spec['cutout_workflow']
    cut = Image.open(first_image(comfy.run(cut_wf, {'1.image': comfy.upload_image(str(raw))}, work, asset_id + '-cut'))).convert('RGBA')
    sheet = Image.open(raw).convert('RGB')
    cols, rows = spec['grid']
    cw, ch = sheet.width // cols, sheet.height // rows
    for i, icon in enumerate(spec['icons']):
        box = ((i % cols) * cw, (i // cols) * ch, (i % cols) * cw + cw, (i // cols) * ch + ch)
        how = icon['cut']
        cell = matte(sheet.crop(box)) if how == 'matte' else cut.crop(box)
        if how == 'birefnet' and opaque(cell) < 0.001:
            # BiRefNet sometimes drops a glowing item entirely, and which one depends on the seed
            print(f'  warning: BiRefNet removed {icon["name"]}; using the colour matte (set "cut": "matte" in the manifest to silence this)')
            how, cell = 'matte, fallback', matte(sheet.crop(box))
        if opaque(cell) < 0.001:
            sys.exit(f'{icon["name"]}: nothing is left after cut-out; this seed gave an empty cell, try another --seed (kept nothing for this icon)')
        dst = root / spec['out'].format(name=icon['name'])
        dst.parent.mkdir(parents=True, exist_ok=True)
        square(cell, spec['margin'], spec['size']).save(dst, quality=92, method=6)
        print(f'  wrote {dst} ({how})')


def check():
    """Gate for agents: asset building only works where ComfyUI is reachable (the owner's Linux machine)."""
    import platform
    try:
        info = json.load(comfy._open(f'{comfy.URL}/system_stats', timeout=5))
    except comfy.ComfyError as e:
        print(f'NOT AVAILABLE on this machine ({platform.system()}): {e}')
        print('STOP: skip everything in art/ and carry on with the game code. Do not start, install or reconfigure ComfyUI here.')
        print('If the owner asked for image work, tell them it can only be done on their Linux machine with ComfyUI running.')
        if platform.system() == 'Linux' and comfy.URL == 'http://127.0.0.1:8188':
            print('(If this IS that machine: `docker start comfyui`, wait a minute, then run this check again.)')
        return 1
    print(f'OK: ComfyUI {info["system"]["comfyui_version"]} at {comfy.URL}, device {info["devices"][0]["name"]}, host {platform.system()}')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('list')
    sub.add_parser('check', help='is this the machine that can build assets? exit 0 = yes')
    b = sub.add_parser('build')
    b.add_argument('asset')
    b.add_argument('--root', default=str(REPO), help='write outputs under this folder instead of the repo (to try without overwriting)')
    b.add_argument('--seed', type=int, help='try another seed (the manifest seed is used otherwise)')
    b.add_argument('--keep', help='keep the intermediate images (raw sheet, cut-out) in this folder')
    args = ap.parse_args()
    if args.cmd == 'check':
        sys.exit(check())
    manifest = json.load(open(ART / 'manifest.json'))['assets']
    if args.cmd == 'list':
        for k, v in manifest.items():
            print(f'{k:13} {v["title"]}\n{"":13} {v["kind"]}, writes {v["out"]}')
        return
    if args.asset not in manifest:
        sys.exit(f'unknown asset {args.asset!r}; try: list')
    if Image is None:
        sys.exit('Pillow is missing (pip install pillow); it is needed to build assets')
    try:
        if args.keep:
            Path(args.keep).mkdir(parents=True, exist_ok=True)
            build(args.asset, manifest[args.asset], Path(args.root), args.seed, args.keep)
        else:
            with tempfile.TemporaryDirectory(prefix='overseer-art-') as work:
                build(args.asset, manifest[args.asset], Path(args.root), args.seed, work)
    except comfy.ComfyError as e:
        sys.exit(str(e))


if __name__ == '__main__':
    main()

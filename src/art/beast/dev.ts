// The beasts page (beasts.html): every enemy and dragon of a set in a grid, drawn by Phaser, with its id under it and a pose to play.
//   beasts.html?set=enemies:S&pose=attack&zoom=3     sets: enemies:S enemies:M enemies:L enemies:XL enemies:XXL dragons all
//   beasts.html?id=wolf,goblin,dragon_06             a hand-picked list
import Phaser from 'phaser';
import { BEAST_POSES, FRAMES } from './kit';
import { beastOf } from './look';
import { addBeast } from './phaser';
import { BEAST_SETS, type BeastEntry } from '../dev/sets-beasts';
import type { Pose } from '../anim';

const q = new URLSearchParams(location.search);
const setId = q.get('set') ?? 'enemies:S';
const pose = (q.get('pose') ?? 'idle') as Pose;
const DEFAULT_ZOOM: Record<string, number> = { 'enemies:S': 3, 'enemies:M': 3, 'enemies:L': 2, 'enemies:XL': 1, 'enemies:XXL': 1, dragons: 1, all: 1 };
const zoom = Number(q.get('zoom') ?? DEFAULT_ZOOM[setId] ?? 2);
const ids = q.get('id')?.split(',').filter(Boolean);
const app = document.getElementById('app')!;
app.innerHTML = `<div class="bar">
  <label>ชุด <select id="set">${Object.entries(BEAST_SETS).map(([k, s]) => `<option value="${k}" ${k === setId ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
  <label>ท่า <select id="pose">${BEAST_POSES.map((p) => `<option ${p === pose ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
  <label>ซูม <select id="zoom">${[1, 2, 3, 4, 6].map((z) => `<option ${z === zoom ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
  <span id="count"></span></div><div id="stage"></div>`;
for (const id of ['set', 'pose', 'zoom'])
  (document.getElementById(id) as HTMLSelectElement).onchange = (e) => { q.set(id, (e.target as HTMLSelectElement).value); if (id === 'set') { q.delete('zoom'); q.delete('id'); } location.search = q.toString(); };

const entries: BeastEntry[] = ids
  ? ids.flatMap((id) => { const l = beastOf(id); return l ? [{ id: l.id, label: l.name, look: l }] : []; })
  : BEAST_SETS[setId]?.entries() ?? [];
const CELL = entries.reduce((m, e) => ({ w: Math.max(m.w, FRAMES[e.look.size].w + 8), h: Math.max(m.h, FRAMES[e.look.size].h + 14) }), { w: 56, h: 60 });
const cols = Math.max(1, Math.floor((window.innerWidth - 32) / (CELL.w * zoom)));
const rows = Math.ceil(entries.length / cols);
document.getElementById('count')!.textContent = `${entries.length} ตัว`;

new Phaser.Game({
  type: Phaser.WEBGL, parent: 'stage', width: cols * CELL.w * zoom, height: Math.max(1, rows) * CELL.h * zoom, backgroundColor: '#c8cdd5',
  banner: false, audio: { noAudio: true }, render: { pixelArt: true, antialias: false, roundPixels: true },
  scene: {
    create(this: Phaser.Scene) {
      this.cameras.main.setZoom(zoom).centerOn((cols * CELL.w) / 2, (rows * CELL.h) / 2);
      entries.forEach((e, i) => {
        const fr = FRAMES[e.look.size];
        const cx = (i % cols) * CELL.w + CELL.w / 2, cy = Math.floor(i / cols) * CELL.h + (CELL.h - 14 - fr.h) / 2;
        addBeast(this, e.look, cx, cy + fr.foot, pose);
        this.add.text(cx, (Math.floor(i / cols) + 1) * CELL.h - 12, e.id, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '24px', color: '#2a2c36' }).setOrigin(0.5, 0).setScale(1 / 4).setResolution(1);
      });
    },
  },
});

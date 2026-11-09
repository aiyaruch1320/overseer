// The characters page (characters.html, code-plan §9.3): every figure of a set in a grid, drawn by Phaser at 3×, with its id under it,
// a pose to play, and the part ids the looks name that no table has.
import Phaser from 'phaser';
import { POSES, FRAME, type Pose } from '../anim';
import { addLook } from '../phaser';
import { addBeast } from '../beast/phaser';
import { FRAMES } from '../beast/kit';
import { unknownParts } from '../person';
import { SETS } from './sets';

const q = new URLSearchParams(location.search);
const setId = q.get('set') ?? 'sample';
const pose = (q.get('pose') ?? SETS[setId]?.pose ?? 'idle') as Pose;
const zoom = Number(q.get('zoom') ?? 3);
const app = document.getElementById('app')!;
app.innerHTML = `<div class="bar">
  <label>ชุด <select id="set">${Object.entries(SETS).map(([k, s]) => `<option value="${k}" ${k === setId ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
  <label>ท่า <select id="pose">${POSES.map((p) => `<option ${p.id === pose ? 'selected' : ''}>${p.id}</option>`).join('')}</select></label>
  <label>ซูม <select id="zoom">${[2, 3, 4, 6].map((z) => `<option ${z === zoom ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
  <span id="count"></span></div><div id="stage"></div><pre id="miss"></pre>`;
for (const id of ['set', 'pose', 'zoom'])
  (document.getElementById(id) as HTMLSelectElement).onchange = (e) => { q.set(id, (e.target as HTMLSelectElement).value); location.search = q.toString(); };

// `ids=A,B` shows only those figures of the set (a close look at a few)
const only = q.get('ids')?.split(',');
const entries = (SETS[setId]?.entries() ?? []).filter((e) => !only || only.includes(e.id));
const CELL = { w: 56, h: 60 };
const cols = Math.max(1, Math.floor((window.innerWidth - 32) / (CELL.w * zoom)));
// the creatures of the set (ghosts, slimes …) follow the people, drawn by the beast painter and shrunk to fit a cell
const beastEntries = (SETS[setId]?.beasts?.() ?? []).filter((e) => !only || only.includes(e.id));
const total = entries.length + beastEntries.length;
const rows = Math.ceil(total / cols);
document.getElementById('count')!.textContent = `${entries.length} ตัว${beastEntries.length ? ` + สัตว์และผี ${beastEntries.length}` : ''}`;
const miss = new Map<string, string[]>();
for (const e of entries) for (const u of unknownParts(e.look)) miss.set(u, [...(miss.get(u) ?? []), e.id]);
document.getElementById('miss')!.textContent = miss.size ? `ชิ้นส่วนที่ยังไม่มี:\n${[...miss].map(([u, ids]) => `${u}  (${ids.length}: ${ids.slice(0, 8).join(' ')}${ids.length > 8 ? ' …' : ''})`).join('\n')}` : '';

new Phaser.Game({
  type: Phaser.WEBGL, parent: 'stage', width: cols * CELL.w * zoom, height: Math.max(1, rows) * CELL.h * zoom, backgroundColor: '#c8cdd5',
  banner: false, audio: { noAudio: true }, render: { pixelArt: true, antialias: false, roundPixels: true },
  scene: {
    create(this: Phaser.Scene) {
      this.cameras.main.setZoom(zoom).centerOn((cols * CELL.w) / 2, (rows * CELL.h) / 2);
      entries.forEach((e, i) => {
        const cx = (i % cols) * CELL.w + CELL.w / 2, cy = Math.floor(i / cols) * CELL.h;
        addLook(this, e.look, cx, cy + FRAME.foot, pose);
        this.add.text(cx, cy + FRAME.foot + 2, e.id, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '24px', color: '#2a2c36' }).setOrigin(0.5, 0).setScale(1 / 4).setResolution(1);
      });
      beastEntries.forEach((e, k) => {
        const i = entries.length + k, cx = (i % cols) * CELL.w + CELL.w / 2, cy = Math.floor(i / cols) * CELL.h;
        const fr = FRAMES[e.look.size];
        addBeast(this, e.look, cx, cy + FRAME.foot).setScale(Math.min(1, CELL.w / fr.w, FRAME.foot / fr.foot));
        this.add.text(cx, cy + FRAME.foot + 2, e.id, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '24px', color: '#2a2c36' }).setOrigin(0.5, 0).setScale(1 / 4).setResolution(1);
      });
    },
  },
});

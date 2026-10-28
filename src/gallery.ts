// Character gallery (open /characters.html in the dev server): every race, life stage, pose and animation the painter can produce.
import { lookFor } from './scenes/people';
import { THEMES, STAGES, STAGE_NAME, STAGE_AGE, RACE_IDS } from './render/characters/themes';
import { POSE, WALK, CARRY_WALK, FRAMES } from './render/characters/pose';
import { renderFrame } from './render/characters/portrait';
import { SPECIALS, specialLook, specialStageLook } from './data/specials';
import type { Look } from './render/characters/kit';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const st = { race: 'human', line: '', sex: 'm', outfit: '', role: 'ชาวบ้าน', seed: 7, ppu: 3 };
const ROLES = ['ชาวบ้าน', 'พ่อค้า', 'ทหาร', 'อัศวิน', 'นักบวช', 'ชาวนา', 'ช่างตีเหล็ก', 'นักเวท', 'นักกวีพเนจร', 'ขุนนาง', 'นักผจญภัย', 'นักล่า', 'คนงานเหมือง', 'หมอยา', 'ขอทาน'];
const OUTFITS = ['', 'tunic', 'vest', 'armor', 'knight', 'robe', 'farmer', 'apron', 'cloak', 'noble', 'regal', 'rags', 'dress', 'sarong', 'light', 'fur', 'leather', 'chef', 'miner', 'mage', 'scholar', 'bard', 'sailor', 'monk', 'otherworld', 'priest', 'plate'];
const FRAME_NAMES = Object.entries(POSE).sort((a, b) => a[1] - b[1]).map(([k]) => k);

function makeLook(race = st.race, hAge = STAGE_AGE.adult, line = st.line): Look {
  const L = lookFor(`gallery:${race}:${st.seed}`, race, st.role, { gender: st.sex === 'f' ? 'หญิง' : 'ชาย', hAge, line: line || undefined });
  if (st.outfit) L.outfit = st.outfit;
  return L;
}

function fig(L: Look, frame: number, ppu: number, caption?: string) {
  const f = document.createElement('figure');
  const cv = renderFrame(L, frame, ppu);
  f.append(cv);
  if (caption) { const c = document.createElement('figcaption'); c.textContent = caption; f.append(c); }
  return f;
}

function renderAll() {
  const th = THEMES[st.race];
  $('ppuv').textContent = `${st.ppu}×`;
  const lineSel = $<HTMLSelectElement>('line');
  lineSel.innerHTML = '<option value="">(สุ่ม/ไม่ระบุ)</option>' + Object.entries(th.lines).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  lineSel.value = st.line;
  $('hRace').textContent = `${th.name} (${th.id})`;
  $('motif').textContent = th.motif + (st.line && th.lines[st.line] ? `\nสาย${th.lines[st.line].name}: ${th.lines[st.line].note}` : '');
  $('motif').style.whiteSpace = 'pre-line';
  // race grid
  const grid = $('races'); grid.innerHTML = '';
  for (const id of RACE_IDS) {
    const t = THEMES[id], card = document.createElement('div');
    card.className = 'card' + (id === st.race ? ' sel' : '');
    card.append(renderFrame(makeLook(id, 35, id === st.race ? st.line : ''), POSE.idle, 2.6));
    card.insertAdjacentHTML('beforeend', `<b>${t.name}</b><small>${t.motif.slice(0, 70)}…</small>`);
    card.onclick = () => { st.race = id; st.line = ''; renderAll(); };
    grid.append(card);
  }
  // stages
  const stg = $('stages'); stg.innerHTML = '';
  for (const s of STAGES) stg.append(fig(makeLook(st.race, STAGE_AGE[s]), s === 'infant' ? POSE.idle : POSE.idle, st.ppu, `${STAGE_NAME[s]} (${STAGE_AGE[s]})`));
  // frames
  const frs = $('frames'); frs.innerHTML = '';
  const L = makeLook();
  for (let i = 0; i < FRAMES; i++) frs.append(fig(L, i, Math.min(st.ppu, 2.4), FRAME_NAMES[i]));
  // animations
  const an = $('anims'); an.innerHTML = '';
  const anims: [string, number[], number][] = [
    ['ยืนพัก', THEMES[st.race].idle, 1.2], ['เดิน', WALK, 9], ['เดินแบกของ', CARRY_WALK, 6], ['ทำงาน (ตี/ขุด)', [POSE.work0, POSE.work1, POSE.work2], 3],
    ['นั่งพัก', [POSE.sit, POSE.sit2], 1], ['สวดมนต์', [POSE.kneel, POSE.kneel2], 0.8], ['ฉลอง', [POSE.cheer, POSE.cheer2], 3], ['โบกมือ', [POSE.wave0, POSE.wave1], 3],
    ['พูดคุย', [POSE.talk0, POSE.talk1], 2], ['อ่านหนังสือ', [POSE.read, POSE.sit2], 1], ['ร่ายเวท', [POSE.cast0, POSE.cast1, POSE.idle], 2],
  ];
  anim.length = 0;
  for (const [name, frames, fps] of anims) {
    const f = document.createElement('figure'), cv = document.createElement('canvas');
    f.append(cv); const cap = document.createElement('figcaption'); cap.textContent = name; f.append(cap); an.append(f);
    anim.push({ cv, L, frames, fps, last: -1 });
  }
  // special NPCs
  const sp = $('specials'); sp.innerHTML = '';
  for (const s of SPECIALS) {
    const card = document.createElement('div'); card.className = 'card';
    const row = document.createElement('div'); row.className = 'row'; row.style.justifyContent = 'center';
    for (const stage of s.stages) { const cv = renderFrame(specialStageLook(s.id, stage)!, POSE.idle, 1.4); cv.style.background = 'transparent'; cv.style.width = '20%'; row.append(cv); }
    card.append(row);
    card.insertAdjacentHTML('beforeend', `<b>${s.name}</b><small>${s.id} · ${THEMES[s.race]?.name || s.race} · ${s.title}</small><small>${s.design}</small>`);
    card.onclick = () => { st.race = s.race; renderAll(); };
    sp.append(card);
  }
  void specialLook;
}

const anim: { cv: HTMLCanvasElement; L: Look; frames: number[]; fps: number; last: number }[] = [];
function tick(t: number) {
  for (const a of anim) {
    const i = Math.floor((t / 1000) * a.fps) % a.frames.length;
    if (i !== a.last) { a.last = i; renderFrame(a.L, a.frames[i], st.ppu, a.cv); }
  }
  requestAnimationFrame(tick);
}

function boot() {
  $<HTMLSelectElement>('outfit').innerHTML = OUTFITS.map((o) => `<option value="${o}">${o || '(ตามอาชีพ)'}</option>`).join('');
  $<HTMLSelectElement>('role').innerHTML = ROLES.map((o) => `<option>${o}</option>`).join('');
  $<HTMLInputElement>('ppu').oninput = (e) => { st.ppu = +(e.target as HTMLInputElement).value; renderAll(); };
  $<HTMLSelectElement>('sex').onchange = (e) => { st.sex = (e.target as HTMLSelectElement).value; renderAll(); };
  $<HTMLSelectElement>('line').onchange = (e) => { st.line = (e.target as HTMLSelectElement).value; renderAll(); };
  $<HTMLSelectElement>('outfit').onchange = (e) => { st.outfit = (e.target as HTMLSelectElement).value; renderAll(); };
  $<HTMLSelectElement>('role').onchange = (e) => { st.role = (e.target as HTMLSelectElement).value; renderAll(); };
  $('reroll').onclick = () => { st.seed = Math.floor(Math.random() * 1e6); renderAll(); };
  const q = new URLSearchParams(location.search);
  if (q.get('race') && THEMES[q.get('race')!]) st.race = q.get('race')!;
  if (q.get('line')) st.line = q.get('line')!;
  if (q.get('sex')) { st.sex = q.get('sex')!; $<HTMLSelectElement>('sex').value = st.sex; }
  if (q.get('seed')) st.seed = +q.get('seed')!;
  if (q.get('ppu')) { st.ppu = +q.get('ppu')!; $<HTMLInputElement>('ppu').value = String(st.ppu); }
  renderAll();
  requestAnimationFrame(tick);
}
boot();

// Headless smoke test: plays many lives with random god actions, checks for crashes and pacing.
import { Game, type Meta } from '../src/sim/game';
import { SYMBOLS } from '../src/data/lore';

const N = Number(process.argv[2] || 200);
const meta: Meta = { karma: 0, codex: [], lives: [], racesPlayed: [] };
let ticks = 0, events = 0, pauses = 0, gens = 0;
const ages: number[] = [];
const causes: Record<string, number> = {};
const races: Record<string, number> = {};
const seen = new Set<string>();
const offerR: Record<string, number> = {}; const jobs: Record<string, number> = {}; let npcLines = 0, worldDeaths = 0, prayers = 0, questsDone = 0, goalsDone = 0; const spect: Record<string, number> = {}; const weaponR: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  const g = Game.newGame('seed-' + i, meta);
  if (process.env.AUTO) g.autoDecide = true;
  g.hooks.onSpectacle = (s) => { const k = s.anim.startsWith('fest_') ? 'festival' : s.mine ? s.anim : 'near:' + s.anim; spect[k] = (spect[k] || 0) + 1; };
  g.setQuest(g.questOffers()[0]);
  const prSeen = new Set<number>();
  races[g.c.race] = (races[g.c.race] || 0) + 1;
  let lifeTicks = 0;
  for (let guard = 0; guard < 5000 && !g.s.ended; guard++) {
    if (!g.c.alive) {
      ages.push(g.c.hAge);
      const cause = (g.c.deathCause || '?').slice(0, 14);
      causes[cause] = (causes[cause] || 0) + 1;
      if (g.heirs().length && gens < N) { g.continueAsHeir(0); gens++; continue; }
      break;
    }
    const p = g.s.pending;
    if (p) {
      pauses++;
      if (p.kind === 'death') { g.decideDeath(Math.random() < 0.3 ? 'faith' : null); continue; }
      if (p.kind === 'story') { seen.add(p.storylet.id); if (Math.random() < 0.3) g.sendDream(SYMBOLS[i % SYMBOLS.length].id); g.choiceProbs(p.storylet); events++; if (Math.random() < 0.3) { g.s.faith += 20; g.whisper(0); continue; } }
      g.resolve();
      continue;
    }
    for (const card of [...g.s.prayers]) { if (!prSeen.has(card.uid)) { prSeen.add(card.uid); prayers++; } if (Math.random() < 0.4) g.answerPrayer(card.uid, Math.random() < 0.8 ? 'grant' : 'punish'); }
    if (Math.random() < 0.004) g.castOnCountry('rain', g.c.countryId);
    if (Math.random() < 0.02) { const o = g.offerGifts('blessing'); o.forEach((x) => (offerR[x.rarity] = (offerR[x.rarity] || 0) + 1)); g.giveBlessing(o[0].id); }
    if (Math.random() < 0.003) { g.s.faith += 50; g.giveWeapon('holy'); const w = g.c.weapon; if (w) weaponR[w.rarity] = (weaponR[w.rarity] || 0) + 1; }
    if (Math.random() < 0.01) { const o = g.offerGifts('curse'); g.giveCurse(o[0].id); }
    if (Math.random() < 0.005) g.miracle('heal');
    if (Math.random() < 0.003) g.alterFate(0, 'good');
    g.tick(); ticks++; lifeTicks++;
  }
  JSON.stringify(g.s); // serializable
  if (g.s.quest?.done) questsDone++;
  for (const id of g.s.seenOnce) seen.add(id);
  npcLines += g.s.log.filter((e) => e.text.startsWith(':friend:')).length;
  worldDeaths += g.s.worldNews.filter((e) => /ปราบจอมมาร|สังหารผู้กล้า/.test(e.text)).length;
  goalsDone += g.s.npcs.reduce((a, n) => a + (n.deeds?.length || 0), 0);
  if (g.c.job) jobs[g.c.job] = (jobs[g.c.job] || 0) + 1;
}
ages.sort((a, b) => a - b);
console.log({ lives: N, heirsPlayed: gens, avgTicksPerLife: Math.round(ticks / (N + gens)), avgChoiceEventsPerLife: Math.round(events / (N + gens)), avgPauses: Math.round(pauses / (N + gens)) });
console.log('hAge at death p10/p50/p90', ages[Math.floor(ages.length * 0.1)], ages[Math.floor(ages.length / 2)], ages[Math.floor(ages.length * 0.9)]);
console.log('causes', causes);
console.log('races', races);
console.log('distinct storylets seen', seen.size, 'codex', meta.codex.length);
const by = (pre: string) => [...seen].filter((x) => x.startsWith(pre)).sort();
console.log('chains fired', by('chain_'));
console.log('context events', [...by('birth_'), ...by('minority_'), ...by('rel_'), ...by('thread_')]);
console.log('gift offer rarity', offerR, 'weapon rarity', weaponR);
console.log('prayer cards seen/life', (prayers / N).toFixed(1), 'quests done', questsDone, '/', N);
console.log('npc lines/life', (npcLines / N).toFixed(1), 'final battles', worldDeaths);
console.log('people/world events', [...by('npc_'), ...by('actor_'), ...by('party_'), ...by('demon_')]);
console.log('region events', by('region_'));
console.log('career change seen', seen.has('career_change'), 'new-job stories', by('job_').filter((x) => /scribe|shepherd|carpenter|weaver|servant|teacher|seer|archaeologist|spy|diplomat|gravekeeper|innkeeper|miner|sailor|alchemist|royal/.test(x)).length);
console.log('final jobs', Object.entries(jobs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
const lifeN = N + gens;
console.log('spectacles/life', (Object.values(spect).reduce((a, b) => a + b, 0) / lifeN).toFixed(2), Object.entries(spect).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log('npc goals reached/life', (goalsDone / N).toFixed(1));

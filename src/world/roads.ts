// Roads between towns: every country's towns are tied together (a spanning tree plus a hub at the capital), neighbouring countries
// meet at their nearest towns, island nations are joined by sea lanes and sky routes. Land roads are found over the tile grid so they
// run on land, share trunks (a used tile is cheaper) and bend like real roads.
import type { WorldMap } from '../sim/worldgen';

export interface Road { a: number; b: number; kind: 'road' | 'highway' | 'sea' | 'sky'; pts: number[] } // pts: world units, x/y interleaved

const TILE = 8;

class Heap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): number {
    const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= k.length) break; if (c + 1 < k.length && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

function smooth(p: number[], rounds: number): number[] {
  let a = p;
  for (let r = 0; r < rounds; r++) {
    if (a.length < 6) return a;
    const b = [a[0], a[1]];
    for (let i = 0; i < a.length / 2 - 1; i++) {
      const x0 = a[i * 2], y0 = a[i * 2 + 1], x1 = a[i * 2 + 2], y1 = a[i * 2 + 3];
      b.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
    }
    b.push(a[a.length - 2], a[a.length - 1]);
    a = b;
  }
  return a;
}

export function buildRoads(world: WorldMap): Road[] {
  const { w, h, country, towns, countries } = world;
  const used = new Uint8Array(w * h);
  const stamp = new Int32Array(w * h), gScore = new Float32Array(w * h), parent = new Int32Array(w * h);
  let search = 0;
  const roads: Road[] = [];
  const seen = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  /** A* over land tiles; cheap where a road already runs */
  const route = (a: number, b: number): number[] | null => {
    const A = towns[a], B = towns[b];
    const start = A.y * w + A.x, goal = B.y * w + B.x;
    search++;
    const open = new Heap();
    gScore[start] = 0; stamp[start] = search; parent[start] = -1;
    open.push(0, start);
    let expanded = 0;
    const gx = B.x, gy = B.y;
    const closed = new Set<number>();
    while (open.size && expanded < 90000) {
      const cur = open.pop();
      if (closed.has(cur)) continue;
      closed.add(cur); expanded++;
      if (cur === goal) {
        const tiles: number[] = [];
        for (let n = cur; n >= 0; n = parent[n]) tiles.push((n % w) * TILE + TILE / 2, Math.floor(n / w) * TILE + TILE / 2);
        const pts: number[] = [];
        for (let i = tiles.length - 2; i >= 0; i -= 2) pts.push(tiles[i], tiles[i + 1]);
        return pts;
      }
      const cx = cur % w, cy = (cur - cx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (country[ni] < 0) continue;
        // no cutting corners across water
        if (dx && dy && (country[cy * w + nx] < 0 || country[ny * w + cx] < 0)) continue;
        const step = (dx && dy ? 1.414 : 1) * (used[ni] ? 0.35 : 1) * (1 + (nx + ny) % 3 * 0.04);
        const g = gScore[cur] + step;
        if (stamp[ni] === search && gScore[ni] <= g) continue;
        stamp[ni] = search; gScore[ni] = g; parent[ni] = cur;
        const ddx = Math.abs(nx - gx), ddy = Math.abs(ny - gy);
        open.push(g + 0.55 * (Math.max(ddx, ddy) + 0.414 * Math.min(ddx, ddy)), ni);
      }
    }
    return null;
  };

  const link = (a: number, b: number, kind: Road['kind']) => {
    if (a === b || seen.has(key(a, b))) return;
    seen.add(key(a, b));
    const A = towns[a], B = towns[b];
    if (kind === 'road' || kind === 'highway') {
      const p = route(a, b);
      if (!p) return;
      for (let i = 0; i < p.length; i += 2) used[Math.floor(p[i + 1] / TILE) * w + Math.floor(p[i] / TILE)] = 1;
      roads.push({ a, b, kind, pts: smooth(p, 2) });
    } else {
      // a gentle arc between the two ports
      const x0 = A.x * TILE + TILE / 2, y0 = A.y * TILE + TILE / 2, x1 = B.x * TILE + TILE / 2, y1 = B.y * TILE + TILE / 2;
      const mx = (x0 + x1) / 2 - (y1 - y0) * 0.08, my = (y0 + y1) / 2 + (x1 - x0) * 0.08;
      const pts: number[] = [];
      for (let t = 0; t <= 1.001; t += 0.1) pts.push((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1);
      roads.push({ a, b, kind, pts });
    }
  };
  const dist = (a: number, b: number) => Math.hypot(towns[a].x - towns[b].x, towns[a].y - towns[b].y);
  const nearestPair = (ca: number, cb: number): [number, number] => {
    let best: [number, number] = [countries[ca].towns[0], countries[cb].towns[0]], bd = Infinity;
    for (const a of countries[ca].towns) for (const b of countries[cb].towns) { const d = dist(a, b); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  };

  // 1. inside each country: a spanning tree, then the capital reaches its two nearest towns
  for (const c of countries) {
    const ts = c.towns;
    if (ts.length < 2) continue;
    const inTree = new Set<number>([ts[0]]);
    while (inTree.size < ts.length) {
      let best: [number, number] = [-1, -1], bd = Infinity;
      for (const a of inTree) for (const b of ts) if (!inTree.has(b)) { const d = dist(a, b); if (d < bd) { bd = d; best = [a, b]; } }
      if (best[0] < 0) break;
      inTree.add(best[1]);
      link(best[0], best[1], 'road');
    }
    const cap = ts[0];
    ts.filter((t) => t !== cap).sort((a, b) => dist(cap, a) - dist(cap, b)).slice(0, 2).forEach((t) => link(cap, t, 'road'));
  }
  // 2. neighbouring countries meet at their nearest towns; capitals of neighbours are joined by highways
  const archi = new Set([0, 3]);
  for (const c of countries) for (const n of c.neighbors) {
    if (n < c.id) continue;
    const o = countries[n];
    if (archi.has(c.continent) || archi.has(o.continent)) continue;
    const [a, b] = nearestPair(c.id, n);
    if (dist(a, b) > 90) continue;
    link(a, b, 'road');
    if (dist(c.towns[0], o.towns[0]) < 70) link(c.towns[0], o.towns[0], 'highway');
  }
  // 3. island nations: sea lanes (Nerea) and sky routes (Azgar) to the two nearest neighbours; the great hubs reach everyone
  for (const cont of [0, 3]) {
    const cs = countries.filter((c) => c.continent === cont);
    for (const c of cs) {
      cs.filter((o) => o !== c).sort((x, y) => { const [a1, b1] = nearestPair(c.id, x.id), [a2, b2] = nearestPair(c.id, y.id); return dist(a1, b1) - dist(a2, b2); }).slice(0, 2).forEach((o) => { const [a, b] = nearestPair(c.id, o.id); link(a, b, cont === 0 ? 'sky' : 'sea'); });
    }
    if (cs[0]) for (const o of cs.slice(1)) { const [a, b] = nearestPair(cs[0].id, o.id); link(a, b, cont === 0 ? 'sky' : 'sea'); }
  }
  // 4. routes the docs name: the ten-thousand-step stair, the airship line, the secret waterfall
  const byCode = (code: string) => countries.find((c) => c.code === code);
  for (const [x, y, kind] of [['AZ-04', 'SH-03', 'sky'], ['AZ-08', 'MK-09', 'sky'], ['AZ-09', 'MK-07', 'sky'], ['AZ-06', 'NR-02', 'sky'], ['AZ-03', 'NR-15', 'sky']] as [string, string, Road['kind']][]) {
    const a = byCode(x), b = byCode(y);
    if (a && b) { const [ta, tb] = nearestPair(a.id, b.id); link(ta, tb, kind); }
  }
  return roads;
}

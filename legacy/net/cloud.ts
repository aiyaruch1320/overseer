// Cloud save + playtest statistics. Players are anonymous: a random id kept in localStorage, nothing personal.
// Saves upload at most every 2 minutes (and on important moments); stats are batched.
const PID_KEY = 'isekai.pid';

export function playerId(): string {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(PID_KEY, id); }
    return id;
  } catch { return 'anonymous-player'; }
}

export class Cloud {
  enabled = true; // stats only; saves always sync when the server is reachable
  private lastUpload = 0;
  private queue: { t: number; type: string; data?: unknown }[] = [];

  constructor() {
    try { this.enabled = localStorage.getItem('isekai.stats') !== 'off'; } catch { /* default on */ }
    setInterval(() => this.flush(), 30_000);
    window.addEventListener('beforeunload', () => this.flush(true));
  }

  setStats(on: boolean) { this.enabled = on; try { localStorage.setItem('isekai.stats', on ? 'on' : 'off'); } catch { /* ignore */ } }

  async uploadSave(json: string, force = false) {
    const now = Date.now();
    if (!force && now - this.lastUpload < 120_000) return;
    this.lastUpload = now;
    try {
      // gzip in the browser: a save is ~100 KB of JSON but ~30 KB compressed
      const gz = typeof CompressionStream === 'function';
      const body = gz ? await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer() : json;
      await fetch(`/api/save/${playerId()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) }, body });
    } catch { /* offline: local save is enough */ }
  }

  async downloadSave(): Promise<string | null> {
    try { const r = await fetch(`/api/save/${playerId()}`); return r.ok ? await r.text() : null; } catch { return null; }
  }

  track(type: string, data?: unknown) {
    if (!this.enabled) return;
    this.queue.push({ t: Date.now(), type, data });
    if (this.queue.length >= 40) this.flush();
  }

  flush(beacon = false) {
    if (!this.queue.length) return;
    const body = JSON.stringify({ pid: playerId(), events: this.queue.splice(0, 200) });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
    else fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => { /* drop */ });
  }
}

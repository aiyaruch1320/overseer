// Narration client. The server owns the prompts and the API key; the browser only names a task and passes a few
// short fields. Cheap by design:
// - the server keeps a fixed prompt prefix so the provider's cache covers most input tokens
// - per-life caps by role + small output limits (set server-side)
// - answers cached in localStorage; the game never waits on narration (template text shows first)

// Effects an LLM-written event may apply (whitelist — the model picks one key, never free-form effects)
export const LLM_FX: Record<string, string> = {
  pow: 'pow+1', mag: 'mag+1', spd: 'spd+1', luk: 'luk+1', int: 'int+1', vit: 'vit+1',
  gold: 'gold+15', loss: 'gold-10', fame: 'fame+4', shame: 'fame-3', hurt: 'hp-10', heal: 'hp+15',
  kind: 'kind+8', cruel: 'kind-8', brave: 'brave+8', faith: 'belief+5 faith+3', doubt: 'belief-5', none: '',
};
const FLAVOR_TOPICS = ['อาหาร', 'สัตว์', 'ข่าวลือ', 'สภาพอากาศ', 'เพื่อนบ้าน', 'ของหาย', 'เทศกาล', 'คนแปลกหน้า', 'งานที่ทำ', 'ครอบครัว', 'ความเชื่อ', 'เรื่องน่าอาย'];

type Role = 'fate' | 'dream' | 'epitaph' | 'flavor' | 'setup';
// per-life caps by role; the epitaph (for the share card) is never starved by cheaper flavor calls
const ROLE_CAP: Record<Role, number> = { fate: 5, dream: 3, epitaph: 1, flavor: 4, setup: 30 };

export interface LlmStats { enabled: boolean; model: string; calls: number; budget: number; byRole: Record<Role, number>; promptTokens: number; completionTokens: number; cacheHitTokens: number; errors: number; lastError: string }

const CACHE_KEY = 'isekai.llmcache';

export class Narrator {
  stats: LlmStats = { enabled: false, model: '', calls: 0, budget: 12, byRole: { fate: 0, dream: 0, epitaph: 0, flavor: 0, setup: 0 }, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, errors: 0, lastError: '' };
  userEnabled = true;
  private cache: Record<string, string> = {};

  async init() {
    try { this.cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { this.cache = {}; }
    try {
      const r = await fetch('/api/narrate/status');
      const j = await r.json();
      this.stats.enabled = !!j.enabled;
    } catch { this.stats.enabled = false; }
    try { this.userEnabled = localStorage.getItem('isekai.llm') !== 'off'; } catch { /* ignore */ }
  }

  get active() { return this.stats.enabled && this.userEnabled; }
  newLife() { this.stats.calls = 0; this.stats.byRole = { ...this.stats.byRole, fate: 0, dream: 0, epitaph: 0, flavor: 0 }; }
  setEnabled(v: boolean) { this.userEnabled = v; try { localStorage.setItem('isekai.llm', v ? 'on' : 'off'); } catch { /* ignore */ } }

  private hash(s: string) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  private async ask(task: Role, data: Record<string, string>, raw = false): Promise<string | null> {
    if (!this.active) return null;
    const key = this.hash(task + JSON.stringify(data));
    if (this.cache[key]) return this.cache[key];
    if (this.stats.byRole[task] >= ROLE_CAP[task]) return null;
    if (task !== 'epitaph' && task !== 'setup' && this.stats.calls >= this.stats.budget) return null;
    if (task !== 'setup') this.stats.calls++;
    this.stats.byRole[task]++;
    try {
      const r = await fetch('/api/narrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, data }) });
      const j = await r.json();
      if (!r.ok || !j.text) throw new Error(j.error || 'empty');
      if (j.usage) {
        this.stats.promptTokens += j.usage.prompt_tokens || 0;
        this.stats.completionTokens += j.usage.completion_tokens || 0;
        this.stats.cacheHitTokens += j.usage.prompt_cache_hit_tokens || 0;
      }
      if (raw) return String(j.text);
      // drop stray English words from the prose, but keep the ||effect key used by flavor events
      const [body, ...rest] = String(j.text).split('||');
      const clean = body.replace(/[A-Za-z]{2,}/g, '').replace(/\s*\n+\s*/g, ' ').replace(/ {2,}/g, ' ').replace(/^["“”']+|["“”']+$/g, '').trim();
      const text = [clean, ...rest].join('||');
      this.cache[key] = text;
      const keys = Object.keys(this.cache);
      if (keys.length > 300) delete this.cache[keys[0]];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache)); } catch { /* ignore */ }
      return text;
    } catch (e) {
      this.stats.errors++;
      this.stats.lastError = String((e as Error).message || e);
      return null;
    }
  }

  private prose(p: Promise<string | null>) { return p.then((t) => (t ? t.split('||')[0].trim() : t)); }

  fate(c: Record<string, string>) { return this.prose(this.ask('fate', c)); }
  dream(c: Record<string, string>) { return this.prose(this.ask('dream', c)); }
  epitaph(c: Record<string, string>) { return this.prose(this.ask('epitaph', c)); }

  async setup(wish: string): Promise<Record<string, unknown> | null> {
    const out = await this.ask('setup', { wish: wish.slice(0, 300) }, true);
    if (!out) return null;
    try { const m = out.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
  }

  async flavor(c: Record<string, string>): Promise<{ text: string; fx: string } | null> {
    // a topic keeps repeated calls for the same character from returning the same (cached) event
    const topic = FLAVOR_TOPICS[Math.floor(Math.random() * FLAVOR_TOPICS.length)];
    const out = await this.ask('flavor', { ...c, topic });
    if (!out) return null;
    const [text, fxKey] = out.split('||').map((s) => s.trim());
    if (!text) return null;
    return { text, fx: LLM_FX[(fxKey || 'none').replace(/[^a-z]/g, '')] ?? '' };
  }
}

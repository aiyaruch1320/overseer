// The game's LLM endpoint (server/llm-api.ts) and the browser's provider (src/core/llm/http.ts), offline: a fake provider behind a real HTTP server on a free port.
// god/05-llm.md §1 rule 7: the key stays on the server, the browser sends the point and its data only, and the server adds the fixed system text itself.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLlmApi, LIMITS } from '../../server/llm-api';
import { FakeProvider, makeLlm, MemoryCache, ProviderError, type Fixtures } from '../../src/core/llm';
import { httpProvider, llmStatus } from '../../src/core/llm/http';
import { ENDING_SYSTEM } from '../../src/core/llm/prompts';
import { MAX_TOKENS, MODEL, TEMPERATURE } from '../../src/core/llm/tuning';

const fixtures: Fixtures = {
  responses: [
    { point: 'ending', answers: ['ทอร์เวนเกิดที่ทุ่งกว้างและเติบโตขึ้นท่ามกลางผู้คนที่รักเขา\n\nเมื่อถึงวันสุดท้าย ทอร์เวนจากไปอย่างสงบในบ้านของตน'] },
    { point: 'director', mode: 'credit', answers: [''] },
  ],
};

async function serve(handler: ReturnType<typeof createLlmApi>): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/llm` };
}

describe('the LLM endpoint of the game server', () => {
  const fake = new FakeProvider(fixtures);
  let on: { server: Server; base: string };
  let off: { server: Server; base: string };
  beforeAll(async () => {
    on = await serve(createLlmApi({ env: { OVERSEER_LLM: 'fake', OVERSEER_LLM_POINTS_OFF: 'command' }, provider: fake, ledger: false }));
    off = await serve(createLlmApi({ env: {}, ledger: false }));
  });
  afterAll(() => {
    on.server.close();
    off.server.close();
  });

  it('tells its switches: off by default, and a point the environment shuts', async () => {
    expect(await llmStatus({ base: off.base })).toMatchObject({ enabled: false });
    const s = await llmStatus({ base: on.base });
    expect(s).toMatchObject({ enabled: true, provider: 'fake', points: { command: false, director: true, ending: true } });
    // no server at all (a static host) is a server with the layer off
    expect((await llmStatus({ base: 'http://127.0.0.1:9/api/llm' })).enabled).toBe(false);
  });

  it('adds the fixed system text, model, temperature and ceiling of the point itself: the browser sends the point and the data only', async () => {
    const r = await httpProvider({ base: on.base }).complete({ point: 'ending', model: 'anything', system: 'IGNORED', user: 'ข้อมูลของชีวิต', maxTokens: 99999, temperature: 2 });
    expect(r.text).toMatch(/^ทอร์เวนเกิด/);
    const sent = fake.calls.at(-1)!;
    expect(sent).toMatchObject({ point: 'ending', system: ENDING_SYSTEM, model: MODEL, maxTokens: MAX_TOKENS.ending, temperature: TEMPERATURE.ending, user: 'ข้อมูลของชีวิต' });
  });

  it('refuses what is not one of the three tasks, a shut point, bad data, and passes the kind of a provider failure', async () => {
    const post = (body: unknown) => fetch(`${on.base}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post({ point: 'chat', user: 'x' })).status).toBe(400);
    expect((await post({ point: 'command', user: 'x' })).status).toBe(503);
    expect((await post({ point: 'ending', user: '' })).status).toBe(400);
    expect((await post({ point: 'ending', user: 'ก'.repeat(LIMITS.userChars + 1) })).status).toBe(400);
    const e = await httpProvider({ base: on.base })
      .complete({ point: 'director', model: '', system: '', user: 'ทาง ก หรือ ข', schema: { type: 'object' }, maxTokens: 1, temperature: 0 })
      .catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect((e as ProviderError).kind).toBe('credit');
    // the server with the layer off answers nothing
    expect((await fetch(`${off.base}/complete`, { method: 'POST', body: JSON.stringify({ point: 'ending', user: 'x' }) })).status).toBe(503);
  });

  it('holds an address to its share of requests in ten minutes', async () => {
    let t = 0;
    const api = await serve(createLlmApi({ env: { OVERSEER_LLM: 'fake' }, provider: new FakeProvider(fixtures), ledger: false, now: () => t }));
    const post = () => fetch(`${api.base}/complete`, { method: 'POST', body: JSON.stringify({ point: 'ending', user: 'ข้อมูล' }) });
    for (let i = 0; i < LIMITS.perAddress; i++) expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
    t += LIMITS.windowMs + 1;
    expect((await post()).status).toBe(200);
    api.server.close();
  });

  it('the layer on the browser provider answers the end summary through the server, and falls back to the template when the server says no', async () => {
    const llm = makeLlm({ config: { enabled: true }, provider: httpProvider({ base: on.base }), cache: new MemoryCache() });
    const input = { lifeId: 'L1', name: 'ทอร์เวน', pronoun: 'เขา', race: 'มนุษย์', age: 61, ending: '', facts: ['เกิดที่ทุ่ง', 'ตายในบ้าน'], names: [], template: 'แม่แบบ' };
    expect((await llm.summarizeEnding(input)).source).toBe('llm');
    const none = makeLlm({ config: { enabled: true }, provider: httpProvider({ base: off.base }), cache: new MemoryCache() });
    expect((await none.summarizeEnding({ ...input, lifeId: 'L2' })).source).toBe('template');
  });
});

// The LLM of the game page: asks the page's own server whether its LLM is on (`/api/llm/status`, server/llm-api.ts) and, if so, hands the store an `Llm` whose provider
// is that server (src/core/llm/http.ts). The key never reaches the page. With the server off, or no server (a static host), the store has no `Llm` and the game plays
// on the templates, exactly as before (god/05-llm.md §1 rule 6). The player's own switches (Settings.llm) are read by the layer at every call.
import { httpProvider, llmStatus, type LlmStatus } from '../core/llm/http';
import { makeLlm, MemoryCache, type Llm } from '../core/llm';

export async function connectLlm(opts: { fetch?: typeof fetch } = {}): Promise<{ llm?: Llm; status: LlmStatus }> {
  const status = await llmStatus(opts);
  if (!status.enabled) return { status };
  const llm = makeLlm({ config: { enabled: true, points: status.points }, provider: httpProvider(opts), cache: new MemoryCache() });
  return { llm, status };
}

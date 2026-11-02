// The policy functions of the god system, found at run time (docs/guide/code-plan.md §8.0, docs/systems/god/06-implementation.md §4).
// The god system (src/core/god) and its acts (src/core/god/acts) export `policyStep(ctx, policy)` / `actsPolicyStep(ctx, policy)`.
// They may not exist in a branch, so the tools never import them statically: the node tools fill this registry with
// `loadGodHooks()` (god-hooks-node.ts), the debug page with its own import, a test with `registerPolicyStep`.
// Browser safe: no node imports here.
import type { Ctx } from '../../src/core/game';

export type PolicyStep = (ctx: Ctx, policy: string) => void;

const hooks = new Map<string, PolicyStep>();

export function registerPolicyStep(name: string, fn: PolicyStep): void {
  hooks.set(name, fn);
}

export function clearPolicySteps(): void {
  hooks.clear();
}

export function policyStepNames(): string[] {
  return [...hooks.keys()];
}

/** Calls every registered policy function once; returns how many were called. */
export function runPolicySteps(ctx: Ctx, policy: string): number {
  for (const fn of hooks.values()) fn(ctx, policy);
  return hooks.size;
}

// Finds the god system's policy functions for the node tools. The module names are held in variables on purpose:
// a branch without src/core/god still type-checks and runs, and the tool says the policy has no effect yet.
import { registerPolicyStep, type PolicyStep } from './god-hooks';

const CANDIDATES: { name: string; specs: string[]; fn: string }[] = [
  { name: 'god', specs: ['../../src/core/god/index.ts', '../../src/core/god.ts'], fn: 'policyStep' },
  { name: 'god.acts', specs: ['../../src/core/god/acts/index.ts'], fn: 'actsPolicyStep' },
];

let loaded: Promise<string[]> | null = null;

/** Imports what exists and registers it; returns the names found. Safe to call many times. */
export function loadGodHooks(): Promise<string[]> {
  loaded ??= (async () => {
    const found: string[] = [];
    for (const c of CANDIDATES) {
      for (const spec of c.specs) {
        let mod: Record<string, unknown>;
        try {
          mod = (await import(/* @vite-ignore */ spec)) as Record<string, unknown>;
        } catch (err) {
          // a missing file is normal; a file that exists but fails to load is a real error
          // (only when the message names this very file: a missing import inside an existing module must still fail loudly)
          const msg = String((err as Error)?.message);
          const tail = spec.replace(/^(\.\.\/)+/, '');
          if (/Cannot find module|Failed to load url|Failed to resolve|does not exist|ENOENT/i.test(msg) && msg.includes(tail)) continue;
          throw err;
        }
        const fn = mod[c.fn];
        if (typeof fn === 'function') {
          registerPolicyStep(c.name, fn as PolicyStep);
          found.push(c.name);
        }
        break;
      }
    }
    return found;
  })();
  return loaded;
}

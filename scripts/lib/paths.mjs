// Shared paths for the node scripts: the repo root and docs folder, wherever the script lives.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const docs = path.join(root, 'docs');

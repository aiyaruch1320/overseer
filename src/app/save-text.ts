// The text of a save in the browser's storage. A save is the whole state as JSON (src/core/save, untouched): 0.6 to 1 MB for one life and more for a
// lineage, and `localStorage` holds about 5 MB for the whole origin. The NPC table and the log repeat the same keys and words, so gzip shrinks the
// text about six times. The stored text is `gz1:` and the base64 of the gzip; a text without that prefix is an older save (plain JSON) and loads as it is.
// Where the browser has no `CompressionStream` the text is stored plain (and a compressed save then cannot be read there: it says so).

export const PACKED = 'gz1:';

const CHUNK = 0x8000;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  // the Blob is the way to feed a stream from memory in every browser that has the stream classes
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The text to store for a save text: gzip + base64 behind the `gz1:` mark, or the text itself when the browser cannot compress. */
export async function pack(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return text;
  return PACKED + toBase64(await pipe(new TextEncoder().encode(text), new CompressionStream('gzip')));
}

/** The save text of a stored text: packed or plain (an older save). Throws when it is packed and the browser cannot unpack it. */
export async function unpack(stored: string): Promise<string> {
  if (!stored.startsWith(PACKED)) return stored;
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  return new TextDecoder().decode(await pipe(fromBase64(stored.slice(PACKED.length)), new DecompressionStream('gzip')));
}

// A setup as a link or a file (#5). The link carries the setup in the URL
// hash, `#c=` followed by the config as JSON, compressed with deflate-raw and
// written in base64url; a browser never sends the hash to a server. The file
// is the same JSON, pretty-printed.
//
// Only a `DebateConfig` goes in: the format and the topics. The session (the
// students' names, timings, votes, scores) cannot be passed, and whatever else
// an object might carry is dropped, because the config is rebuilt from its
// known fields before it is written. This module is on the shareable side of
// the model: it cannot reach the session modules (boundaries.test.ts).
//
// Reading goes the other way and ends in `parseConfig`, so a link or a file is
// checked like any other setup from outside. Problems come back as issues
// (`ConfigResult`), never as exceptions.

import type { DebateConfig } from './config';
import { parseConfig, parseConfigJson, type ConfigResult } from './validate';

/** The name of the setup in the hash: `#c=…`. */
export const LINK_KEY = 'c';

/**
 * Most characters of an encoded setup that a link may have. The largest
 * setup `parseConfig` accepts stays well below it (share.test.ts checks), so
 * every setup the app holds can be shared.
 */
export const MAX_LINK_LENGTH = 256 * 1024;

/** Most bytes of a setup as JSON: what a link unpacks to, or a file holds. */
export const MAX_SETUP_BYTES = 1024 * 1024;

const TOO_LARGE: ConfigResult = { ok: false, issues: [{ code: 'too-large', path: [] }] };
const INVALID_LINK: ConfigResult = { ok: false, issues: [{ code: 'invalid-link', path: [] }] };

/**
 * The config rebuilt from its known fields only. The app only ever holds a
 * valid setup, so a config that does not validate is a bug in the caller.
 */
function shareable(config: DebateConfig): DebateConfig {
  const result = parseConfig(config);
  if (!result.ok) throw new Error('Only a valid setup can be shared.');
  return result.config;
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

/** The setup as the text after `#c=`: base64url of the deflated JSON. */
export async function encodeConfig(config: DebateConfig): Promise<string> {
  const json = JSON.stringify(shareable(config));
  const packed = await transform(
    new TextEncoder().encode(json),
    new CompressionStream('deflate-raw'),
  );
  return toBase64Url(packed);
}

/** The setup in the text after `#c=`, checked by `parseConfig`. */
export async function decodeConfig(encoded: string): Promise<ConfigResult> {
  if (encoded.length > MAX_LINK_LENGTH) return TOO_LARGE;
  const packed = fromBase64Url(encoded);
  if (packed === null) return INVALID_LINK;
  let bytes: Uint8Array;
  try {
    bytes = await transform(packed, new DecompressionStream('deflate-raw'), MAX_SETUP_BYTES);
  } catch (error) {
    return error instanceof TooLarge ? TOO_LARGE : INVALID_LINK;
  }
  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return INVALID_LINK;
  }
  return parseConfigJson(json);
}

/** `page` (an address, with or without a hash) with the encoded setup as its hash. */
export function linkTo(page: string, encoded: string): string {
  const hash = page.indexOf('#');
  return `${hash < 0 ? page : page.slice(0, hash)}#${LINK_KEY}=${encoded}`;
}

/**
 * The encoded setup in a hash such as `location.hash`, or `null` when the
 * hash holds none. `#c=` with nothing after it is an empty string, which
 * `decodeConfig` reports as a broken link.
 */
export function readLinkHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(LINK_KEY);
}

// ---------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------

/** The setup as the text of a .json file: pretty-printed, ending in a newline. */
export function configFileText(config: DebateConfig): string {
  return `${JSON.stringify(shareable(config), null, 2)}\n`;
}

/** The setup in a .json file (a `File` from a file input), checked by `parseConfig`. */
export async function readConfigFile(file: Blob): Promise<ConfigResult> {
  if (file.size > MAX_SETUP_BYTES) return TOO_LARGE;
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, issues: [{ code: 'invalid-json', path: [] }] };
  }
  return parseConfigJson(text);
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

class TooLarge extends Error {}

/**
 * `bytes` through a compression or decompression stream. Reading stops, and
 * `TooLarge` is thrown, once the output passes `limit` bytes: a small link
 * must not unpack to more than a setup can be.
 */
async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit = Number.POSITIVE_INFINITY,
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  // A failure on the writing side also errors the reading side, where it is
  // handled; this only keeps it from being reported as unhandled.
  written.catch(() => {});

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new TooLarge();
    }
    chunks.push(value);
  }
  await written;

  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // In slices: spreading a large array into one call overflows the stack.
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes, or `null` when `text` is not base64url (without padding). */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1 || text === '') return null;
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  let binary: string;
  try {
    binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  } catch {
    return null;
  }
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

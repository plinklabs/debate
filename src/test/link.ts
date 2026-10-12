// Packs and unpacks the setup of a link (`#c=…`, src/model/share.ts) with the
// platform's streams directly, so tests can look inside a link, or make a
// broken one, without the code under test.

async function through(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes).then(() => writer.close());
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    chunks.push(next.value);
  }
  const out = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** What goes after `#c=` for any text or bytes: deflate-raw, then base64url. */
export async function pack(content: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return base64Url(await through(bytes, new CompressionStream('deflate-raw')));
}

/** The text inside what goes after `#c=`, or inside a whole link. */
export async function unpack(encodedOrLink: string): Promise<string> {
  const encoded = encodedOrLink.replace(/^.*#c=/, '');
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(await through(bytes, new DecompressionStream('deflate-raw')));
}

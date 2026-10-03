/**
 * Reading a JSON request body with a size limit.
 *
 * `await request.json()` has no ceiling: it buffers whatever the caller sends. On a serverless function
 * that is a cheap way for a stranger to spend the app's memory — no authentication needed, since the body is
 * read before anything else can reject the request. Every endpoint knows roughly how big its own payload is,
 * so every endpoint states a limit.
 *
 * The advertised `Content-Length` is checked first, which refuses an oversized upload before reading it, and
 * the real length is checked again while reading, because that header is the caller's word.
 */

export interface JsonBodyTooLarge {
  readonly tooLarge: true;
  readonly response: Response;
}

export type JsonBodyResult = { tooLarge?: false; value: unknown } | JsonBodyTooLarge;

/** Largest JSON body for a small payload: a SIWE completion, a sign request, a dev login. */
export const SMALL_JSON_BYTES = 16 * 1024;

/**
 * Largest JSON body for a World ID proof. Proofs are a few kilobytes of hex; this is generous for one and
 * still far from a payload worth buffering by accident.
 */
export const PROOF_JSON_BYTES = 64 * 1024;

function tooLarge(): JsonBodyTooLarge {
  return {
    tooLarge: true,
    response: Response.json({ error: 'request body is too large' }, { status: 413 }),
  };
}

/**
 * Reads and parses a JSON body, refusing anything over `maxBytes`.
 *
 * Returns `{ value }` for a body that parsed — `value` is `unknown` on purpose, so the caller still has to
 * validate its shape — `{ value: undefined }` for a body that did not parse, and `{ tooLarge, response }`
 * for one that was refused on size.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const advertised = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(advertised) && advertised > maxBytes) return tooLarge();

  const body = request.body;
  if (!body) return { value: undefined };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      // Checked as it arrives rather than after: the point is not to hold the oversized body at all.
      if (total > maxBytes) {
        await reader.cancel();
        return tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { value: JSON.parse(new TextDecoder().decode(joined)) };
  } catch {
    return { value: undefined };
  }
}

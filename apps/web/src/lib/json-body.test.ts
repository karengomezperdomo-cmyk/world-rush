import { describe, expect, it } from 'vitest';
import { readJsonBody, SMALL_JSON_BYTES } from './json-body';

/**
 * The limit has to hold whether or not the caller is honest about it, which is the whole reason this exists:
 * `Content-Length` is the caller's word, and a body can simply keep arriving.
 */

function post(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api', { method: 'POST', body, headers });
}

describe('readJsonBody', () => {
  it('parses a body within the limit', async () => {
    const result = await readJsonBody(post(JSON.stringify({ action: 'verify' })), SMALL_JSON_BYTES);
    expect(result.tooLarge).toBeFalsy();
    expect(result).toMatchObject({ value: { action: 'verify' } });
  });

  it('refuses a body that declares itself too large, before reading it', async () => {
    const result = await readJsonBody(
      post('{}', { 'content-length': String(SMALL_JSON_BYTES + 1) }),
      SMALL_JSON_BYTES,
    );
    expect(result.tooLarge).toBe(true);
    expect((result as { response: Response }).response.status).toBe(413);
  });

  it('refuses a body that is too large despite a small declared length', async () => {
    // The header lies; the bytes are what count.
    const oversized = JSON.stringify({ padding: 'x'.repeat(SMALL_JSON_BYTES) });
    const result = await readJsonBody(
      post(oversized, { 'content-length': '10' }),
      SMALL_JSON_BYTES,
    );
    expect(result.tooLarge).toBe(true);
  });

  it('reports unparsable JSON as no value rather than throwing', async () => {
    const result = await readJsonBody(post('not json'), SMALL_JSON_BYTES);
    expect(result.tooLarge).toBeFalsy();
    expect((result as { value: unknown }).value).toBeUndefined();
  });

  it('treats a missing body as no value', async () => {
    const result = await readJsonBody(new Request('https://example.test/api'), SMALL_JSON_BYTES);
    expect((result as { value: unknown }).value).toBeUndefined();
  });
});

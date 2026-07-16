import { describe, expect, it } from 'vitest';
import { MyntloClient } from '../src/client';
import { verifyMyntloWebhook } from '../src/webhooks';
import { MyntloAuthError } from '../src/errors';

describe('webhook signature verification', () => {
  const secret = 'whsec_test';
  const payload = JSON.stringify({ id: 'evt_1', type: 'meeting.processing' });

  it('MyntloClient.verifyWebhook resolves with the parsed event for a valid signature', async () => {
    const signature = await signWebhook(payload, secret);

    const event = await MyntloClient.verifyWebhook(payload, signature, secret);

    expect(event.type).toBe('meeting.processing');
  });

  it('verifyMyntloWebhook resolves with the parsed event for a valid signature', async () => {
    const signature = await signWebhook(payload, secret);

    const event = await verifyMyntloWebhook<{ id: string; type: string }>({ payload, signature, secret });

    expect(event.type).toBe('meeting.processing');
  });

  it('MyntloClient.verifyWebhook rejects a wrong signature of the same length', async () => {
    const signature = await signWebhook(payload, secret);
    const sameLengthWrongSignature = signature.slice(0, -1) + (signature.at(-1) === '0' ? '1' : '0');

    await expect(MyntloClient.verifyWebhook(payload, sameLengthWrongSignature, secret)).rejects.toBeInstanceOf(
      MyntloAuthError,
    );
  });

  it('verifyMyntloWebhook rejects a wrong signature of the same length', async () => {
    const signature = await signWebhook(payload, secret);
    const sameLengthWrongSignature = signature.slice(0, -1) + (signature.at(-1) === '0' ? '1' : '0');

    await expect(
      verifyMyntloWebhook({ payload, signature: sameLengthWrongSignature, secret }),
    ).rejects.toBeInstanceOf(MyntloAuthError);
  });

  it('MyntloClient.verifyWebhook rejects a signature of a different length without throwing a raw RangeError', async () => {
    await expect(MyntloClient.verifyWebhook(payload, '', secret)).rejects.toBeInstanceOf(MyntloAuthError);
    await expect(MyntloClient.verifyWebhook(payload, 'deadbeef', secret)).rejects.toBeInstanceOf(MyntloAuthError);
  });

  it('verifyMyntloWebhook rejects a signature of a different length without throwing a raw RangeError', async () => {
    await expect(verifyMyntloWebhook({ payload, signature: '', secret })).rejects.toBeInstanceOf(MyntloAuthError);
    await expect(
      verifyMyntloWebhook({ payload, signature: 'deadbeef', secret }),
    ).rejects.toBeInstanceOf(MyntloAuthError);
  });

  it('MyntloClient.verifyWebhook rejects a signature with equal JS .length but different encoded byte length', async () => {
    const signature = await signWebhook(payload, secret);
    // Same string .length as `signature` (a 64-char hex digest), but a multi-byte
    // character makes the UTF-8 encoded byte length differ - this is the case
    // that bypasses a naive string-length guard and would otherwise reach
    // crypto.timingSafeEqual with mismatched buffer lengths.
    const sameJsLengthDifferentByteLength = signature.slice(0, -1) + 'é';

    await expect(
      MyntloClient.verifyWebhook(payload, sameJsLengthDifferentByteLength, secret),
    ).rejects.toBeInstanceOf(MyntloAuthError);
  });

  it('verifyMyntloWebhook rejects a signature with equal JS .length but different encoded byte length', async () => {
    const signature = await signWebhook(payload, secret);
    const sameJsLengthDifferentByteLength = signature.slice(0, -1) + 'é';

    await expect(
      verifyMyntloWebhook({ payload, signature: sameJsLengthDifferentByteLength, secret }),
    ).rejects.toBeInstanceOf(MyntloAuthError);
  });
});

async function signWebhook(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, payloadBytes);
    return bufferToHex(new Uint8Array(signature));
  }

  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(payloadBytes).digest('hex');
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

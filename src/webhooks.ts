import { MyntloAuthError } from './errors';

// TODO: Backend webhook signing format required:
// The Myntlo API must sign outgoing webhook payloads using HMAC-SHA256.
// Signing algorithm: HMAC-SHA256(webhookSecret, rawRequestBody) → lowercase hex string
// The resulting hex digest must be sent in the HTTP header: `myntlo-signature`
// Example (Node.js): createHmac('sha256', secret).update(rawBody).digest('hex')
// The webhook secret is configured per endpoint in the Myntlo dashboard.

export type VerifyWebhookInput = {
  payload: string | Uint8Array;
  signature: string;
  secret: string;
};

export async function verifyMyntloWebhook<T = unknown>(input: VerifyWebhookInput): Promise<T> {
  const { payload, signature, secret } = input;
  const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
  const expected = await computeHmacSHA256(payloadBytes, secret);

  if (!timingSafeEqual(expected, signature)) {
    throw new MyntloAuthError({
      message: 'Invalid webhook signature.',
      statusCode: 401,
    });
  }

  const payloadText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  return JSON.parse(payloadText) as T;
}

async function computeHmacSHA256(payload: Uint8Array, secret: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, new Uint8Array(payload));
    return bufferToHex(new Uint8Array(signature));
  }

  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(expected: string, received: string): boolean {
  if (expected.length !== received.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < expected.length; i += 1) {
    result |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return result === 0;
}

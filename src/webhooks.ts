import { MyntloAuthError } from './errors';
import { computeHmacSHA256, timingSafeEqualHex } from './internal/webhookCrypto';

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

  if (!(await timingSafeEqualHex(expected, signature))) {
    throw new MyntloAuthError({
      message: 'Invalid webhook signature.',
      statusCode: 401,
    });
  }

  const payloadText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  return JSON.parse(payloadText) as T;
}

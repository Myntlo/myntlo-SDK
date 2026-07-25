import { MyntloAuthError } from './errors';
import { computeHmacSHA256, timingSafeEqualHex, isWebhookFresh } from './internal/webhookCrypto';

// Backend webhook signing format (implemented server-side as of 2026-07-25):
// HMAC-SHA256(webhookSecret, rawRequestBody) → lowercase hex string, sent in
// the `myntlo-signature` header. The webhook secret is generated once, shown
// exactly once, when registering an endpoint (Settings > Developer).

export type VerifyWebhookInput = {
  payload: string | Uint8Array;
  signature: string;
  secret: string;
  /**
   * Reject payloads whose `createdAt` is older (or, allowing for clock skew,
   * further in the future) than this many seconds. A validly-signed payload
   * stays valid forever if only the signature is checked - anyone who ever
   * saw one (a log line, a proxy, a compromised downstream system) could
   * replay it later to trigger the same side effects again. Off by default
   * for backward compatibility and because T is generic here (not every
   * caller's payload has a createdAt field); pass 300 (5 minutes) unless you
   * have a reason not to.
   */
  toleranceSeconds?: number;
};

export async function verifyMyntloWebhook<T = unknown>(input: VerifyWebhookInput): Promise<T> {
  const { payload, signature, secret, toleranceSeconds } = input;

  // An empty secret would make HMAC('', payload) trivially reproducible by
  // anyone - reject it outright rather than "verifying" against a key that
  // provides no security (e.g. a misconfigured secrets manager returning "").
  if (!secret) {
    throw new MyntloAuthError({
      message: 'Webhook secret must not be empty.',
      statusCode: 401,
    });
  }

  const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
  const expected = await computeHmacSHA256(payloadBytes, secret);

  if (!(await timingSafeEqualHex(expected, signature))) {
    throw new MyntloAuthError({
      message: 'Invalid webhook signature.',
      statusCode: 401,
    });
  }

  const payloadText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  const parsed = JSON.parse(payloadText) as T;

  if (toleranceSeconds !== undefined && !isWebhookFresh(parsed, toleranceSeconds)) {
    throw new MyntloAuthError({
      message: 'Webhook payload is outside the allowed freshness window.',
      statusCode: 401,
    });
  }

  return parsed;
}

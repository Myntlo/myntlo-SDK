async function computeHmacSHA256(payload: Uint8Array | ArrayBuffer, secret: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const payloadBytes = payload instanceof Uint8Array ? new Uint8Array(payload) : new Uint8Array(payload);
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, payloadBytes);
    return bufferToHex(new Uint8Array(signature));
  }

  const { createHmac } = await import('node:crypto');
  const data = payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload;
  return createHmac('sha256', secret).update(data).digest('hex');
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function timingSafeEqualHex(expected: string, actual: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(actual);
  // Compare encoded byte length, not JS string .length - a multi-byte character
  // can share .length with a differently-sized encoded buffer, which is exactly
  // the mismatched-length case crypto.timingSafeEqual throws on.
  if (a.length !== b.length) return false;

  try {
    const { timingSafeEqual } = await import('node:crypto');
    return timingSafeEqual(a, b);
  } catch (err) {
    if (err instanceof RangeError) throw err;
    // Non-Node environment fallback (node:crypto unavailable): manual
    // constant-time comparison. Lengths are already confirmed equal above.
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0;
  }
}

export { computeHmacSHA256, bufferToHex, timingSafeEqualHex };

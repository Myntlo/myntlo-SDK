// Example Express-style webhook handler. Server-side only.
import { verifyMyntloWebhook, MyntloAuthError } from '../src';
import type { WebhookEvent } from '../src';

async function handleWebhookRequest(rawBody: string, signatureHeader: string | undefined) {
  if (!signatureHeader) {
    throw new MyntloAuthError({ message: 'Missing signature header.', statusCode: 401 });
  }

  // toleranceSeconds (5 minutes here) also rejects a validly-signed payload
  // that's too old or too far in the future - protects against a replayed
  // request if this payload is ever logged, proxied, or otherwise leaked.
  const event = await verifyMyntloWebhook<WebhookEvent>({
    payload: rawBody,
    signature: signatureHeader,
    secret: process.env.MYNTLO_WEBHOOK_SECRET ?? '',
    toleranceSeconds: 300,
  });

  switch (event.type) {
    case 'meeting.completed':
      console.log('Meeting finished processing:', event.data);
      break;
    case 'meeting.failed':
      console.error('Meeting processing failed:', event.data);
      break;
    case 'action_item.updated':
      console.log('Action item updated:', event.data);
      break;
    default:
      console.log('Unhandled event type:', event.type);
  }
}

// Simulates an incoming request for demonstration purposes.
async function run() {
  const rawBody = process.argv[2];
  const signature = process.argv[3];

  if (!rawBody || !signature) {
    console.error('Usage: tsx examples/verify-webhook.ts <raw-body-json> <signature>');
    process.exit(1);
  }

  await handleWebhookRequest(rawBody, signature);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

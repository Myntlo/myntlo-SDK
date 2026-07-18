// Server-side only. Uses your full API key - never run this in a browser.
import { createReadStream } from 'node:fs';
import { MyntloClient } from '../src';

const myntlo = new MyntloClient({ apiKey: process.env.MYNTLO_API_KEY! });

async function run() {
  const meeting = await myntlo.meetings.upload({
    file: createReadStream('./meeting.mp3'),
    title: 'Weekly Sync',
    participantEmails: ['team@myntlo.co'],
  });

  console.log('Uploaded meeting:', meeting.id);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

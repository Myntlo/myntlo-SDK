import { MyntloClient } from '../src';

const myntlo = new MyntloClient({ apiKey: process.env.MYNTLO_API_KEY ?? '' });

async function run() {
  const decisions = await myntlo.decisions.list({ page: 1, perPage: 20 });
  console.log(decisions.data);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

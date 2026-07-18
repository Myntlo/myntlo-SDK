import { MyntloClient } from '../src';

const myntlo = new MyntloClient({ apiKey: process.env.MYNTLO_API_KEY! });

async function run() {
  const actionItems = await myntlo.actionItems.list({ page: 1, perPage: 20 });
  console.log(actionItems.data);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

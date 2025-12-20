import { buildServer } from '../src/server';
import { waitForDatabase } from '../src/db/wait';
import { seedLab } from './seed-lab';
import { runFederationSimulation } from './simulate-federation';
import { pool } from '../src/db/pool';

async function runFederationDemo() {
  await waitForDatabase();
  await seedLab();

  const nodeA = await buildServer({ logger: false });
  const nodeB = await buildServer({ logger: false });
  const nodeAUrl = await nodeA.listen({ port: 0, host: '127.0.0.1' });
  const nodeBUrl = await nodeB.listen({ port: 0, host: '127.0.0.1' });

  try {
    await runFederationSimulation(nodeAUrl, nodeBUrl);
  } finally {
    await nodeA.close();
    await nodeB.close();
    await pool.end();
  }
}

if (import.meta.main) {
  runFederationDemo()
    .then(() => {
      console.log('\nFederation demo completed.');
    })
    .catch((error) => {
      console.error('Federation demo failed', error);
      process.exit(1);
    });
}

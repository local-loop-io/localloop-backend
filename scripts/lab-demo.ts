import { buildServer } from '../src/server';
import { waitForDatabase } from '../src/db/wait';
import { seedLab } from './seed-lab';
import { runLabSimulation } from './simulate-lab';
import { pool } from '../src/db/pool';

async function runLabDemo() {
  await waitForDatabase();
  await seedLab();

  const app = await buildServer({ logger: false });
  const address = await app.listen({ port: 0, host: '127.0.0.1' });

  try {
    await runLabSimulation(address);
  } finally {
    await app.close();
    await pool.end();
  }
}

if (import.meta.main) {
  runLabDemo()
    .then(() => {
      console.log('\nLab demo completed.');
    })
    .catch((error) => {
      console.error('Lab demo failed', error);
      process.exit(1);
    });
}

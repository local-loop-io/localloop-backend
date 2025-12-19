import { Database } from 'bun:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { waitForDatabase } from '../src/db/wait';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = process.argv[2] || path.join(__dirname, '..', 'data', 'interest.sqlite');

const insertQuery = `
  INSERT INTO interests (
    id,
    name,
    organization,
    role,
    country,
    city,
    website,
    email,
    message,
    share_email,
    public_listing,
    consent_public,
    created_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  ON CONFLICT (id) DO NOTHING;
`;

const importSqlite = async () => {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const rows = sqlite.query(
    `SELECT id, name, organization, role, country, city, website, email, message, share_email, public_listing, created_at
     FROM interests`
  ).all();

  if (rows.length === 0) {
    console.log('No rows found to import.');
    return;
  }

  await waitForDatabase();
  await runMigrations();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(insertQuery, [
        row.id,
        row.name,
        row.organization,
        row.role,
        row.country,
        row.city,
        row.website,
        row.email,
        row.message,
        Boolean(row.share_email),
        row.public_listing === null ? true : Boolean(row.public_listing),
        true,
        row.created_at,
      ]);
    }
    await client.query('COMMIT');
    console.log(`Imported ${rows.length} row(s) from SQLite.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed', error);
    throw error;
  } finally {
    client.release();
  }
};

importSqlite()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

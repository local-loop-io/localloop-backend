import { pool } from './pool';

export type FederationNodeRow = {
  node_id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  last_seen: string;
  created_at: string;
};

export async function upsertFederationNode(input: {
  node_id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
}): Promise<FederationNodeRow> {
  const { rows } = await pool.query(
    `INSERT INTO federation_nodes (node_id, name, endpoint, capabilities, last_seen)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (node_id) DO UPDATE SET
       name = EXCLUDED.name,
       endpoint = EXCLUDED.endpoint,
       capabilities = EXCLUDED.capabilities,
       last_seen = NOW()
     RETURNING node_id, name, endpoint, capabilities, last_seen, created_at`,
    [input.node_id, input.name, input.endpoint, input.capabilities],
  );
  return rows[0] as FederationNodeRow;
}

export async function listFederationNodes(): Promise<FederationNodeRow[]> {
  const { rows } = await pool.query(
    `SELECT node_id, name, endpoint, capabilities, last_seen, created_at
     FROM federation_nodes
     ORDER BY last_seen DESC`,
  );
  return rows as FederationNodeRow[];
}

import { config } from '../config';
import { upsertFederationNode, listFederationNodes } from '../db/federationNodes';

export type NodeRecord = {
  node_id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  last_seen: string;
  lab_only: true;
};

export function getLocalNode(): NodeRecord {
  return {
    node_id: config.node.id,
    name: config.node.name,
    endpoint: config.publicBaseUrl,
    capabilities: config.node.capabilities,
    last_seen: new Date().toISOString(),
    lab_only: true,
  };
}

export async function upsertNode(input: Omit<NodeRecord, 'last_seen' | 'lab_only'>): Promise<NodeRecord> {
  const row = await upsertFederationNode({
    node_id: input.node_id,
    name: input.name,
    endpoint: input.endpoint,
    capabilities: input.capabilities,
  });
  return {
    node_id: row.node_id,
    name: row.name,
    endpoint: row.endpoint,
    capabilities: row.capabilities,
    last_seen: typeof row.last_seen === 'string' ? row.last_seen : new Date(row.last_seen).toISOString(),
    lab_only: true,
  };
}

export async function listNodes(): Promise<NodeRecord[]> {
  const local = getLocalNode();
  const dbNodes = await listFederationNodes();

  const results: NodeRecord[] = [local];
  for (const row of dbNodes) {
    if (row.node_id !== local.node_id) {
      results.push({
        node_id: row.node_id,
        name: row.name,
        endpoint: row.endpoint,
        capabilities: row.capabilities,
        last_seen: typeof row.last_seen === 'string' ? row.last_seen : new Date(row.last_seen).toISOString(),
        lab_only: true,
      });
    }
  }
  return results;
}

import { config } from '../config';

export type NodeRecord = {
  node_id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  last_seen: string;
  lab_only: true;
};

const nodes = new Map<string, NodeRecord>();

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

export function upsertNode(input: Omit<NodeRecord, 'last_seen' | 'lab_only'>): NodeRecord {
  const record: NodeRecord = {
    ...input,
    last_seen: new Date().toISOString(),
    lab_only: true,
  };
  nodes.set(input.node_id, record);
  return record;
}

export function listNodes(): NodeRecord[] {
  const local = getLocalNode();
  const results = [local];
  for (const node of nodes.values()) {
    if (node.node_id !== local.node_id) {
      results.push(node);
    }
  }
  return results;
}

export type NodeToken = {
  createdAt: number;
  expiryTimestamp?: number;
  friendlyNodeName?: string;
  nodeId: string;
  nodeUri: string | string[];
  token: string;
};

export type NodeTokens = Record<string, NodeToken[]>;

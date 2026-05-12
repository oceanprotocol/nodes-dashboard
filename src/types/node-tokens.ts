export type NodeToken = {
  createdAt: number;
  expiryTimestamp?: number;
  nodeId: string;
  token: string;
};

export type NodeTokens = Record<string, NodeToken[]>;

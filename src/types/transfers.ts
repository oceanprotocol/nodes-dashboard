export type TransferEvent = {
  tokenSymbol: string;
  tokenAddress: string;
  from: string;
  to: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
};

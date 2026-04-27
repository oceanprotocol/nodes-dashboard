export type BucketAccessStateType = 'new' | 'existing';

export type BucketAccessState =
  | {
      mode: 'new';
      wallets: string[];
    }
  | {
      mode: 'existing';
      address: string;
    };

export type ChainAddressPair = {
  chainId: string;
  address: string;
};

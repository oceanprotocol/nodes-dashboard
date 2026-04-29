export type BucketAccessStateType = 'new' | 'existing' | 'none';

export type BucketAccessState =
  | {
      mode: 'new';
      wallets: string[];
    }
  | {
      mode: 'existing';
      address: string;
    }
  | {
      mode: 'none';
    };

export type ChainAddressPair = {
  chainId: string;
  address: string;
};

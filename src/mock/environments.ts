export const MOCK_ENV = {
  id: 'env-1',
  freeComputeEnvId: 'free-env-1',
  maxJobDuration: 7000,
  minPricePerMinute: {
    OCEAN: 350,
    USDC: 125,
  } as Record<string, number>,
  cpu: {
    max: 32,
    name: 'Intel Xeon E5-2673 v4',
    unitPrice: {
      OCEAN: 3,
      USDC: 1.51,
    } as Record<string, number>,
    used: 12,
  },
  disk: {
    max: 32,
    unitPrice: {
      OCEAN: 6,
      USDC: 2.51,
    } as Record<string, number>,
    used: 8,
  },
  gpu: [
    {
      max: 32,
      name: 'nVIDIA RTX 5090',
      unitPrice: {
        OCEAN: 100,
        USDC: 50,
      } as Record<string, number>,
      used: 30,
    },
    {
      max: 32,
      name: 'nVIDIA RTX 4090',
      unitPrice: {
        OCEAN: 3,
        USDC: 1.51,
      } as Record<string, number>,
      used: 3,
    },
    {
      max: 32,
      name: 'nVIDIA RTX 5080',
      unitPrice: {
        OCEAN: 6,
        USDC: 2.51,
      } as Record<string, number>,
      used: 2,
    },
    // {
    //   max: 32,
    //   name: 'nVIDIA RTX 4080',
    //   unitPrice: {
    //     OCEAN: 30,
    //     USDC: 10.51,
    //   } as Record<string, number>,
    //   used: 8,
    // },
  ],
  ram: {
    max: 32,
    unitPrice: {
      OCEAN: 30,
      USDC: 10.51,
    } as Record<string, number>,
    used: 20,
  },
  supportedTokens: ['OCEAN', 'USDC'],
};

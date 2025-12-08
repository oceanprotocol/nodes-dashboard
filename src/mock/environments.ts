import { CHAIN_ID } from '@/constants/chains';
import { ComputeEnvironment } from '@/types/environments';

export const MOCK_ENVS: ComputeEnvironment[] = [
  {
    id: '0x2570967f47edf15293a2ab50944d7c790490d742c83a8ba7306c6db5e02d69d3-0x3f05b9957b7b17d96657293504e294612f7fc0f7ced22d9397a82557aac8bee7',
    runningJobs: 0,
    consumerAddress: '0xF64552152CD0190b8e3a45f7054EE2687d705460',
    platform: {
      architecture: 'x86_64',
      os: 'linux',
    },
    access: {
      addresses: [],
      accessLists: [],
    },
    fees: {
      [CHAIN_ID]: [
        {
          feeToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          prices: [
            {
              id: 'cpu',
              price: 0.0005,
            },
            {
              id: 'ram',
              price: 0.0002,
            },
            {
              id: 'myGPU',
              price: 0.001,
            },
            {
              id: 'disk',
              price: 0.0001,
            },
          ],
        },
        {
          feeToken: '0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985',
          prices: [
            {
              id: 'cpu',
              price: 0.0005,
            },
            {
              id: 'ram',
              price: 0.0002,
            },
            {
              id: 'myGPU',
              price: 0.001,
            },
            {
              id: 'disk',
              price: 0.0001,
            },
          ],
        },
      ],
    },
    queuedJobs: 0,
    queuedFreeJobs: 0,
    queMaxWaitTime: 0,
    queMaxWaitTimeFree: 0,
    storageExpiry: 604800,
    maxJobDuration: 7200,
    resources: [
      {
        id: 'cpu',
        type: 'cpu',
        total: 8,
        max: 8,
        min: 1,
        description: 'Intel(R) Xeon(R) Gold 6342 CPU @ 2.80GHz',
        inUse: 0,
      },
      {
        id: 'ram',
        type: 'ram',
        total: 23,
        max: 23,
        min: 1,
        inUse: 0,
      },
      {
        id: 'myGPU',
        description: 'NVIDIA RTX A5000',
        type: 'gpu',
        total: 1,
        // init: {
        //   deviceRequests: {
        //     Driver: 'nvidia',
        //     DeviceIDs: ['GPU-fab12b3b-6dd7-0aaf-8616-c07aeaf6e41b'],
        //     Capabilities: [['gpu']],
        //   },
        // },
        max: 1,
        min: 0,
        inUse: 0,
      },
      {
        id: 'disk',
        total: 20,
        max: 20,
        min: 0,
        inUse: 0,
      },
    ],
    free: {
      access: {
        addresses: [],
        accessLists: [],
      },
      maxJobDuration: 7200,
      maxJobs: 3,
      resources: [
        {
          id: 'cpu',
          max: 4,
          inUse: 0,
        },
        {
          id: 'ram',
          max: 20,
          inUse: 0,
        },
        {
          id: 'disk',
          max: 20,
          inUse: 0,
        },
        {
          id: 'myGPU',
          max: 1,
          inUse: 0,
        },
      ],
    },
    runningFreeJobs: 0,
  },
  {
    id: '0x6d2a9d0e1c53bf993577809f4738cd3c0f6f07e653b769d852f88ed812903505-0xd614be95cc285db1b02814cdafb74a5d240d7d9ba1903100fdd7a9265d27f5f8',
    runningJobs: 0,
    consumerAddress: '0xdA82f7b1a5ecF91f75dc0d573b87FEd9881dfBBE',
    platform: {
      architecture: 'x86_64',
      os: 'linux',
    },
    access: {
      addresses: [],
      accessLists: [],
    },
    fees: {
      [CHAIN_ID]: [
        {
          feeToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          prices: [
            {
              id: 'cpu',
              price: 0.05,
            },
            {
              id: 'ram',
              price: 0.02,
            },
            {
              id: 'GPU1',
              price: 1.5,
            },
            {
              id: 'GPU2',
              price: 1.5,
            },
            {
              id: 'disk',
              price: 0.01,
            },
          ],
        },
        {
          feeToken: '0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985',
          prices: [
            {
              id: 'cpu',
              price: 0.05,
            },
            {
              id: 'ram',
              price: 0.02,
            },
            {
              id: 'GPU1',
              price: 1.5,
            },
            {
              id: 'GPU2',
              price: 1.5,
            },
            {
              id: 'disk',
              price: 0.01,
            },
          ],
        },
      ],
    },
    queuedJobs: 0,
    queuedFreeJobs: 0,
    queMaxWaitTime: 0,
    queMaxWaitTimeFree: 0,
    storageExpiry: 604800,
    maxJobDuration: 7200,
    resources: [
      {
        id: 'cpu',
        type: 'cpu',
        total: 6,
        max: 6,
        min: 1,
        description: 'Intel Core Processor (Broadwell, no TSX, IBRS)',
        inUse: 0,
      },
      {
        id: 'ram',
        type: 'ram',
        total: 15,
        max: 15,
        min: 1,
        inUse: 0,
      },
      {
        id: 'GPU1',
        description: 'NVIDIA V100-1',
        type: 'gpu',
        total: 1,
        // init: {
        //   deviceRequests: {
        //     Driver: 'nvidia',
        //     DeviceIDs: ['GPU-a5e31522-2217-8c10-bcd3-8915ea371f89'],
        //     Capabilities: [['gpu']],
        //   },
        // },
        max: 1,
        min: 0,
        inUse: 0,
      },
      {
        id: 'GPU2',
        description: 'NVIDIA V100-2',
        type: 'gpu',
        total: 1,
        // init: {
        //   deviceRequests: {
        //     Driver: 'nvidia',
        //     DeviceIDs: ['GPU-c46eeff5-903b-8280-2f16-4fc3f6140d47'],
        //     Capabilities: [['gpu']],
        //   },
        // },
        max: 1,
        min: 0,
        inUse: 0,
      },
      {
        id: 'disk',
        total: 20,
        max: 20,
        min: 0,
        inUse: 0,
      },
    ],
    free: {
      access: {
        addresses: [],
        accessLists: [],
      },
      maxJobDuration: 7200,
      maxJobs: 3,
      resources: [
        {
          id: 'cpu',
          max: 4,
          inUse: 0,
        },
        {
          id: 'ram',
          max: 20,
          inUse: 0,
        },
        {
          id: 'disk',
          max: 20,
          inUse: 0,
        },
        {
          id: 'GPU1',
          max: 1,
          inUse: 0,
        },
        {
          id: 'GPU2',
          max: 1,
          inUse: 0,
        },
      ],
    },
    runningFreeJobs: 0,
  },
];

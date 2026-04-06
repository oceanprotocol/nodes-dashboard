/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors',
    '@walletconnect/ethereum-provider',
    '@walletconnect/universal-provider',
    'pino',
    'pino-pretty',
    'thread-stream',
  ],
  turbopack: {
    resolveAlias: {
      fs: { browser: './src/empty.js' },
      net: { browser: './src/empty.js' },
      tls: { browser: './src/empty.js' },
      dgram: { browser: './src/empty.js' },
      dns: { browser: './src/empty.js' },
      'rdf-canonize-native': { browser: './src/empty.js' },
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dgram: false,
        dns: false,
      };
    }
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      'rdf-canonize-native': false,
    };

    return config;
  },
  transpilePackages: [
    '@mui/x-data-grid',
    '@mui/x-data-grid-pro',
    '@mui/x-data-grid-premium',
    '@account-kit/react',
    '@account-kit/infra',
    '@account-kit/signer',
    '@account-kit/core',
    '@aa-sdk/core',
    '@solana/wallet-adapter-wallets',
    '@solana/wallet-adapter-ledger',
    '@ledgerhq/errors',
  ],
};

export default nextConfig;

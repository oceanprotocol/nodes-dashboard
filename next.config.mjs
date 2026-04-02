import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['wagmi', '@wagmi/core', '@wagmi/connectors', '@walletconnect/ethereum-provider', '@walletconnect/universal-provider', 'pino', 'pino-pretty', 'thread-stream'],
  turbopack: {
    resolveAlias: {},
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack(config, { isServer }) {
    config.resolve.symlinks = false;
    config.resolve.alias = {
      ...config.resolve.alias,
      '@oceanprotocol/lib': path.resolve(__dirname, 'node_modules/@oceanprotocol/lib/dist/lib.module.mjs'),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dgram: false,
        dns: false
      }
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

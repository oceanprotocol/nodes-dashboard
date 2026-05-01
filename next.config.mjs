import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors',
    '@walletconnect/ethereum-provider',
    '@walletconnect/universal-provider',
  ],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    // Force all @solana/codecs-core imports to resolve to the root-level v5.5.1,
    // which is a superset of v2.3.0 exports. Without this, webpack deduplicates
    // the module to the v2.3.0 copy (nested in @solana/kit), causing build errors
    // when @privy-io/react-auth's transitive Solana deps import `toArrayBuffer`.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana/codecs-core': path.resolve(__dirname, 'node_modules/@solana/codecs-core'),
      // @privy-io/react-auth optionally imports @farcaster/mini-app-solana but we
      // don't use Farcaster; stub it out so webpack doesn't fail on a missing module.
      '@farcaster/mini-app-solana': false,
    };
    // viem's nested ox package uses dynamic require(variable) in its tempo module,
    // which webpack flags as a critical error. Suppress it — it doesn't affect runtime.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
    ];
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

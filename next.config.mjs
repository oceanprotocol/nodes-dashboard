/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors',
    '@walletconnect/ethereum-provider',
    '@walletconnect/universal-provider',
  ],
  // These packages expose a `module-sync` exports condition pointing at a
  // `require.mjs` that Next's file tracer doesn't follow, so on Vercel (which
  // ships only traced files) Node 24 resolves to a file that was never
  // uploaded. Force the whole package dir into the function bundle.
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/async-function/**/*', './node_modules/generator-function/**/*'],
  },
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

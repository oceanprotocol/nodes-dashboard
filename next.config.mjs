/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors',
    '@walletconnect/ethereum-provider',
    '@walletconnect/universal-provider',
  ],
  // Upstream bug: Next 16 vendors @vercel/nft 0.27.1, which predates support
  // for the `module-sync` exports condition (added in nft 0.30.0). These
  // get-intrinsic helpers point `module-sync` at a separate `require.mjs`;
  // nft traces only `index.js`, but Node >= 22.10 (we run 24) resolves the
  // CJS require to `require.mjs` at runtime. Vercel ships only traced files,
  // so the un-traced `require.mjs` is missing -> MODULE_NOT_FOUND.
  // Remove this once a Next release bundles nft >= 0.30.0.
  // See https://github.com/vercel/next.js/issues/90567
  outputFileTracingIncludes: {
    '/**/*': [
      './node_modules/async-function/**/*',
      './node_modules/async-generator-function/**/*',
      './node_modules/generator-function/**/*',
      './public/disposable-email-blacklist.conf',
    ],
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

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // @walletconnect/universal-provider is not hoisted to root but is bundled inside
      // @walletconnect/ethereum-provider/node_modules — point webpack there directly.
      '@walletconnect/universal-provider': path.resolve(
        __dirname,
        'node_modules/@walletconnect/ethereum-provider/node_modules/@walletconnect/universal-provider'
      ),
      // Privy's Fiat Onramp uses @stripe/crypto dynamically but we don't use onramp.
      '@stripe/crypto': false,
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
    // CJS module; named imports from it fail Node.js ESM static analysis unless
    // webpack bundles it (handling CJS interop) rather than leaving it for Node.js.
    '@ledgerhq/hw-transport',
    // Bundled by webpack so the @reown/appkit-scaffold-ui nested controllers@1.7.2
    // (vs root 1.7.8) doesn't cause webpack version-mismatch errors. The nested
    // @account-kit/react@4.88.4 here does NOT import @ledgerhq.
    '@privy-io/alchemy-migration',
  ],
};

export default nextConfig;

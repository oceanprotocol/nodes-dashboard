/** @type {import('next').NextConfig} */
const nextConfig = {
  //transpilePackages: ['@oceanprotocol/lib'],
  //experimental: { esmExternals: true },
  webpack(config) {
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
    //'@oceanprotocol/lib',
    //'@oceanprotocol/ddo-js',
  ],
};

export default nextConfig;

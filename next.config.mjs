/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@libp2p/websockets', '@chainsafe/libp2p-noise', '@chainsafe/libp2p-yamux', 'it-pipe', 'uint8arrays', '@libp2p/bootstrap', '@libp2p/identify', '@libp2p/kad-dht', 'libp2p'],
    webpack: (config, { isServer }) => {
        if (isServer) {
            // Don't bundle libp2p on server side to avoid serialization issues
            config.externals = config.externals || [];
            if (Array.isArray(config.externals)) {
                config.externals.push('libp2p');
            }
        } else {
            // Browser-specific webpack config for libp2p
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
            };
            
            // Disable optimizations that cause issues with libp2p
            config.optimization = {
                ...config.optimization,
                concatenateModules: false,
                sideEffects: false,
            };
            
            // Add rule to handle libp2p packages
            config.module = config.module || {};
            config.module.rules = config.module.rules || [];
            config.module.rules.push({
                test: /node_modules[\/\\](@libp2p|libp2p|@chainsafe)/,
                sideEffects: false,
            });
        }
        return config;
    }
};

export default nextConfig;

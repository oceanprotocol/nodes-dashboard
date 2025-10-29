/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@libp2p/websockets', '@chainsafe/libp2p-noise', '@chainsafe/libp2p-yamux', 'it-pipe', 'uint8arrays'],
    webpack: (config, { isServer }) => {
        if (isServer) {
            // Don't bundle libp2p on server side to avoid serialization issues
            config.externals = config.externals || [];
            if (Array.isArray(config.externals)) {
                config.externals.push('libp2p');
            }
        }
        return config;
    }
};

export default nextConfig;

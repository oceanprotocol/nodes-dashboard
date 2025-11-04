/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
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
    return config
  },

  // 👇 Add this
  async rewrites() {
    return [
      {
        source: '/libp2p/:path*',
        destination: 'http://127.0.0.1:49757/:path*'
      }
    ]
  }
}

export default nextConfig

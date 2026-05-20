import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Allow images from any HTTPS source (for bot avatars)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Required for cheerio SSR (landing reader)
  serverExternalPackages: ['cheerio'],
  async headers() {
    return [
      {
        // Allow /embed to be iframed from any origin
        source: '/embed',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
      {
        // Always revalidate widget.js so consumers get updates without cache busting in their script tag
        source: '/widget.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow images from any HTTPS source (for bot avatars)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Required for cheerio SSR (landing reader)
  serverExternalPackages: ['cheerio'],
}

export default nextConfig

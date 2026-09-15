import { NextConfig } from 'next';

const config: NextConfig = {
  // Self-contained server bundle — the Windows app ships it instead of node_modules.
  output: 'standalone',
  // `sharp` is only needed for image optimization, which is off below. Without
  // this it adds ~45 MB of platform binaries to the installer.
  outputFileTracingExcludes: {
    '*': ['node_modules/.pnpm/sharp@*/**', 'node_modules/.pnpm/@img+*/**'],
  },
  images: {
    // No sharp in the packaged app; champion icons come straight from the CDN.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.communitydragon.org',
        pathname: '/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/**',
      },
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
        pathname: '/cdn/**',
      },
    ],
  },
};

export default config;

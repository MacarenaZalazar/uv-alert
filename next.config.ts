import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    { key: 'Service-Worker-Allowed', value: '/' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
            {
                source: '/manifest.webmanifest',
                headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
            },
        ];
    },
};

export default nextConfig;

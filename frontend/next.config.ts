import type { NextConfig } from 'next';
import { loadFrontendEnvironment } from './scripts/load-env.mjs';
loadFrontendEnvironment();
const value = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001/api');
let url: URL;
try { url = new URL(value); } catch { throw Error('NEXT_PUBLIC_API_URL is required and must be an HTTP(S) backend origin or origin/api.'); }
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/', '/api', '/api/'].includes(url.pathname)) throw Error('Invalid NEXT_PUBLIC_API_URL.');
const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async headers() { return [{ source: '/activate', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]; }
};
export default config;

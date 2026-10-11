import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'export',
  turbopack: { root: process.cwd() },
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  poweredByHeader: false,
};
export default config;

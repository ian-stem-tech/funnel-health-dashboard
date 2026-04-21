import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const repoName = process.env.NEXT_PUBLIC_BASE_PATH || '';
const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: repoName,
  assetPrefix: repoName ? `${repoName}/` : undefined,
  trailingSlash: true,
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

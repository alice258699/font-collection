/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/font-collection',
  assetPrefix: '/font-collection/',
  images: {
    unoptimized: true
  }
};

export default nextConfig;

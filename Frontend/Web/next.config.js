/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React strict mode if causing double-render issues during development
  reactStrictMode: true,

  // Transpile specific packages if needed
  transpilePackages: ['@apollo/client'],
};

export default nextConfig;

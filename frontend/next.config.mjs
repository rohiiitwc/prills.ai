/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/telegram',
        destination: '/',
        permanent: true,
      },
      {
        source: '/telegram/:path*',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;


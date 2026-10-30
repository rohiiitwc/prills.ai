/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/telegram',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

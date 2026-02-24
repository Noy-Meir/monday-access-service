/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /graphql to the backend — avoids CORS in development
        source: '/graphql',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/graphql`,
      },
    ];
  },
};

export default nextConfig;

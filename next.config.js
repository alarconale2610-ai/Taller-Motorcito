/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: false,
  },
  // Headers necesarios para Web USB en producción
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'usb=(self)', // Permitir acceso USB
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Se você for usar imagens de domínios externos (ex: Supabase storage)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

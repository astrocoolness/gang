/** @type {import('next').NextConfig} */
const nextConfig = {
  // Served at rva.guru/clique via a multi-zone rewrite from rva-guru-full-stack-platform.
  basePath: '/clique',
  async redirects() {
    return [
      // Legacy "Mess Space" routes -> Mehspace.
      { source: '/mess-space', destination: '/mehspace', permanent: true },
      { source: '/mess-space/:id', destination: '/mehspace/:id', permanent: true },
    ];
  },
};
export default nextConfig;

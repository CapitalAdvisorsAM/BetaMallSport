/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/rent-roll/arrendatarios/:path*",
        destination: "/rent-roll/tenants/:path*",
        permanent: false
      },
      {
        source: "/rent-roll/contratos/:path*",
        destination: "/rent-roll/contracts/:path*",
        permanent: false
      },
      {
        source: "/rent-roll/locales/:path*",
        destination: "/rent-roll/units/:path*",
        permanent: false
      },
      {
        source: "/rent-roll/proyectos/:path*",
        destination: "/rent-roll/projects/:path*",
        permanent: false
      },
      {
        source: "/finanzas/:path*",
        destination: "/finance/:path*",
        permanent: false
      }
    ];
  }
};

export default nextConfig;

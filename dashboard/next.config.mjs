/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  serverExternalPackages: ["better-sqlite3", "pg"],
};

export default nextConfig;

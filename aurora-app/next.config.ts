import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
});

module.exports = withPWA({
    // other Next.js config options if needed
});

const nextConfig: NextConfig = {
    experimental: {
        turbo: {
            // ...
        },
    },
}
export default nextConfig;

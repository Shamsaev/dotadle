import type { NextConfig } from "next";

const config: NextConfig = {
  // Discord Activity открывает сайт в iframe — разрешаем встраивание
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://discord.com https://*.discord.com https://*.discordsays.com" }] }];
  },
};
export default config;

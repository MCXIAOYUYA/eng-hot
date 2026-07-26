import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 由 PAGES_BASE 环境变量决定,默认 "/":
//   - Cloudflare Pages / 自定义域名 / 本地开发 → 站点在域名根,base = "/"(不设 PAGES_BASE)
//   - GitHub Pages 项目页(username.github.io/eng-hot/)→ deploy.yml 里设 PAGES_BASE=/eng-hot/
// 主站迁到 Cloudflare(大陆可达),GitHub Pages 作为镜像仍能正确构建,两不耽误。
export default defineConfig(() => ({
  plugins: [react()],
  base: process.env.PAGES_BASE || "/",
  server: { port: 5174 },
}));

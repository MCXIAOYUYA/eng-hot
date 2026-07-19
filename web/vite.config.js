import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 部署到 GitHub Pages 项目页(username.github.io/eng-hot/)需要 base = "/eng-hot/";
// 本地开发仍用根路径 "/",两不耽误。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/eng-hot/" : "/",
  server: { port: 5174 },
}));

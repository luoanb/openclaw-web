import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  /** 为将来使用 History API 的路由或静态托管兜底做准备：未知路径回退到 index.html */
  appType: "spa",
  plugins: [tailwindcss(), svelte()], resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
});

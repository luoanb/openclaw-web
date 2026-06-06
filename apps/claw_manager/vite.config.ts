import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { $lib: path.resolve(__dirname, "src/lib") } },
  plugins: [tailwindcss(), svelte()],
  server: {
    allowedHosts: true,
    https: {
      key: "/home/lab/192.168.1.2-key.pem",
      cert: "/home/lab/192.168.1.2.pem",
    },
    proxy: {
      "/proxy/openclaw": {
        target: "https://192.168.1.2:5173",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/openclaw/, ""),
      },
      "/proxy/admin": {
        target: "https://192.168.1.2:18789",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/admin/, ""),
      },
      "/proxy/code": {
        target: "http://192.168.1.2:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/code/, ""),
      },
    },
  },
});

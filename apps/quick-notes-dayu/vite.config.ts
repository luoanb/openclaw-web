import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  clearScreen: false,
  resolve: { alias: { $lib: path.resolve(__dirname, "src/lib") } },
  plugins: [tailwindcss(), svelte()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});

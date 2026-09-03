import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  optimizeDeps: {
    exclude: ["@wllama/wllama"],
  },
  worker: {
    format: "es",
  },
  assetsInclude: ["**/*.wasm"],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        overlay: path.resolve(root, "index.html"),
        onboarding: path.resolve(root, "onboarding.html"),
        chat: path.resolve(root, "chat.html"),
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(() => ({
  plugins: [
    nodePolyfills({
      include: ["stream", "crypto", "process"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    react(),
  ],
  build: {
    assetsDir: "_assets",
  },
  server: {
    host: "0.0.0.0",
    port: 3333,
    proxy: {
      "/_api": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
}));
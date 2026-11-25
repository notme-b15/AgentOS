import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../../", // read the single .env at the repo root
  server: {
    port: 5173,
    // Same-origin calls in dev, so no CORS headaches
    proxy: {
      "/api":   { target: "http://localhost:4000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
      "/store": { target: "http://localhost:4100", changeOrigin: true, rewrite: (p) => p.replace(/^\/store/, "") },
    },
  },
});

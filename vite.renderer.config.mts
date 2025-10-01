import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Inject environment variables for renderer process
    'process.env.DYAD_DISTRIBUTION_BUILD': JSON.stringify(process.env.DYAD_DISTRIBUTION_BUILD),
    'process.env.DYAD_DISTRIBUTION_PROXY_URL': JSON.stringify(process.env.DYAD_DISTRIBUTION_PROXY_URL),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    // Polyfill for packages that expect Node.js globals
    'global': 'globalThis',
  },
});

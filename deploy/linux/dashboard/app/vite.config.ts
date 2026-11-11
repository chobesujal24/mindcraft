import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The dashboard is served by deploy/linux/dashboard/server.js from public/.
// Keep the bundle as a single offline-capable HTML file.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: "./",
  build: {
    outDir: "../public",
    emptyOutDir: false,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: "es2020",
    reportCompressedSize: true,
  },
});

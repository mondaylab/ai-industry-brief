import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: ".site-build",
    emptyOutDir: true,
    assetsDir: "assets/app",
    rollupOptions: {
      input: path.resolve(process.cwd(), "app.html"),
    },
  },
});

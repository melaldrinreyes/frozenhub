import { defineConfig } from "vite";
import path from "path";

// Dedicated serverless bundle used by api/index.ts on Vercel.
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "server/index.ts"),
      name: "serverless",
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist/serverless",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        "fs",
        "path",
        "url",
        "http",
        "https",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "querystring",
        "child_process",
        "express",
        "cors",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: false,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

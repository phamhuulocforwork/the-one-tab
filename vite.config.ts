import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import zip from "vite-plugin-zip-pack";
import manifest from "./manifest.config";
import { name, version } from "./package.json";

export default defineConfig({
  resolve: { alias: { "@": `${path.resolve(__dirname, "src")}`, $lib: path.resolve("./src/lib") } },
  base: "./", // Use relative paths for assets
  build: {
    rollupOptions: {
      input: {
        storage: path.resolve(__dirname, "src/storage/index.html"),
      },
    },
  },
  plugins: [
    tailwindcss(),
    svelte({ compilerOptions: { dev: true } }),
    crx({ manifest }),
    zip({ outDir: "release", outFileName: `crx-${name}-${version}.zip` }),
  ],
  server: { cors: { origin: [/chrome-extension:\/\//] } },
});

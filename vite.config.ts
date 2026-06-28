import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

const external = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export default defineConfig({
  build: {
    outDir: "dist-scripts",
    emptyOutDir: true,
    target: "node26",
    ssr: true,
    rollupOptions: {
      external: (id) => external.has(id),
      input: {
        "apply-ports-patch": resolve(rootDir, "scripts/apply-ports-patch.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

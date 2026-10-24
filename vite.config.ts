// @lovable.dev/vite-tanstack-config already includes the standard plugins — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // mongodb -> whatwg-url imports Node's "punycode"; the edge polyfill is missing, so use the npm package.
    resolve: { alias: { punycode: require.resolve("punycode/punycode.js") } },
  },
});

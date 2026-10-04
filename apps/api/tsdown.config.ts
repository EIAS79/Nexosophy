import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: [/^@nexosophy\//],
  },
});

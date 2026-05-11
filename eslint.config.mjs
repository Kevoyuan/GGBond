import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-require-imports": "warn",
      // Disable React Compiler rules enabled in eslint-config-next/react-hooks 7.1.1
      // as we only use React Compiler conditionally.
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "node_modules/**",
    "node_modules.bak/**",
    "out/**",
    "build/**",
    "dist/**",
    "**/dist/**",
    "coverage/**",
    "**/coverage/**",
    "cyberpunk-clock/**",
    "cyberpunk-clock-app/**",
    "demo-video/**",
    "gemini-home/**",
    "pixel-flip-clock/**",
    "pokemon-flip-clock/**",
    "src-tauri/resources/next-standalone/**",
    "src-tauri/resources/sidecar/**",
    "src-tauri/target/**",
    "src-sidecar/auto-routes.ts",
    "next-env.d.ts",
    "repro_*.js",
    "repro_*.ts",
    "tsconfig.tsbuildinfo",
    // CommonJS config files (require is expected)
    "next.config.js",
    "scripts/*.cjs",
  ]),
]);

export default eslintConfig;

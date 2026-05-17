// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/**", "dist/**", "*.js", "scripts/**", ".ref/**"]
  },
  // Scope the obsidianmd recommended config to TypeScript only; some of its
  // type-aware rules require a parserServices project and choke on .mjs files.
  ...obsidianmd.configs.recommended.map((config) => ({
    ...config,
    files: config.files ?? ["**/*.ts"]
  })),
  {
    files: ["**/*.ts"],
    // Enable reporting of unused disable directives (matches Obsidian bot behavior)
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { 
        project: "./tsconfig.json",
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        require: "readonly", // Node.js require function (available in Obsidian's environment)
        DomElementInfo: "readonly",
        SvgElementInfo: "readonly",
        activeDocument: "readonly",
        activeWindow: "readonly",
        ajax: "readonly",
        ajaxPromise: "readonly",
        createDiv: "readonly",
        createEl: "readonly",
        createFragment: "readonly",
        createSpan: "readonly",
        createSvg: "readonly",
        fish: "readonly",
        fishAll: "readonly",
        isBoolean: "readonly",
        nextFrame: "readonly",
        ready: "readonly",
        sleep: "readonly"
      }
    },
    // Custom rule overrides
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-misused-promises": ["error",{"checksVoidReturn":{"attributes":false,"properties":false,"returns":false,"variables":false}}],
      // Disable sample code rules for template repository
      // These are intentional placeholder names and sample code that users should customize
      "obsidianmd/sample-names": "off",
      "obsidianmd/no-sample-code": "off",
      // Console rules: Only allow warn, error, and debug (matching Obsidian bot requirements)
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      // Require await in async functions
      "@typescript-eslint/require-await": "error",
      // obsidianmd/ui/sentence-case can't be disabled via inline comments
      // (bot policy) and false-positives on legitimate text: service brand
      // names (Pexels, Pixabay), example URLs in setDesc, and literal
      // identifier placeholders (alt, hideBanner, the "200 or 200x100" size
      // hint). Tune the rule's own ignore options so real text isn't
      // mangled, while it stays active for genuine casing mistakes elsewhere.
      "obsidianmd/ui/sentence-case": ["error", {
        ignoreWords: ["Pexels", "Pixabay", "Descriptive"],
        ignoreRegex: ["https?://", "^alt$", "^hideBanner$", "^\\d"]
      }],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    }
  },
]);

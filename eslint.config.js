import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      quotes: [
        "error",
        "double",
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      // TypeSystem Architecture Invariant: Block internal imports from outside
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/type-system/internal/**"],
              message:
                "TypeSystem internals are private. Use public TypeSystem API from type-system/index.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
    rules: {
      // Chai uses property assertions like .to.be.true which look like unused expressions
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    // TypeSystem internal files can import from each other
    // Orchestrator can import internals during migration (to be removed in Phase 7)
    files: [
      "**/type-system/internal/**/*.ts",
      "**/type-system/index.ts",
      "**/type-system/type-system.ts",
      "**/type-system/types.ts",
      "**/ir/builder/orchestrator.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".tsonic/**",
      "out/**",
      "*.min.js",
      "packages/runtime/*.cs",
    ],
  },
];

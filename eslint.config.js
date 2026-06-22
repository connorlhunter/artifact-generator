import js from "@eslint/js";
import markdown from "@eslint/markdown";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**", "_work/**", "**/*.svg", "bun.lock"],
  },
  {
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/gfm",
    rules: {
      ...markdown.configs.recommended[0].rules,
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
        },
      ],
    },
  },
  {
    files: ["test/**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        expect: "readonly",
        test: "readonly",
      },
    },
  },
  eslintConfigPrettier,
];

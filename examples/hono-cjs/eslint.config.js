const defaultConfig = require('@repo/eslint-config').default;
const { defineConfig } = require('eslint/config');

const codeFiles = ['**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}'];

const config = defineConfig([
  ...defaultConfig,
  {
    files: codeFiles,
    rules: {
      '@typescript-eslint/no-require-imports': 0,
      'no-console': 0,
      'unicorn/prefer-module': 0
    }
  }
]);

module.exports = config;

// @ts-check
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import vitest from '@vitest/eslint-plugin';
import airbnbBestPractices from 'eslint-config-airbnb-base/rules/best-practices';
import airbnbErrors from 'eslint-config-airbnb-base/rules/errors';
import airbnbEs6 from 'eslint-config-airbnb-base/rules/es6';
import airbnbImports from 'eslint-config-airbnb-base/rules/imports';
import airbnbNode from 'eslint-config-airbnb-base/rules/node';
import airbnbStrict from 'eslint-config-airbnb-base/rules/strict';
import airbnbStyle from 'eslint-config-airbnb-base/rules/style';
import airbnbVariables from 'eslint-config-airbnb-base/rules/variables';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboConfig from 'eslint-config-turbo/flat';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import node from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import * as regexpPlugin from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import { configs as ymlConfigs } from 'eslint-plugin-yml';
import tseslint, { configs as tsConfigs } from 'typescript-eslint';
import banImportExtension from './src/banImportExtension.js';
import extraneous from './src/extraneous.js';
import ignorePatterns from './src/ignorePatterns.js';

const codeFiles = ['**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}'];
const airbnbNoParamReassign = airbnbBestPractices.rules['no-param-reassign'][1];
const airbnb = Object.assign(
  airbnbBestPractices.rules,
  airbnbErrors.rules,
  airbnbEs6.rules,
  airbnbImports.rules,
  airbnbNode.rules,
  airbnbStrict.rules,
  airbnbStyle.rules,
  airbnbVariables.rules
);

const compat = new FlatCompat();

export default tseslint.config(
  {
    ignores: ignorePatterns
  },
  { ...turboConfig[0], files: codeFiles },
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    }
  },
  { ...js.configs.recommended, files: codeFiles },
  { ...node.configs['flat/recommended'], files: codeFiles },
  { ...promise.configs['flat/recommended'], files: codeFiles },
  { ...security.configs.recommended, files: codeFiles },
  { ...importPlugin.flatConfigs.recommended, files: codeFiles },
  { rules: airbnb, files: codeFiles },
  { ...importPlugin.flatConfigs.typescript, files: codeFiles },
  { extends: [tsConfigs.stylisticTypeChecked], files: codeFiles },
  { extends: [tsConfigs.strictTypeChecked], files: codeFiles },
  { ...comments.recommended, files: codeFiles },
  {
    settings: {
      cache: false,
      node: { tryExtensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.json'] },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.mts', '.cts', '.tsx', '.d.ts']
      },
      'import/resolver': {
        'eslint-import-resolver-node': {
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        },
        'eslint-import-resolver-typescript': {
          alwaysTryTypes: true
        }
      }
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- dev in Node >22
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  { ...eslintPluginUnicorn.configs['flat/recommended'], files: codeFiles },
  process.env.CHECK_REDOS === 'true'
    ? compat.extends('plugin:eslint-plugin-redos/recommended')
    : [],
  { ...regexpPlugin.configs['flat/recommended'], files: codeFiles },
  {
    files: ['**/*.test.{js,jsx,cjs,mjs,ts,tsx,cts,mts}'], // or any other pattern
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
    settings: {
      vitest: {
        typecheck: true
      }
    },
    languageOptions: {
      globals: vitest.environments.env.globals
    }
  },
  {
    files: codeFiles,
    rules: {
      '@typescript-eslint/consistent-type-imports': 2,
      '@typescript-eslint/consistent-type-exports': 2,
      '@typescript-eslint/no-empty-function': 0,
      '@typescript-eslint/no-unused-vars': [
        2,
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-use-before-define': [
        2,
        {
          enums: true,
          typedefs: true,
          ignoreTypeReferences: false
        }
      ],
      '@typescript-eslint/restrict-template-expressions': [
        // Strict defaults except `allowNumber`
        2,
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
          allowNever: false
        }
      ],
      '@typescript-eslint/unbound-method': [2, { ignoreStatic: true }],
      '@eslint-community/eslint-comments/disable-enable-pair': 0,
      '@eslint-community/eslint-comments/require-description': 2,
      'simple-import-sort/imports': [
        2,
        {
          groups: [
            // Type imports last in each group
            [
              // Side effect imports.
              String.raw`^\u0000`,
              // Node.js builtins prefixed with `node:`.
              '^node:',
              String.raw`^node:.*\u0000$`,
              // Packages.
              // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
              String.raw`^@?\w`,
              String.raw`^@?\w.*\u0000$`,
              // Absolute imports and other imports such as Vue-style `@/foo`.
              // Anything not matched in another group.
              String.raw`(?<!\u0000)$`,
              String.raw`(?<=\u0000)$`,
              // Relative imports.
              // Anything that starts with a dot.
              String.raw`^\.`,
              String.raw`^\..*\u0000$`
            ]
          ]
        }
      ],
      'simple-import-sort/exports': 2,
      'import/extensions': 0,
      'import/no-duplicates': [2, { 'prefer-inline': true }],
      'import/no-extraneous-dependencies': ['error', extraneous],
      'import/order': 0,
      'import/prefer-default-export': 0,
      'lines-between-class-members': [2, 'always', { exceptAfterSingleLine: true }],
      'n/no-extraneous-import': 0, // covered by other rules
      'n/no-extraneous-require': 0, // covered by other rules
      'n/no-missing-import': 0, // covered by other rules
      'n/no-unpublished-import': [
        'error',
        {
          convertPath: [
            {
              include: ['src/**'],
              exclude: ['**/*.test.ts'],
              replace: ['^src/(.+)$', 'dist/$1']
            }
          ]
        }
      ],
      'regexp/no-contradiction-with-assertion': 2,
      'regexp/no-misleading-capturing-group': [
        2,
        {
          reportBacktrackingEnds: true
        }
      ],
      'security/detect-object-injection': 0, // far too many false positives
      'security/detect-unsafe-regex': 0, // terrible, using alternatives
      'unicorn/prevent-abbreviations': 0,
      'unicorn/filename-case': 0,
      'unicorn/no-array-callback-reference': 0,
      'unicorn/no-array-for-each': 0,
      'unicorn/no-array-reduce': 0,
      'unicorn/no-negated-condition': 0,
      'unicorn/no-useless-undefined': [2, { checkArguments: false }],
      // getByElementId is faster
      'unicorn/prefer-query-selector': 0,
      // structuredClone is very slow
      'unicorn/prefer-structured-clone': 0,
      'sort-imports': 0,
      'prefer-object-has-own': 2,
      'prefer-named-capture-group': 2,
      'no-console': [2, { allow: ['warn', 'error'] }],
      'no-empty-static-block': 2,
      'no-param-reassign': [
        2,
        {
          ...airbnbNoParamReassign,
          ignorePropertyModificationsFor: [
            // Add Mutative/Immer etc
            ...airbnbNoParamReassign.ignorePropertyModificationsFor,
            'draft'
          ]
        }
      ],
      'no-plusplus': 0,
      'no-restricted-syntax': [
        2,
        {
          selector: 'ForInStatement',
          message:
            'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.'
        },
        {
          selector: 'LabeledStatement',
          message:
            'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.'
        },
        {
          selector: 'WithStatement',
          message:
            '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.'
        },
        ...banImportExtension('ts'),
        ...banImportExtension('tsx')
      ],
      'array-callback-return': [2, { allowImplicit: true }],
      'consistent-return': 0,
      'dot-notation': 2,
      'no-constant-binary-expression': 2,
      'require-atomic-updates': 2,
      'no-inner-declarations': 0,
      'no-new-native-nonconstructor': 2,
      'no-void': 0,
      'prefer-destructuring': 0,
      'no-restricted-exports': [
        2,
        {
          restrictedNamedExports: [
            'then' // this will cause tons of confusion when your module is dynamically `import()`ed, and will break in most node ESM versions
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.{js,jsx,cjs,mjs}'],
    plugins: { jsdoc },
    extends: [
      jsdoc.configs['flat/stylistic-typescript-flavor-error'],
      jsdoc.configs['flat/recommended-typescript-flavor-error'],
      tsConfigs.disableTypeChecked
    ]
  },
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    extends: [
      jsdoc.configs['flat/stylistic-typescript-error'],
      jsdoc.configs['flat/recommended-typescript-error']
    ]
  },
  {
    // Enable the Markdown processor for all .md files.
    // TODO: Blocked by https://github.com/eslint/markdown/issues/297 to enable linting in code blocks
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    rules: {
      ...markdown.configs.recommended[0].rules
    }
  },
  {
    files: ['**/*.json'],
    language: 'json/json',
    ...json.configs.recommended
  },
  {
    extends: [ymlConfigs['flat/standard'], ymlConfigs['flat/prettier']],
    files: ['**/*.{yaml,yml}']
  },
  eslintConfigPrettier
);

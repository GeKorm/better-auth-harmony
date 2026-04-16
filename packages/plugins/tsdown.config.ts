import path from 'node:path';
import { defineConfig } from 'tsdown';

/**
 * Matches validator/es imports
 * Captures the import path and an optional semicolon.
 */
const validatorImport = /(?<quote>["'])(?<path>validator(?<es>\/es)\/.*?)["'](?<semi>;)?/g;

/**
 * Modifies ESM import statements in the file contents by ensuring that
 * all relative import paths have the correct .js extension appended.
 * @param contents - The contents of the file to modify.
 * @param outExtension - Extension to append, eg. `.js`
 * @returns The modified file contents with updated import paths.
 */
const modifyEsmImports = (contents: string, outExtension: string) =>
  contents.replaceAll(
    validatorImport,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types -- broken
    (_, quote: string, importPath: string, _es, semi: string = '') => {
      // If the import path ends with '.' or '/', it likely refers to a directory.
      if (importPath.endsWith('.') || importPath.endsWith('/')) {
        // Append '/index.js' to the path.
        return `${quote}${importPath}/index${outExtension}${quote}${semi}`;
      }

      // If the import path already ends with '.js', leave it as is.
      if (importPath.endsWith(outExtension)) {
        return `${quote}${importPath}${quote}${semi}`;
      }

      // Otherwise, append '.js' to the import path.
      return `${quote}${importPath}${outExtension}${quote}${semi}`;
    }
  );

/**
 * Converts validator/es/* imports to cjs paths
 * @param contents - The contents of the file to modify.
 * @returns The modified file contents with updated import paths.
 */
const convertToCjsImports = (contents: string) =>
  contents.replaceAll(
    validatorImport,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types -- broken
    (_, quote: string, importPath: string, es: string, semi: string = '') => {
      const outExtension = '.js';
      // If the import path already ends with '.js', leave it as is.
      const result = importPath.endsWith(outExtension)
        ? `${quote}${importPath}${quote}${semi}`
        : `${quote}${importPath}${outExtension}${quote}${semi}`;

      return result.replace(es, '');
    }
  );

export default defineConfig(() => ({
  entry: {
    index: './index.ts',
    email: './src/email/index.ts',
    'email/matchers': './src/email/matchers.ts',
    phone: './src/phone/index.ts',
    'phone/matchers': './src/phone/matchers.ts'
  },
  format: {
    esm: {
      target: ['node22']
    },
    cjs: {
      target: ['node20']
    }
  },
  clean: true,
  dts: true,
  minify: true,
  tsconfig: 'tsconfig.build.json',
  treeshake: {
    propertyReadSideEffects: false,
    propertyWriteSideEffects: false,
    moduleSideEffects: false,
    // tryCatchDeoptimization: false, Not implemented https://github.com/rolldown/rolldown/issues/5872
    unknownGlobalSideEffects: false
  },
  splitting: false,
  cjsDefault: true,
  plugins: [
    {
      name: 'fix-validator-import',
      renderChunk: {
        // Optional, but helps avoid running on unrelated chunks.
        filter: { code: /validator\/es\// },

        handler(code, chunk, outputOptions) {
          // This plugin only makes sense for JS module outputs.
          if (outputOptions.format !== 'es' && outputOptions.format !== 'cjs') {
            return;
          }

          // Derive the emitted extension from the actual chunk filename.
          // Falls back to a sane default if needed.
          const outExtension =
            path.extname(chunk.fileName) || (outputOptions.format === 'cjs' ? '.cjs' : '.js');

          const modify = outputOptions.format === 'cjs' ? convertToCjsImports : modifyEsmImports;

          const nextCode = modify(code, outExtension);

          if (nextCode === code) {
            return;
          }

          return {
            code: nextCode,
            // Replace with a precise sourcemap via MagicString if you need it.
            map: { mappings: '' }
          };
        }
      }
    }
  ],
  deps: {
    skipNodeModulesBundle: true
  }
}));

import { defineConfig } from 'tsup';

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
  format: ['esm', 'cjs'],
  bundle: true,
  clean: true,
  dts: true,
  minify: true,
  tsconfig: 'tsconfig.build.json',
  treeshake: {
    preset: 'smallest'
  },
  splitting: false,
  cjsInterop: true,
  esbuildPlugins: [
    {
      name: 'fix-validator-import',
      setup(build) {
        build.onEnd((result) => {
          // Determine the output file extension based on the build options.
          const outExtension = build.initialOptions.outExtension?.['.js'] ?? '.js';
          // Determine if the output format is ESM (ECMAScript Module).
          const isEsm = outExtension !== '.cjs';

          // If there are build errors, do not proceed.
          if (result.errors.length > 0) {
            return;
          }

          // Iterate over each output file generated by ESBuild.
          for (const outputFile of result.outputFiles ?? []) {
            // Only target files with the specified output extension.
            // This ignores additional files emitted, like sourcemaps (e.g., "*.js.map").
            if (outputFile.path.endsWith(outExtension)) {
              // Get the original file contents.
              const fileContents = outputFile.text;
              // Modify the file contents by appending the correct file extensions.
              const modify = isEsm ? modifyEsmImports : convertToCjsImports;
              const nextFileContents = modify(fileContents, outExtension);

              // Update the output file contents with the modified contents.
              outputFile.contents = Buffer.from(nextFileContents);
            }
          }
        });
      }
    }
  ],
  skipNodeModulesBundle: true
}));

import config from '@repo/eslint-config';
import ignorePatterns from '@repo/eslint-config/ignorePatterns';

const [_ignores, ...rest] = config;

export default [
  {
    ignores: [...ignorePatterns, 'examples/', '!.github']
  },
  ...rest
];

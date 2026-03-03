// eslint-disable-next-line n/no-unsupported-features/node-builtins -- use better-sqlite3 in production
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { emailHarmony } from 'better-auth-harmony';

const database = new DatabaseSync('auth.db');

export const auth = betterAuth({
  database,
  baseURL: 'http://localhost:3000/',
  emailAndPassword: { enabled: true },
  plugins: [emailHarmony()]
});

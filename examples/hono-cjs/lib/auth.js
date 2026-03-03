// eslint-disable-next-line n/no-unsupported-features/node-builtins -- use better-sqlite3 in production
const { DatabaseSync } = require('node:sqlite');
const { betterAuth } = require('better-auth');
const { emailHarmony } = require('better-auth-harmony');

const database = new DatabaseSync('auth.db');

const auth = betterAuth({
  database,
  baseURL: 'http://localhost:3000/',
  emailAndPassword: { enabled: true },
  plugins: [emailHarmony()]
});

module.exports = { auth };

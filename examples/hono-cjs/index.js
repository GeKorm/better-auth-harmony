const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { auth } = require('./lib/auth.js');

const app = new Hono();

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

const server = serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});

setTimeout(() => server.close(), 1000);

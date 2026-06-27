import { createServer as createHttpServer } from 'node:http';
import { createApp } from './app.js';

export function createServer(overrides = {}) {
  const { app } = createApp(overrides);
  return createHttpServer(app);
}

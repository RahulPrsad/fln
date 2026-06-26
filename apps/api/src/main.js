import { getRuntimeConfig } from './config.js';
import { createServer } from './server.js';

const config = getRuntimeConfig();
const server = createServer(config);

server.listen(config.port, config.host, () => {
  console.log(`${config.serviceName} listening on http://${config.host}:${config.port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down ${config.serviceName}.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

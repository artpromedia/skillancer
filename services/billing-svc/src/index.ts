// @skillancer/billing-svc
// Billing and payment processing service

import Fastify from 'fastify';

const server = Fastify({
  logger: true,
});

server.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 4002, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

export { server };

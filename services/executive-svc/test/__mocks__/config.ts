export const config = {
  nodeEnv: 'test',
  logLevel: 'error',
  port: 3005,
  host: '0.0.0.0',
  jwtSecret: 'test-jwt-secret',
  cookieSecret: 'test-cookie-secret',
  corsOrigins: ['http://localhost:3000'],
  apiBaseUrl: 'http://localhost:3005',
};

export const getConfig = () => config;

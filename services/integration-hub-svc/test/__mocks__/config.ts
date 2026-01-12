export const config = {
  nodeEnv: 'test',
  logLevel: 'error',
  port: 3006,
  host: '0.0.0.0',
  jwtSecret: 'test-jwt-secret',
  publicUrl: 'http://localhost:3006',
};

export const getConfig = () => config;

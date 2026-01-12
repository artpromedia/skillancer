import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3006';
process.env.HOST = 'localhost';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PUBLIC_URL = 'http://localhost:3006';

/**
 * API Security Tests
 * Tests for API security vulnerabilities (OWASP Top 10)
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('API Security', () => {
  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in search', async () => {
      const sqlPayload = "'; DROP TABLE users; --";

      const response = await fetch(`${API_URL}/jobs?search=${encodeURIComponent(sqlPayload)}`);

      expect(response.status).not.toBe(500);
    });

    it('should prevent SQL injection in IDs', async () => {
      const sqlPayload = '1 OR 1=1';

      const response = await fetch(`${API_URL}/jobs/${encodeURIComponent(sqlPayload)}`);

      expect([400, 404]).toContain(response.status);
    });

    it('should prevent SQL injection in filters', async () => {
      const sqlPayload = '1; SELECT * FROM users';

      const response = await fetch(`${API_URL}/jobs?category=${encodeURIComponent(sqlPayload)}`);

      expect(response.status).not.toBe(500);
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in queries', async () => {
      const nosqlPayload = '{"$gt": ""}';

      const response = await fetch(`${API_URL}/users?id=${encodeURIComponent(nosqlPayload)}`);

      expect(response.status).not.toBe(500);
    });

    it('should prevent object injection', async () => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: { $gt: '' },
          password: { $gt: '' },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit API requests', async () => {
      const requests = Array(100)
        .fill(null)
        .map(() => fetch(`${API_URL}/jobs`));

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((r) => r.status === 429);

      expect(rateLimited).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await fetch(`${API_URL}/jobs`);

      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });
  });

  describe('CORS Configuration', () => {
    it('should reject requests from unauthorized origins', async () => {
      const response = await fetch(`${API_URL}/jobs`, {
        headers: { Origin: 'https://malicious-site.com' },
      });

      const allowedOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(allowedOrigin).not.toBe('*');
      expect(allowedOrigin).not.toBe('https://malicious-site.com');
    });

    it('should allow requests from authorized origins', async () => {
      const response = await fetch(`${API_URL}/jobs`, {
        headers: { Origin: 'https://skillancer.com' },
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email formats', async () => {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'ValidPass123!',
          name: 'Test',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject oversized payloads', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ description: largePayload }),
      });

      expect([400, 413]).toContain(response.status);
    });

    it('should sanitize HTML in text fields', async () => {
      const htmlPayload = '<img src=x onerror=alert(1)>';

      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          title: 'Test Job',
          description: htmlPayload,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data.description).not.toContain('onerror');
      }
    });

    it('should validate UUID formats', async () => {
      const response = await fetch(`${API_URL}/jobs/not-a-uuid`);
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Authorization', () => {
    it('should prevent accessing other users data', async () => {
      // Try to access another user's private data
      const response = await fetch(`${API_URL}/users/other-user-id/settings`, {
        headers: { Authorization: 'Bearer user1-token' },
      });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent modifying other users resources', async () => {
      const response = await fetch(`${API_URL}/jobs/other-users-job-id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user1-token',
        },
        body: JSON.stringify({ title: 'Hijacked!' }),
      });

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in file access', async () => {
      const response = await fetch(`${API_URL}/files/../../../etc/passwd`);

      expect([400, 403, 404]).toContain(response.status);
    });
  });
});

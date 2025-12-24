/**
 * k6 API Testing
 *
 * API-specific performance tests for the Skillancer platform.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ==================== Configuration ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_VERSION = __ENV.API_VERSION || 'v1';

// ==================== Custom Metrics ====================

const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const crudLatency = new Trend('crud_latency');
const listLatency = new Trend('list_latency');

// ==================== Options ====================

export const options = {
  scenarios: {
    api_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    errors: ['rate<0.05'],
    auth_latency: ['p(95)<1000'],
    crud_latency: ['p(95)<500'],
    list_latency: ['p(95)<1000'],
    http_req_duration: ['p(95)<800'],
  },
};

// ==================== Helpers ====================

function api(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}/api/${API_VERSION}${path}`;
  const opts = {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  let response;

  switch (method) {
    case 'GET':
      response = http.get(url, opts);
      break;
    case 'POST':
      response = http.post(url, JSON.stringify(body), opts);
      break;
    case 'PUT':
      response = http.put(url, JSON.stringify(body), opts);
      break;
    case 'PATCH':
      response = http.patch(url, JSON.stringify(body), opts);
      break;
    case 'DELETE':
      response = http.del(url, opts);
      break;
  }

  return response;
}

function authenticate() {
  const start = Date.now();

  const response = api('POST', '/auth/login', {
    email: 'apitest@skillancer.io',
    password: 'ApiTest123!',
  });

  authLatency.add(Date.now() - start);

  const success = check(response, {
    'auth success': (r) => r.status === 200,
    'has token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!success);

  if (success) {
    return response.json('data.accessToken');
  }

  return null;
}

// ==================== Test Functions ====================

export default function () {
  const token = authenticate();

  if (!token) {
    sleep(1);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Test user endpoints
  group('User API', () => {
    const start = Date.now();

    // Get profile
    let response = api('GET', '/users/me', null, headers);
    check(response, {
      'get profile success': (r) => r.status === 200,
    });

    crudLatency.add(Date.now() - start);

    // Update profile
    response = api('PATCH', '/users/me', { displayName: `User ${Date.now()}` }, headers);
    check(response, {
      'update profile success': (r) => r.status === 200,
    });

    sleep(0.5);
  });

  // Test course endpoints
  group('Course API', () => {
    // List courses
    let start = Date.now();
    let response = api('GET', '/courses?page=1&limit=10', null, headers);

    listLatency.add(Date.now() - start);

    check(response, {
      'list courses success': (r) => r.status === 200,
      'has pagination': (r) => r.json('pagination') !== undefined,
    });

    // Get single course
    const courses = response.json('data') || [];
    if (courses.length > 0) {
      start = Date.now();
      response = api('GET', `/courses/${courses[0].id}`, null, headers);

      crudLatency.add(Date.now() - start);

      check(response, {
        'get course success': (r) => r.status === 200,
      });
    }

    sleep(0.5);
  });

  // Test job endpoints
  group('Job API', () => {
    // List jobs
    let start = Date.now();
    let response = api('GET', '/jobs?page=1&limit=10', null, headers);

    listLatency.add(Date.now() - start);

    check(response, {
      'list jobs success': (r) => r.status === 200,
    });

    // Search jobs
    start = Date.now();
    response = api('GET', '/jobs/search?q=developer&skills=react', null, headers);

    listLatency.add(Date.now() - start);

    check(response, {
      'search jobs success': (r) => r.status === 200,
    });

    sleep(0.5);
  });

  // Test notification endpoints
  group('Notification API', () => {
    const start = Date.now();
    const response = api('GET', '/notifications', null, headers);

    listLatency.add(Date.now() - start);

    check(response, {
      'list notifications success': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.5);
  });

  sleep(1);
}

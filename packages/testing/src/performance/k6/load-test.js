/**
 * k6 Load Testing Configuration
 *
 * Performance testing for the Skillancer platform API.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// ==================== Configuration ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_VERSION = __ENV.API_VERSION || 'v1';

// ==================== Custom Metrics ====================

// Error rate
const errorRate = new Rate('errors');

// API latency by endpoint
const apiLatency = new Trend('api_latency');
const loginLatency = new Trend('login_latency');
const dashboardLatency = new Trend('dashboard_latency');
const searchLatency = new Trend('search_latency');

// Request counts
const apiRequests = new Counter('api_requests');
const authRequests = new Counter('auth_requests');
const searchRequests = new Counter('search_requests');

// ==================== Test Scenarios ====================

export const options = {
  // Test scenarios
  scenarios: {
    // Smoke test - verify system works with minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 }, // Ramp up to 50 users
        { duration: '5m', target: 50 }, // Stay at 50 for 5 minutes
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '5m', target: 100 }, // Stay at 100 for 5 minutes
        { duration: '2m', target: 0 }, // Ramp down
      ],
      gracefulStop: '30s',
      tags: { scenario: 'load' },
      exec: 'loadTest',
      startTime: '35s', // Start after smoke test
    },

    // Stress test - push system to limits
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 }, // Ramp to 100
        { duration: '5m', target: 100 }, // Stay at 100
        { duration: '2m', target: 200 }, // Ramp to 200
        { duration: '5m', target: 200 }, // Stay at 200
        { duration: '2m', target: 300 }, // Ramp to 300
        { duration: '5m', target: 300 }, // Stay at 300
        { duration: '5m', target: 0 }, // Ramp down
      ],
      gracefulStop: '60s',
      tags: { scenario: 'stress' },
      exec: 'stressTest',
      startTime: '17m', // Start after load test
    },

    // Spike test - sudden traffic spikes
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 }, // Baseline
        { duration: '10s', target: 500 }, // Spike!
        { duration: '30s', target: 500 }, // Stay at spike
        { duration: '10s', target: 10 }, // Return to baseline
        { duration: '1m', target: 10 }, // Recovery
        { duration: '10s', target: 0 }, // Ramp down
      ],
      gracefulStop: '30s',
      tags: { scenario: 'spike' },
      exec: 'spikeTest',
      startTime: '44m', // Start after stress test
    },

    // Soak test - extended duration for memory leaks
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
      gracefulStop: '60s',
      tags: { scenario: 'soak' },
      exec: 'soakTest',
      startTime: '47m', // Start after spike test
    },
  },

  // Thresholds
  thresholds: {
    // Overall error rate should be below 1%
    errors: ['rate<0.01'],

    // 95th percentile response time should be below 500ms
    api_latency: ['p(95)<500'],

    // Login should be fast
    login_latency: ['p(95)<1000'],

    // Dashboard should load within 2 seconds
    dashboard_latency: ['p(95)<2000'],

    // Search should be responsive
    search_latency: ['p(95)<800'],

    // HTTP request duration
    http_req_duration: ['p(95)<500', 'p(99)<1000'],

    // HTTP failure rate
    http_req_failed: ['rate<0.01'],
  },
};

// ==================== Test Data ====================

const users = [
  { email: 'loadtest1@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest2@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest3@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest4@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest5@skillancer.io', password: 'LoadTest123!' },
];

const searchTerms = [
  'react developer',
  'node.js',
  'python',
  'machine learning',
  'ui design',
  'full stack',
  'mobile app',
  'devops',
];

// ==================== Helper Functions ====================

function getRandomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

function getRandomSearchTerm() {
  return searchTerms[Math.floor(Math.random() * searchTerms.length)];
}

function makeRequest(method, endpoint, body = null, params = {}) {
  const url = `${BASE_URL}/api/${API_VERSION}${endpoint}`;
  const options = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...params.headers,
    },
    tags: params.tags || {},
  };

  apiRequests.add(1);

  let response;
  const start = Date.now();

  if (method === 'GET') {
    response = http.get(url, options);
  } else if (method === 'POST') {
    response = http.post(url, JSON.stringify(body), options);
  } else if (method === 'PUT') {
    response = http.put(url, JSON.stringify(body), options);
  } else if (method === 'DELETE') {
    response = http.del(url, options);
  }

  const duration = Date.now() - start;
  apiLatency.add(duration);

  const success = response.status >= 200 && response.status < 300;
  errorRate.add(!success);

  return response;
}

function login(email, password) {
  authRequests.add(1);
  const start = Date.now();

  const response = http.post(
    `${BASE_URL}/api/${API_VERSION}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  loginLatency.add(Date.now() - start);

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!success);

  if (success) {
    return response.json('data.accessToken');
  }
  return null;
}

// ==================== Test Functions ====================

export function smokeTest() {
  group('Smoke Test', () => {
    // Health check
    group('Health Check', () => {
      const response = http.get(`${BASE_URL}/health`);
      check(response, {
        'health check passed': (r) => r.status === 200,
      });
    });

    // Login
    group('Authentication', () => {
      const user = getRandomUser();
      const token = login(user.email, user.password);

      if (token) {
        // Get user profile
        const profileResponse = makeRequest('GET', '/users/me', null, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(profileResponse, {
          'profile retrieved': (r) => r.status === 200,
        });
      }
    });

    sleep(1);
  });
}

export function loadTest() {
  group('Load Test', () => {
    // Login
    const user = getRandomUser();
    const token = login(user.email, user.password);

    if (!token) {
      sleep(1);
      return;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Dashboard
    group('Dashboard', () => {
      const start = Date.now();
      const response = makeRequest('GET', '/dashboard', null, {
        headers: authHeaders,
      });
      dashboardLatency.add(Date.now() - start);

      check(response, {
        'dashboard loaded': (r) => r.status === 200,
      });
    });

    sleep(Math.random() * 2 + 1);

    // Browse courses
    group('Courses', () => {
      const response = makeRequest('GET', '/courses?page=1&limit=10', null, {
        headers: authHeaders,
      });
      check(response, {
        'courses loaded': (r) => r.status === 200,
        'has course data': (r) => r.json('data') !== undefined,
      });
    });

    sleep(Math.random() * 2 + 1);

    // Search
    group('Search', () => {
      searchRequests.add(1);
      const term = getRandomSearchTerm();
      const start = Date.now();

      const response = makeRequest('GET', `/jobs/search?q=${encodeURIComponent(term)}`, null, {
        headers: authHeaders,
      });

      searchLatency.add(Date.now() - start);

      check(response, {
        'search completed': (r) => r.status === 200,
      });
    });

    sleep(Math.random() * 3 + 2);
  });
}

export function stressTest() {
  group('Stress Test', () => {
    // Same as load test but with more intensive operations
    const user = getRandomUser();
    const token = login(user.email, user.password);

    if (!token) {
      sleep(0.5);
      return;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Multiple rapid requests
    for (let i = 0; i < 5; i++) {
      makeRequest('GET', `/courses?page=${i + 1}&limit=20`, null, {
        headers: authHeaders,
      });
      sleep(0.1);
    }

    // Complex search
    const term = getRandomSearchTerm();
    makeRequest(
      'GET',
      `/jobs/search?q=${encodeURIComponent(term)}&skills=react,node.js&budget_min=1000`,
      null,
      { headers: authHeaders }
    );

    sleep(Math.random() * 2 + 1);
  });
}

export function spikeTest() {
  group('Spike Test', () => {
    // Quick authentication and request burst
    const user = getRandomUser();
    const token = login(user.email, user.password);

    if (token) {
      const authHeaders = { Authorization: `Bearer ${token}` };

      // Burst of requests
      for (let i = 0; i < 3; i++) {
        makeRequest('GET', '/dashboard', null, { headers: authHeaders });
        makeRequest('GET', '/notifications', null, { headers: authHeaders });
      }
    }

    sleep(0.5);
  });
}

export function soakTest() {
  // Same as load test for extended duration
  loadTest();
}

// ==================== Report Generation ====================

export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

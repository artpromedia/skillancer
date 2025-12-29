import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginDuration = new Trend('login_duration');
const tokenValidationDuration = new Trend('token_validation_duration');
const loginErrors = new Rate('login_errors');
const successfulLogins = new Counter('successful_logins');

export const options = {
  scenarios: {
    // Scenario 1: Sustained login load
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 167, // ~10,000 logins per minute
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
    // Scenario 2: Token validation throughput
    token_validation: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      startTime: '5m',
    },
  },
  thresholds: {
    login_duration: ['p(95)<200'], // 95% of logins < 200ms
    token_validation_duration: ['p(95)<50'], // Token validation < 50ms
    login_errors: ['rate<0.01'], // Error rate < 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

// Test user pool
const testUsers = [];
for (let i = 0; i < 1000; i++) {
  testUsers.push({
    email: `loadtest${i}@test.com`,
    password: 'LoadTest123!',
  });
}

let tokens = [];

export function setup() {
  // Pre-generate some valid tokens for token validation tests
  const setupTokens = [];

  for (let i = 0; i < 50; i++) {
    const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(testUsers[i]), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 200) {
      setupTokens.push(JSON.parse(res.body).accessToken);
    }
  }

  return { tokens: setupTokens };
}

export default function (data) {
  const scenario = __ENV.scenario;

  if (scenario === 'token_validation' || exec.scenario.name === 'token_validation') {
    tokenValidationTest(data);
  } else {
    loginTest();
  }
}

function loginTest() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];

  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    }
  );
  const duration = Date.now() - startTime;
  loginDuration.add(duration);

  const success = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns token': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.accessToken !== undefined;
    },
    'login response time < 200ms': (r) => r.timings.duration < 200,
  });

  if (success) {
    successfulLogins.add(1);
  } else {
    loginErrors.add(1);
  }

  sleep(0.1);
}

function tokenValidationTest(data) {
  if (!data.tokens || data.tokens.length === 0) {
    console.error('No tokens available for validation test');
    return;
  }

  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];

  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'token_validation' },
  });
  const duration = Date.now() - startTime;
  tokenValidationDuration.add(duration);

  check(res, {
    'token validation returns 200': (r) => r.status === 200,
    'token validation < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.05);
}

// Additional scenarios for edge cases
export function bruteForceProtection() {
  // Test that brute force protection kicks in
  const targetEmail = 'bruteforce-test@test.com';

  for (let i = 0; i < 15; i++) {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: targetEmail,
        password: `WrongPassword${i}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status === 429) {
      check(res, {
        'rate limiting activated': (r) => r.status === 429,
        'rate limit response includes retry-after': (r) => {
          return r.headers['Retry-After'] !== undefined;
        },
      });
      break;
    }
  }
}

export function teardown(data) {
  console.log('Authentication load test completed');
  console.log(`Total successful logins: ${successfulLogins.count}`);
}

// Import exec for scenario detection
import exec from 'k6/execution';

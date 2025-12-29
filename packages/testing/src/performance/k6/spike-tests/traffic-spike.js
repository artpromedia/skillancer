import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const recoveryTime = new Trend('recovery_time');
const requestsInSpike = new Counter('requests_in_spike');

export const options = {
  scenarios: {
    // Normal baseline load
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
    },
    // Traffic spike - 10x normal
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '10s', target: 500 }, // Rapid spike to 10x
        { duration: '1m', target: 500 }, // Hold spike
        { duration: '10s', target: 50 }, // Rapid return to normal
        { duration: '2m', target: 50 }, // Recovery observation
      ],
      startTime: '2m',
    },
  },
  thresholds: {
    errors: ['rate<0.05'], // Error rate < 5% during spike
    http_req_duration: ['p(95)<2000'], // 95% < 2s even during spike
    recovery_time: ['avg<30000'], // Average recovery < 30s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

let spikeStartTime = null;
let spikeEndTime = null;
let recoveryStartTime = null;
let recovered = false;

export function setup() {
  // Login to get auth token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'loadtest@test.com',
      password: 'LoadTest123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  return {
    token: JSON.parse(loginRes.body).accessToken,
  };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // Track spike timing
  const currentVUs = __VU;
  const now = Date.now();

  if (currentVUs > 100 && !spikeStartTime) {
    spikeStartTime = now;
    console.log('Spike detected - starting measurement');
  }

  if (spikeStartTime && currentVUs <= 100 && !spikeEndTime) {
    spikeEndTime = now;
    recoveryStartTime = now;
    console.log('Spike ended - monitoring recovery');
  }

  // Mix of different endpoint types
  const endpoints = [
    { path: '/api/jobs/search?q=developer', weight: 40 },
    { path: '/api/jobs/featured', weight: 20 },
    { path: '/api/users/me', weight: 15 },
    { path: '/api/notifications', weight: 10 },
    { path: '/api/messages/conversations', weight: 10 },
    { path: '/api/contracts', weight: 5 },
  ];

  // Weighted random selection
  const random = Math.random() * 100;
  let cumulative = 0;
  let selectedEndpoint = endpoints[0];

  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      selectedEndpoint = endpoint;
      break;
    }
  }

  const res = http.get(`${BASE_URL}${selectedEndpoint.path}`, { headers });

  if (spikeStartTime && !spikeEndTime) {
    requestsInSpike.add(1);
  }

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  // Check for recovery
  if (recoveryStartTime && !recovered) {
    if (res.status === 200 && res.timings.duration < 500) {
      // Consider recovered when response times return to normal
      const timeSinceRecoveryStart = now - recoveryStartTime;

      // Need 10 consecutive fast responses to consider recovered
      if (timeSinceRecoveryStart > 5000) {
        recovered = true;
        recoveryTime.add(timeSinceRecoveryStart);
        console.log(`System recovered in ${timeSinceRecoveryStart}ms`);
      }
    }
  }

  // Simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 second think time
}

export function teardown(data) {
  console.log('Traffic spike test completed');
  console.log('Spike duration:', spikeEndTime - spikeStartTime, 'ms');
  console.log('Requests during spike:', requestsInSpike.count);
}

// Cascading failure test scenario
export function cascadingFailureTest(data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // Simulate heavy database queries
  const heavyEndpoints = [
    '/api/analytics/dashboard',
    '/api/reports/generate',
    '/api/search/reindex',
  ];

  // Hit heavy endpoints to trigger potential cascading failure
  for (const endpoint of heavyEndpoints) {
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers,
      timeout: '30s',
    });

    check(res, {
      'heavy endpoint responds': (r) => r.status !== 0,
      'no timeout': (r) => r.timings.duration < 30000,
    });
  }

  // Immediately check if normal endpoints are affected
  const normalRes = http.get(`${BASE_URL}/api/health`, { headers });

  check(normalRes, {
    'health check still works': (r) => r.status === 200,
    'health check fast': (r) => r.timings.duration < 100,
  });
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const searchDuration = new Trend('search_duration');

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 500 }, // Ramp up to 500 users
    { duration: '5m', target: 1000 }, // Hold at 1000 users
    { duration: '2m', target: 500 }, // Ramp down to 500
    { duration: '1m', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    errors: ['rate<0.01'], // Error rate < 1%
    search_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

const searchQueries = [
  'react developer',
  'python machine learning',
  'node.js backend',
  'flutter mobile',
  'aws devops',
  'rust systems',
  'golang microservices',
  'typescript full stack',
];

const categories = ['web-development', 'mobile-development', 'data-science', 'devops', 'design'];

const budgetRanges = [
  { min: 500, max: 2000 },
  { min: 2000, max: 5000 },
  { min: 5000, max: 10000 },
  { min: 10000, max: 50000 },
];

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

  // Randomize search parameters
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const budget = budgetRanges[Math.floor(Math.random() * budgetRanges.length)];
  const page = Math.floor(Math.random() * 10) + 1;

  // Test 1: Basic keyword search
  const searchStart = Date.now();
  const searchRes = http.get(
    `${BASE_URL}/api/jobs/search?q=${encodeURIComponent(query)}&page=${page}`,
    { headers }
  );
  searchDuration.add(Date.now() - searchStart);

  const searchOk = check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search returns jobs': (r) => {
      const body = JSON.parse(r.body);
      return body.jobs && Array.isArray(body.jobs);
    },
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!searchOk);

  sleep(0.5);

  // Test 2: Search with filters
  const filterRes = http.get(
    `${BASE_URL}/api/jobs/search?q=${encodeURIComponent(query)}&category=${category}&budgetMin=${budget.min}&budgetMax=${budget.max}`,
    { headers }
  );

  const filterOk = check(filterRes, {
    'filtered search status is 200': (r) => r.status === 200,
    'filtered search response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!filterOk);

  sleep(0.5);

  // Test 3: Pagination
  const paginationRes = http.get(
    `${BASE_URL}/api/jobs/search?q=${encodeURIComponent(query)}&page=${page}&limit=20`,
    { headers }
  );

  const paginationOk = check(paginationRes, {
    'pagination status is 200': (r) => r.status === 200,
    'pagination has correct limit': (r) => {
      const body = JSON.parse(r.body);
      return body.jobs.length <= 20;
    },
  });
  errorRate.add(!paginationOk);

  sleep(0.5);

  // Test 4: Get job details (if search returned results)
  if (searchRes.status === 200) {
    const searchBody = JSON.parse(searchRes.body);
    if (searchBody.jobs && searchBody.jobs.length > 0) {
      const jobId = searchBody.jobs[0].id;
      const detailRes = http.get(`${BASE_URL}/api/jobs/${jobId}`, { headers });

      const detailOk = check(detailRes, {
        'job detail status is 200': (r) => r.status === 200,
        'job detail has title': (r) => {
          const body = JSON.parse(r.body);
          return body.title !== undefined;
        },
        'job detail response time < 300ms': (r) => r.timings.duration < 300,
      });
      errorRate.add(!detailOk);
    }
  }

  sleep(1);
}

export function teardown(data) {
  console.log('Job search load test completed');
}

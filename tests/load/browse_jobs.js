/**
 * k6 Load Test - Browse Jobs
 *
 * Simulates users browsing, searching, filtering, and interacting with
 * job listings on the Skillancer platform.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// ==================== Configuration ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_VERSION = __ENV.API_VERSION || 'v1';

// ==================== Custom Metrics ====================

const errorRate = new Rate('errors');

const jobsListLatency = new Trend('jobs_list_latency');
const jobDetailLatency = new Trend('job_detail_latency');
const jobSearchLatency = new Trend('job_search_latency');
const jobFilterLatency = new Trend('job_filter_latency');
const jobSaveLatency = new Trend('job_save_latency');
const loginLatency = new Trend('login_latency');

const totalRequests = new Counter('total_requests');
const searchRequests = new Counter('search_requests');
const filterRequests = new Counter('filter_requests');
const saveRequests = new Counter('save_requests');

// ==================== Test Scenarios ====================

export const options = {
  scenarios: {
    // Smoke test - verify the browse flow works with minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal expected browsing load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '30s',
      tags: { scenario: 'load' },
      exec: 'loadTest',
      startTime: '35s',
    },

    // Stress test - heavy browsing traffic
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 0 },
      ],
      gracefulStop: '60s',
      tags: { scenario: 'stress' },
      exec: 'stressTest',
      startTime: '17m',
    },

    // Spike test - sudden traffic surge (e.g., new jobs posted notification)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '10s', target: 0 },
      ],
      gracefulStop: '30s',
      tags: { scenario: 'spike' },
      exec: 'spikeTest',
      startTime: '44m',
    },
  },

  thresholds: {
    errors: ['rate<0.01'],
    jobs_list_latency: ['p(95)<500'],
    job_detail_latency: ['p(95)<500'],
    job_search_latency: ['p(95)<500'],
    job_filter_latency: ['p(95)<500'],
    job_save_latency: ['p(95)<500'],
    login_latency: ['p(95)<1000'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
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

const searchQueries = [
  'react developer',
  'node.js backend',
  'python data science',
  'mobile app development',
  'ui/ux design',
  'full stack engineer',
  'devops engineer',
  'machine learning',
  'wordpress developer',
  'graphic design',
  'copywriting',
  'seo specialist',
];

const jobCategories = [
  'web-development',
  'mobile-development',
  'design',
  'data-science',
  'devops',
  'writing',
  'marketing',
  'video-production',
];

const budgetRanges = [
  { min: 100, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: 5000 },
  { min: 5000, max: 10000 },
  { min: 10000, max: 50000 },
];

const experienceLevels = ['entry', 'intermediate', 'expert'];
const projectTypes = ['fixed', 'hourly'];
const sortOptions = ['newest', 'relevance', 'budget_high', 'budget_low'];

// ==================== Helper Functions ====================

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function apiUrl(endpoint) {
  return `${BASE_URL}/api/${API_VERSION}${endpoint}`;
}

function makeRequest(method, endpoint, body, headers, tags) {
  const url = apiUrl(endpoint);
  const reqOptions = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(headers || {}),
    },
    tags: tags || {},
  };

  totalRequests.add(1);

  let response;
  try {
    if (method === 'GET') {
      response = http.get(url, reqOptions);
    } else if (method === 'POST') {
      response = http.post(url, JSON.stringify(body), reqOptions);
    } else if (method === 'PUT') {
      response = http.put(url, JSON.stringify(body), reqOptions);
    } else if (method === 'DELETE') {
      response = http.del(url, null, reqOptions);
    }
  } catch (e) {
    errorRate.add(1);
    console.error(`Request failed: ${method} ${endpoint} - ${e.message}`);
    return null;
  }

  const success = response.status >= 200 && response.status < 300;
  errorRate.add(!success);

  return response;
}

function login() {
  const user = getRandomItem(users);
  const start = Date.now();

  const response = http.post(
    apiUrl('/auth/login'),
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    }
  );

  loginLatency.add(Date.now() - start);

  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login returns access token': (r) => {
      try {
        return r.json('data.accessToken') !== undefined;
      } catch (_e) {
        return false;
      }
    },
  });

  errorRate.add(!success);

  if (success) {
    try {
      return response.json('data.accessToken');
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// ==================== Job Browsing Actions ====================

function browseJobsList(token, page, limit) {
  const p = page || getRandomInt(1, 5);
  const l = limit || 20;
  const start = Date.now();

  const response = makeRequest('GET', `/jobs?page=${p}&limit=${l}`, null, authHeaders(token), {
    name: 'jobs_list',
  });

  jobsListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'jobs list returned': (r) => r.status === 200,
      'jobs list has data': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined;
        } catch (_e) {
          return false;
        }
      },
      'jobs list has pagination': (r) => {
        try {
          const body = r.json();
          return body.meta !== undefined || body.pagination !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function searchJobs(token, query) {
  const q = query || getRandomItem(searchQueries);
  const start = Date.now();
  searchRequests.add(1);

  const response = makeRequest(
    'GET',
    `/jobs/search?q=${encodeURIComponent(q)}&page=1&limit=20`,
    null,
    authHeaders(token),
    { name: 'jobs_search' }
  );

  jobSearchLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'search returned results': (r) => r.status === 200,
      'search has data array': (r) => {
        try {
          const body = r.json();
          return Array.isArray(body.data);
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function viewJobDetails(token, jobId) {
  const id = jobId || `job-${getRandomInt(1, 100)}`;
  const start = Date.now();

  const response = makeRequest('GET', `/jobs/${id}`, null, authHeaders(token), {
    name: 'job_detail',
  });

  jobDetailLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'job detail loaded': (r) => r.status === 200 || r.status === 404,
      'job detail has title': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.title') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function filterJobs(token) {
  filterRequests.add(1);

  const category = getRandomItem(jobCategories);
  const budget = getRandomItem(budgetRanges);
  const experience = getRandomItem(experienceLevels);
  const projectType = getRandomItem(projectTypes);
  const sort = getRandomItem(sortOptions);

  const queryParams = [
    `category=${category}`,
    `budget_min=${budget.min}`,
    `budget_max=${budget.max}`,
    `experience=${experience}`,
    `project_type=${projectType}`,
    `sort=${sort}`,
    'page=1',
    'limit=20',
  ].join('&');

  const start = Date.now();

  const response = makeRequest('GET', `/jobs?${queryParams}`, null, authHeaders(token), {
    name: 'jobs_filter',
  });

  jobFilterLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'filtered jobs returned': (r) => r.status === 200,
      'filtered results have data': (r) => {
        try {
          return r.json('data') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function saveJob(token, jobId) {
  const id = jobId || `job-${getRandomInt(1, 100)}`;
  saveRequests.add(1);
  const start = Date.now();

  const response = makeRequest('POST', `/jobs/${id}/save`, {}, authHeaders(token), {
    name: 'job_save',
  });

  jobSaveLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'job saved successfully': (r) => r.status === 200 || r.status === 201,
    });
  }

  return response;
}

function unsaveJob(token, jobId) {
  const id = jobId || `job-${getRandomInt(1, 100)}`;
  saveRequests.add(1);
  const start = Date.now();

  const response = makeRequest('DELETE', `/jobs/${id}/save`, null, authHeaders(token), {
    name: 'job_unsave',
  });

  jobSaveLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'job unsaved successfully': (r) => r.status === 200 || r.status === 204,
    });
  }

  return response;
}

function viewSavedJobs(token) {
  const start = Date.now();

  const response = makeRequest('GET', '/jobs/saved', null, authHeaders(token), {
    name: 'saved_jobs',
  });

  jobsListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'saved jobs returned': (r) => r.status === 200,
    });
  }

  return response;
}

// ==================== Test Functions ====================

export function smokeTest() {
  group('Browse Jobs - Smoke Test', () => {
    group('Login', () => {
      const token = login();
      if (!token) {
        console.error('Smoke test: login failed');
        return;
      }

      group('Browse Jobs List', () => {
        browseJobsList(token, 1, 10);
      });

      sleep(1);

      group('Search Jobs', () => {
        searchJobs(token, 'react developer');
      });

      sleep(1);

      group('View Job Details', () => {
        viewJobDetails(token, 'job-1');
      });

      sleep(1);
    });
  });
}

export function loadTest() {
  group('Browse Jobs - Load Test', () => {
    const token = login();

    if (!token) {
      sleep(1);
      return;
    }

    // Simulate a typical user browsing session
    group('Browse Jobs List', () => {
      browseJobsList(token);
    });

    sleep(Math.random() * 3 + 1); // User reads the list

    // Search for jobs
    group('Search Jobs', () => {
      searchJobs(token);
    });

    sleep(Math.random() * 2 + 1); // User reads search results

    // Apply filters
    group('Filter Jobs', () => {
      filterJobs(token);
    });

    sleep(Math.random() * 2 + 1); // User reviews filtered results

    // View a specific job
    group('View Job Details', () => {
      viewJobDetails(token);
    });

    sleep(Math.random() * 5 + 2); // User reads job details carefully

    // Save the job
    group('Save Job', () => {
      saveJob(token);
    });

    sleep(Math.random() + 0.5);

    // Browse to next page
    group('Next Page', () => {
      browseJobsList(token, 2, 20);
    });

    sleep(Math.random() * 2 + 1);

    // View another job
    group('View Another Job', () => {
      viewJobDetails(token);
    });

    sleep(Math.random() * 3 + 1);

    // Check saved jobs
    group('View Saved Jobs', () => {
      viewSavedJobs(token);
    });

    sleep(Math.random() * 2 + 1);
  });
}

export function stressTest() {
  group('Browse Jobs - Stress Test', () => {
    const token = login();

    if (!token) {
      sleep(0.5);
      return;
    }

    // Rapid pagination through multiple pages
    group('Rapid Pagination', () => {
      for (let page = 1; page <= 5; page++) {
        browseJobsList(token, page, 20);
        sleep(0.2);
      }
    });

    // Multiple searches in quick succession
    group('Rapid Search', () => {
      for (let i = 0; i < 3; i++) {
        searchJobs(token);
        sleep(0.1);
      }
    });

    // Multiple filter combinations
    group('Rapid Filtering', () => {
      for (let i = 0; i < 3; i++) {
        filterJobs(token);
        sleep(0.1);
      }
    });

    // View multiple job details
    group('Multiple Job Views', () => {
      for (let i = 0; i < 5; i++) {
        viewJobDetails(token);
        sleep(0.1);
      }
    });

    // Save and unsave jobs rapidly
    group('Rapid Save/Unsave', () => {
      const jobId = `job-${getRandomInt(1, 100)}`;
      saveJob(token, jobId);
      sleep(0.1);
      unsaveJob(token, jobId);
    });

    sleep(Math.random() + 0.5);
  });
}

export function spikeTest() {
  group('Browse Jobs - Spike Test', () => {
    const token = login();

    if (!token) {
      sleep(0.5);
      return;
    }

    // Burst of browse and search requests
    browseJobsList(token, 1, 20);
    searchJobs(token);
    filterJobs(token);
    viewJobDetails(token);

    sleep(0.5);
  });
}

// ==================== Report Generation ====================

export function handleSummary(data) {
  return {
    'browse-jobs-report.html': htmlReport(data),
    'browse-jobs-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

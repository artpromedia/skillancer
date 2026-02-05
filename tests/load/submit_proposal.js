/**
 * k6 Load Test - Submit Proposal
 *
 * Simulates the full freelancer proposal submission flow on the
 * Skillancer platform: login, browse jobs, view details, and submit proposals.
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

const loginLatency = new Trend('login_latency');
const jobsListLatency = new Trend('jobs_list_latency');
const jobDetailLatency = new Trend('job_detail_latency');
const proposalSubmitLatency = new Trend('proposal_submit_latency');
const proposalStatusLatency = new Trend('proposal_status_latency');
const proposalListLatency = new Trend('proposal_list_latency');

const totalRequests = new Counter('total_requests');
const proposalSubmissions = new Counter('proposal_submissions');
const successfulSubmissions = new Counter('successful_submissions');
const failedSubmissions = new Counter('failed_submissions');

// ==================== Test Scenarios ====================

export const options = {
  scenarios: {
    // Smoke test - verify proposal flow works end to end
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal proposal submission rate
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 60 },
        { duration: '5m', target: 60 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '30s',
      tags: { scenario: 'load' },
      exec: 'loadTest',
      startTime: '35s',
    },

    // Stress test - high volume of proposals
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 80 },
        { duration: '5m', target: 80 },
        { duration: '2m', target: 150 },
        { duration: '5m', target: 150 },
        { duration: '2m', target: 250 },
        { duration: '5m', target: 250 },
        { duration: '5m', target: 0 },
      ],
      gracefulStop: '60s',
      tags: { scenario: 'stress' },
      exec: 'stressTest',
      startTime: '17m',
    },

    // Spike test - sudden rush of proposals (e.g., popular job posting)
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
    login_latency: ['p(95)<1000'],
    jobs_list_latency: ['p(95)<500'],
    job_detail_latency: ['p(95)<500'],
    proposal_submit_latency: ['p(95)<500'],
    proposal_status_latency: ['p(95)<500'],
    proposal_list_latency: ['p(95)<500'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

// ==================== Test Data ====================

const freelancers = [
  { email: 'freelancer1@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer2@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer3@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer4@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer5@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest1@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest2@skillancer.io', password: 'LoadTest123!' },
  { email: 'loadtest3@skillancer.io', password: 'LoadTest123!' },
];

const coverLetters = [
  'I am a seasoned developer with over 5 years of experience in this field. I have successfully delivered similar projects and would love to bring my expertise to your team. My approach focuses on clean code, thorough testing, and clear communication throughout the project lifecycle.',
  'With my background in full-stack development and design, I am confident I can deliver exceptional results for your project. I have worked with clients ranging from startups to enterprise companies, and I understand the importance of meeting deadlines while maintaining quality.',
  'I have reviewed your project requirements carefully and I believe my skill set aligns perfectly with what you need. I have completed over 50 similar projects with a 98% client satisfaction rate. I am available to start immediately and can dedicate full-time hours to your project.',
  'As a specialist in this area, I bring both technical expertise and creative problem-solving to every project. I pride myself on delivering ahead of schedule and maintaining transparent communication. Let me show you how I can add value to your project.',
  'I am excited about this opportunity and confident in my ability to deliver outstanding results. My portfolio includes numerous successful projects in this domain, and I have strong references from past clients who can vouch for my work quality and professionalism.',
];

const milestoneTemplates = [
  [
    {
      title: 'Project Setup & Planning',
      amount: 200,
      description: 'Initial setup, architecture planning, and environment configuration.',
    },
    {
      title: 'Core Development',
      amount: 500,
      description: 'Implementation of core features and business logic.',
    },
    {
      title: 'Testing & QA',
      amount: 200,
      description: 'Comprehensive testing, bug fixes, and quality assurance.',
    },
    {
      title: 'Deployment & Handover',
      amount: 100,
      description: 'Production deployment, documentation, and project handover.',
    },
  ],
  [
    {
      title: 'Discovery & Design',
      amount: 300,
      description: 'Requirements analysis, wireframes, and design mockups.',
    },
    {
      title: 'Frontend Development',
      amount: 400,
      description: 'UI implementation with responsive design and accessibility.',
    },
    {
      title: 'Backend Development',
      amount: 400,
      description: 'API development, database setup, and integrations.',
    },
    {
      title: 'Launch & Support',
      amount: 150,
      description: 'Final deployment and 2-week post-launch support.',
    },
  ],
  [
    {
      title: 'Phase 1 - MVP',
      amount: 600,
      description: 'Minimum viable product with core functionality.',
    },
    {
      title: 'Phase 2 - Enhancements',
      amount: 400,
      description: 'Additional features and user experience improvements.',
    },
    {
      title: 'Phase 3 - Polish & Deliver',
      amount: 250,
      description: 'Final polish, optimization, and delivery.',
    },
  ],
];

const bidAmounts = [500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 5000];
const estimatedDurations = [7, 14, 21, 30, 45, 60, 90];

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

function loginAsFreelancer() {
  const user = getRandomItem(freelancers);
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
    'freelancer login status is 200': (r) => r.status === 200,
    'freelancer login returns token': (r) => {
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

// ==================== Proposal Flow Actions ====================

function browseJobs(token) {
  const page = getRandomInt(1, 5);
  const start = Date.now();

  const response = makeRequest(
    'GET',
    `/jobs?page=${page}&limit=20&status=open`,
    null,
    authHeaders(token),
    { name: 'jobs_list' }
  );

  jobsListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'jobs list loaded': (r) => r.status === 200,
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
      'job has description': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.description') !== undefined;
        } catch (_e) {
          return false;
        }
      },
      'job has budget info': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.budget') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function submitProposal(token, jobId) {
  const id = jobId || `job-${getRandomInt(1, 100)}`;
  const milestones = getRandomItem(milestoneTemplates);
  const bidAmount = getRandomItem(bidAmounts);
  const duration = getRandomItem(estimatedDurations);
  const coverLetter = getRandomItem(coverLetters);

  const proposalData = {
    jobId: id,
    coverLetter: coverLetter,
    bidAmount: bidAmount,
    estimatedDuration: duration,
    estimatedDurationUnit: 'days',
    milestones: milestones.map((m, idx) => ({
      title: m.title,
      description: m.description,
      amount: m.amount,
      duration: Math.ceil(duration / milestones.length),
      order: idx + 1,
    })),
    attachments: [],
  };

  proposalSubmissions.add(1);
  const start = Date.now();

  const response = makeRequest('POST', '/proposals', proposalData, authHeaders(token), {
    name: 'proposal_submit',
  });

  proposalSubmitLatency.add(Date.now() - start);

  if (response) {
    const submitted = check(response, {
      'proposal submitted': (r) => r.status === 200 || r.status === 201,
      'proposal has id': (r) => {
        try {
          if (r.status >= 300) return false;
          const body = r.json();
          return body.data && body.data.id !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });

    if (submitted) {
      successfulSubmissions.add(1);
      try {
        return response.json('data.id');
      } catch (_e) {
        return null;
      }
    } else {
      failedSubmissions.add(1);
    }
  } else {
    failedSubmissions.add(1);
  }

  return null;
}

function checkProposalStatus(token, proposalId) {
  const id = proposalId || `proposal-${getRandomInt(1, 100)}`;
  const start = Date.now();

  const response = makeRequest('GET', `/proposals/${id}`, null, authHeaders(token), {
    name: 'proposal_status',
  });

  proposalStatusLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'proposal status retrieved': (r) => r.status === 200 || r.status === 404,
      'proposal has status field': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.status') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function listMyProposals(token) {
  const start = Date.now();

  const response = makeRequest('GET', '/proposals/me?page=1&limit=20', null, authHeaders(token), {
    name: 'proposals_list',
  });

  proposalListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'my proposals listed': (r) => r.status === 200,
      'proposals list has data': (r) => {
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

function withdrawProposal(token, proposalId) {
  const id = proposalId || `proposal-${getRandomInt(1, 100)}`;

  const response = makeRequest(
    'PUT',
    `/proposals/${id}/withdraw`,
    { reason: 'Load test - automatic withdrawal' },
    authHeaders(token),
    { name: 'proposal_withdraw' }
  );

  if (response) {
    check(response, {
      'proposal withdrawn': (r) => r.status === 200 || r.status === 404,
    });
  }

  return response;
}

// ==================== Test Functions ====================

export function smokeTest() {
  group('Submit Proposal - Smoke Test', () => {
    group('Login as Freelancer', () => {
      const token = loginAsFreelancer();
      if (!token) {
        console.error('Smoke test: freelancer login failed');
        return;
      }

      group('Browse Available Jobs', () => {
        browseJobs(token);
      });

      sleep(1);

      group('View Job Details', () => {
        viewJobDetails(token, 'job-1');
      });

      sleep(1);

      group('Submit Proposal', () => {
        submitProposal(token, 'job-1');
      });

      sleep(1);

      group('Check My Proposals', () => {
        listMyProposals(token);
      });
    });
  });
}

export function loadTest() {
  group('Submit Proposal - Load Test', () => {
    const token = loginAsFreelancer();

    if (!token) {
      sleep(1);
      return;
    }

    // Step 1: Browse available jobs
    group('Browse Available Jobs', () => {
      browseJobs(token);
    });

    sleep(Math.random() * 3 + 2); // Freelancer scans the listings

    // Step 2: View a job that interests them
    group('View Job Details', () => {
      viewJobDetails(token);
    });

    sleep(Math.random() * 5 + 3); // Freelancer reads job details carefully

    // Step 3: Maybe check another job first
    if (Math.random() > 0.5) {
      group('View Another Job', () => {
        viewJobDetails(token);
      });
      sleep(Math.random() * 3 + 2);
    }

    // Step 4: Submit a proposal
    group('Submit Proposal', () => {
      const proposalId = submitProposal(token);

      // Step 5: Check proposal status
      if (proposalId) {
        sleep(Math.random() * 2 + 1);

        group('Check Proposal Status', () => {
          checkProposalStatus(token, proposalId);
        });
      }
    });

    sleep(Math.random() * 2 + 1);

    // Step 6: Check all my proposals
    group('Review My Proposals', () => {
      listMyProposals(token);
    });

    sleep(Math.random() * 2 + 1);
  });
}

export function stressTest() {
  group('Submit Proposal - Stress Test', () => {
    const token = loginAsFreelancer();

    if (!token) {
      sleep(0.5);
      return;
    }

    // Rapid job browsing
    group('Rapid Job Browsing', () => {
      for (let i = 0; i < 3; i++) {
        browseJobs(token);
        sleep(0.2);
      }
    });

    // Quick job detail views
    group('Quick Job Views', () => {
      for (let i = 0; i < 3; i++) {
        viewJobDetails(token);
        sleep(0.1);
      }
    });

    // Submit multiple proposals in succession
    group('Multiple Proposal Submissions', () => {
      for (let i = 0; i < 3; i++) {
        const proposalId = submitProposal(token);
        sleep(0.3);

        if (proposalId) {
          checkProposalStatus(token, proposalId);
          sleep(0.1);
        }
      }
    });

    // Rapid status checks
    group('Rapid Status Checks', () => {
      listMyProposals(token);
      sleep(0.1);
      listMyProposals(token);
    });

    sleep(Math.random() + 0.5);
  });
}

export function spikeTest() {
  group('Submit Proposal - Spike Test', () => {
    const token = loginAsFreelancer();

    if (!token) {
      sleep(0.5);
      return;
    }

    // Quick browse, view, and submit
    browseJobs(token);
    viewJobDetails(token);
    submitProposal(token);
    listMyProposals(token);

    sleep(0.5);
  });
}

// ==================== Lifecycle Hooks ====================

export function setup() {
  // Verify the API is accessible before running tests
  const healthCheck = http.get(`${BASE_URL}/health`);
  const isHealthy = check(healthCheck, {
    'API is accessible': (r) => r.status === 200,
  });

  if (!isHealthy) {
    console.warn('API health check failed - tests may not produce valid results');
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Submit Proposal load test completed in ${duration.toFixed(1)}s`);
}

// ==================== Report Generation ====================

export function handleSummary(data) {
  return {
    'submit-proposal-report.html': htmlReport(data),
    'submit-proposal-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

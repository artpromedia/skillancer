/**
 * k6 Load Test - Payment Flow
 *
 * Simulates users interacting with the Skillancer payment system:
 * viewing contracts, managing milestones, submitting work,
 * and reviewing payment history.
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
const contractListLatency = new Trend('contract_list_latency');
const contractDetailLatency = new Trend('contract_detail_latency');
const milestoneStatusLatency = new Trend('milestone_status_latency');
const milestoneSubmitLatency = new Trend('milestone_submit_latency');
const paymentHistoryLatency = new Trend('payment_history_latency');
const invoiceLatency = new Trend('invoice_latency');
const earningsLatency = new Trend('earnings_latency');

const totalRequests = new Counter('total_requests');
const milestoneSubmissions = new Counter('milestone_submissions');
const successfulSubmissions = new Counter('successful_milestone_submissions');
const paymentChecks = new Counter('payment_checks');

// ==================== Test Scenarios ====================

export const options = {
  scenarios: {
    // Smoke test - verify payment flow works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal payment activity
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

    // Stress test - high payment processing volume
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

    // Spike test - end-of-month payment rush
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
    contract_list_latency: ['p(95)<500'],
    contract_detail_latency: ['p(95)<500'],
    milestone_status_latency: ['p(95)<500'],
    milestone_submit_latency: ['p(95)<500'],
    payment_history_latency: ['p(95)<500'],
    invoice_latency: ['p(95)<500'],
    earnings_latency: ['p(95)<500'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

// ==================== Test Data ====================

const freelancers = [
  { email: 'freelancer1@skillancer.io', password: 'LoadTest123!', role: 'freelancer' },
  { email: 'freelancer2@skillancer.io', password: 'LoadTest123!', role: 'freelancer' },
  { email: 'freelancer3@skillancer.io', password: 'LoadTest123!', role: 'freelancer' },
  { email: 'freelancer4@skillancer.io', password: 'LoadTest123!', role: 'freelancer' },
];

const clients = [
  { email: 'client1@skillancer.io', password: 'LoadTest123!', role: 'client' },
  { email: 'client2@skillancer.io', password: 'LoadTest123!', role: 'client' },
  { email: 'client3@skillancer.io', password: 'LoadTest123!', role: 'client' },
  { email: 'client4@skillancer.io', password: 'LoadTest123!', role: 'client' },
];

const workSubmissionDescriptions = [
  'Completed the initial project setup including repository configuration, CI/CD pipeline, development environment, and comprehensive documentation for the onboarding process.',
  'Implemented the core feature set as discussed. All unit tests are passing with 95% coverage. The staging deployment is available for review at the provided URL.',
  'Finished the design phase with all wireframes, mockups, and style guide deliverables. Assets have been exported in the requested formats and uploaded to the shared drive.',
  'Completed the backend API endpoints with full CRUD operations, authentication middleware, rate limiting, and comprehensive error handling. Swagger documentation is included.',
  'Delivered the responsive frontend implementation with cross-browser testing completed. Performance audit shows all pages scoring above 90 on Lighthouse metrics.',
  'Database migration and optimization completed. Query performance improved by 60% with proper indexing. All data integrity checks pass successfully.',
];

const deliverableLinks = [
  'https://staging.example.com/project-demo',
  'https://github.com/example/project/pull/42',
  'https://drive.google.com/shared-folder/deliverables',
  'https://figma.com/file/project-design',
  'https://docs.google.com/document/project-documentation',
];

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
    } else if (method === 'PATCH') {
      response = http.patch(url, JSON.stringify(body), reqOptions);
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

function loginAs(userPool) {
  const user = getRandomItem(userPool);
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
      return {
        token: response.json('data.accessToken'),
        role: user.role,
      };
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// ==================== Payment Flow Actions ====================

function listContracts(token, status) {
  const queryParams = status ? `?status=${status}&page=1&limit=20` : '?page=1&limit=20';
  const start = Date.now();

  const response = makeRequest('GET', `/contracts${queryParams}`, null, authHeaders(token), {
    name: 'contracts_list',
  });

  contractListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'contracts listed': (r) => r.status === 200,
      'contracts has data': (r) => {
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

function viewContractDetails(token, contractId) {
  const id = contractId || `contract-${getRandomInt(1, 50)}`;
  const start = Date.now();

  const response = makeRequest('GET', `/contracts/${id}`, null, authHeaders(token), {
    name: 'contract_detail',
  });

  contractDetailLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'contract detail loaded': (r) => r.status === 200 || r.status === 404,
      'contract has milestones': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.milestones') !== undefined;
        } catch (_e) {
          return false;
        }
      },
      'contract has payment terms': (r) => {
        try {
          if (r.status === 404) return true;
          const data = r.json('data');
          return data.totalAmount !== undefined || data.budget !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function checkMilestoneStatus(token, contractId, milestoneId) {
  const cId = contractId || `contract-${getRandomInt(1, 50)}`;
  const mId = milestoneId || `milestone-${getRandomInt(1, 20)}`;
  const start = Date.now();

  const response = makeRequest(
    'GET',
    `/contracts/${cId}/milestones/${mId}`,
    null,
    authHeaders(token),
    { name: 'milestone_status' }
  );

  milestoneStatusLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'milestone status retrieved': (r) => r.status === 200 || r.status === 404,
      'milestone has status field': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.status') !== undefined;
        } catch (_e) {
          return false;
        }
      },
      'milestone has amount': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.amount') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function submitMilestoneWork(token, contractId, milestoneId) {
  const cId = contractId || `contract-${getRandomInt(1, 50)}`;
  const mId = milestoneId || `milestone-${getRandomInt(1, 20)}`;

  const submissionData = {
    description: getRandomItem(workSubmissionDescriptions),
    deliverableUrl: getRandomItem(deliverableLinks),
    hoursSpent: getRandomInt(8, 80),
    attachments: [],
    requestReview: true,
  };

  milestoneSubmissions.add(1);
  const start = Date.now();

  const response = makeRequest(
    'POST',
    `/contracts/${cId}/milestones/${mId}/submit`,
    submissionData,
    authHeaders(token),
    { name: 'milestone_submit' }
  );

  milestoneSubmitLatency.add(Date.now() - start);

  if (response) {
    const submitted = check(response, {
      'milestone work submitted': (r) => r.status === 200 || r.status === 201,
      'submission acknowledged': (r) => {
        try {
          if (r.status >= 300) return false;
          return r.json('data') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });

    if (submitted) {
      successfulSubmissions.add(1);
    }
  }

  return response;
}

function approveMilestone(token, contractId, milestoneId) {
  const cId = contractId || `contract-${getRandomInt(1, 50)}`;
  const mId = milestoneId || `milestone-${getRandomInt(1, 20)}`;

  const response = makeRequest(
    'POST',
    `/contracts/${cId}/milestones/${mId}/approve`,
    {
      feedback: 'Work looks great, approved.',
      rating: getRandomInt(4, 5),
    },
    authHeaders(token),
    { name: 'milestone_approve' }
  );

  if (response) {
    check(response, {
      'milestone approved': (r) => r.status === 200,
    });
  }

  return response;
}

function requestMilestoneRevision(token, contractId, milestoneId) {
  const cId = contractId || `contract-${getRandomInt(1, 50)}`;
  const mId = milestoneId || `milestone-${getRandomInt(1, 20)}`;

  const response = makeRequest(
    'POST',
    `/contracts/${cId}/milestones/${mId}/request-revision`,
    {
      feedback: 'A few changes are needed. Please review the comments in the PR.',
      revisionNotes: [
        'Update the responsive layout for mobile breakpoints.',
        'Fix the validation error messages to be more descriptive.',
      ],
    },
    authHeaders(token),
    { name: 'milestone_revision' }
  );

  if (response) {
    check(response, {
      'revision requested': (r) => r.status === 200,
    });
  }

  return response;
}

function viewPaymentHistory(token, page) {
  const p = page || 1;
  paymentChecks.add(1);
  const start = Date.now();

  const response = makeRequest(
    'GET',
    `/payments/history?page=${p}&limit=20`,
    null,
    authHeaders(token),
    { name: 'payment_history' }
  );

  paymentHistoryLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'payment history loaded': (r) => r.status === 200,
      'payment history has data': (r) => {
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

function viewEarnings(token, period) {
  const p = period || 'monthly';
  const start = Date.now();

  const response = makeRequest('GET', `/payments/earnings?period=${p}`, null, authHeaders(token), {
    name: 'earnings',
  });

  earningsLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'earnings loaded': (r) => r.status === 200,
      'earnings has total': (r) => {
        try {
          const data = r.json('data');
          return data.total !== undefined || data.earnings !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function viewInvoice(token, invoiceId) {
  const id = invoiceId || `invoice-${getRandomInt(1, 50)}`;
  const start = Date.now();

  const response = makeRequest('GET', `/invoices/${id}`, null, authHeaders(token), {
    name: 'invoice_detail',
  });

  invoiceLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'invoice loaded': (r) => r.status === 200 || r.status === 404,
    });
  }

  return response;
}

function listInvoices(token) {
  const start = Date.now();

  const response = makeRequest('GET', '/invoices?page=1&limit=20', null, authHeaders(token), {
    name: 'invoices_list',
  });

  invoiceLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'invoices listed': (r) => r.status === 200,
    });
  }

  return response;
}

function viewPaymentMethods(token) {
  const response = makeRequest('GET', '/payments/methods', null, authHeaders(token), {
    name: 'payment_methods',
  });

  if (response) {
    check(response, {
      'payment methods loaded': (r) => r.status === 200,
    });
  }

  return response;
}

// ==================== Test Functions ====================

export function smokeTest() {
  group('Payment Flow - Smoke Test', () => {
    // Test as freelancer
    group('Freelancer Login', () => {
      const auth = loginAs(freelancers);
      if (!auth) {
        console.error('Smoke test: freelancer login failed');
        return;
      }

      const token = auth.token;

      group('List Contracts', () => {
        listContracts(token, 'active');
      });

      sleep(1);

      group('View Contract Details', () => {
        viewContractDetails(token, 'contract-1');
      });

      sleep(1);

      group('Check Milestone Status', () => {
        checkMilestoneStatus(token, 'contract-1', 'milestone-1');
      });

      sleep(1);

      group('View Payment History', () => {
        viewPaymentHistory(token);
      });

      sleep(1);

      group('View Earnings', () => {
        viewEarnings(token, 'monthly');
      });
    });
  });
}

export function loadTest() {
  // Randomly choose between freelancer and client flow
  const isFreelancer = Math.random() > 0.4;

  if (isFreelancer) {
    freelancerPaymentFlow();
  } else {
    clientPaymentFlow();
  }
}

function freelancerPaymentFlow() {
  group('Payment Flow - Freelancer Load Test', () => {
    const auth = loginAs(freelancers);

    if (!auth) {
      sleep(1);
      return;
    }

    const token = auth.token;
    const contractId = `contract-${getRandomInt(1, 50)}`;
    const milestoneId = `milestone-${getRandomInt(1, 20)}`;

    // Step 1: View active contracts
    group('View Active Contracts', () => {
      listContracts(token, 'active');
    });

    sleep(Math.random() * 2 + 1);

    // Step 2: Open a specific contract
    group('View Contract Details', () => {
      viewContractDetails(token, contractId);
    });

    sleep(Math.random() * 2 + 1);

    // Step 3: Check current milestone status
    group('Check Milestone Status', () => {
      checkMilestoneStatus(token, contractId, milestoneId);
    });

    sleep(Math.random() * 2 + 1);

    // Step 4: Submit milestone work (if applicable)
    if (Math.random() > 0.5) {
      group('Submit Milestone Work', () => {
        submitMilestoneWork(token, contractId, milestoneId);
      });
      sleep(Math.random() * 2 + 1);
    }

    // Step 5: Check payment history
    group('View Payment History', () => {
      viewPaymentHistory(token);
    });

    sleep(Math.random() * 2 + 1);

    // Step 6: Review earnings
    group('View Earnings Dashboard', () => {
      viewEarnings(token, 'monthly');
    });

    sleep(Math.random() + 0.5);

    // Step 7: Check weekly earnings too
    if (Math.random() > 0.5) {
      group('View Weekly Earnings', () => {
        viewEarnings(token, 'weekly');
      });
      sleep(Math.random() + 0.5);
    }

    // Step 8: Review invoices
    group('View Invoices', () => {
      listInvoices(token);
    });

    sleep(Math.random() + 0.5);

    // Step 9: View a specific invoice
    if (Math.random() > 0.6) {
      group('View Invoice Detail', () => {
        viewInvoice(token);
      });
      sleep(Math.random() + 0.5);
    }

    // Step 10: Check payment methods
    if (Math.random() > 0.7) {
      group('View Payment Methods', () => {
        viewPaymentMethods(token);
      });
      sleep(Math.random() + 0.5);
    }
  });
}

function clientPaymentFlow() {
  group('Payment Flow - Client Load Test', () => {
    const auth = loginAs(clients);

    if (!auth) {
      sleep(1);
      return;
    }

    const token = auth.token;
    const contractId = `contract-${getRandomInt(1, 50)}`;
    const milestoneId = `milestone-${getRandomInt(1, 20)}`;

    // Step 1: View active contracts
    group('View Active Contracts', () => {
      listContracts(token, 'active');
    });

    sleep(Math.random() * 2 + 1);

    // Step 2: Open a contract to review
    group('View Contract Details', () => {
      viewContractDetails(token, contractId);
    });

    sleep(Math.random() * 3 + 2);

    // Step 3: Check milestone status
    group('Check Milestone Status', () => {
      checkMilestoneStatus(token, contractId, milestoneId);
    });

    sleep(Math.random() * 3 + 2);

    // Step 4: Approve or request revision (client-side action)
    if (Math.random() > 0.3) {
      group('Approve Milestone', () => {
        approveMilestone(token, contractId, milestoneId);
      });
    } else {
      group('Request Revision', () => {
        requestMilestoneRevision(token, contractId, milestoneId);
      });
    }

    sleep(Math.random() * 2 + 1);

    // Step 5: Review payment history
    group('View Payment History', () => {
      viewPaymentHistory(token);
    });

    sleep(Math.random() * 2 + 1);

    // Step 6: View invoices
    group('View Invoices', () => {
      listInvoices(token);
    });

    sleep(Math.random() + 0.5);

    // Step 7: Check payment methods
    if (Math.random() > 0.5) {
      group('View Payment Methods', () => {
        viewPaymentMethods(token);
      });
      sleep(Math.random() + 0.5);
    }
  });
}

export function stressTest() {
  group('Payment Flow - Stress Test', () => {
    const auth = loginAs(Math.random() > 0.5 ? freelancers : clients);

    if (!auth) {
      sleep(0.5);
      return;
    }

    const token = auth.token;

    // Rapid contract listing with different statuses
    group('Rapid Contract Listing', () => {
      const statuses = ['active', 'completed', 'pending', 'disputed'];
      for (const status of statuses) {
        listContracts(token, status);
        sleep(0.1);
      }
    });

    // Multiple contract detail views
    group('Multiple Contract Views', () => {
      for (let i = 0; i < 5; i++) {
        viewContractDetails(token);
        sleep(0.1);
      }
    });

    // Rapid milestone checks
    group('Rapid Milestone Checks', () => {
      for (let i = 0; i < 5; i++) {
        const contractId = `contract-${getRandomInt(1, 50)}`;
        const milestoneId = `milestone-${getRandomInt(1, 20)}`;
        checkMilestoneStatus(token, contractId, milestoneId);
        sleep(0.1);
      }
    });

    // Multiple milestone submissions
    group('Multiple Submissions', () => {
      for (let i = 0; i < 3; i++) {
        submitMilestoneWork(token);
        sleep(0.2);
      }
    });

    // Payment history pagination
    group('Payment History Pagination', () => {
      for (let page = 1; page <= 3; page++) {
        viewPaymentHistory(token, page);
        sleep(0.1);
      }
    });

    // Earnings across different periods
    group('Earnings Across Periods', () => {
      const periods = ['weekly', 'monthly', 'yearly'];
      for (const period of periods) {
        viewEarnings(token, period);
        sleep(0.1);
      }
    });

    sleep(Math.random() + 0.5);
  });
}

export function spikeTest() {
  group('Payment Flow - Spike Test', () => {
    const auth = loginAs(Math.random() > 0.5 ? freelancers : clients);

    if (!auth) {
      sleep(0.5);
      return;
    }

    const token = auth.token;

    // Burst of typical payment flow actions
    listContracts(token, 'active');
    viewContractDetails(token);
    checkMilestoneStatus(token);
    viewPaymentHistory(token);
    viewEarnings(token, 'monthly');
    listInvoices(token);

    sleep(0.5);
  });
}

// ==================== Lifecycle Hooks ====================

export function setup() {
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
  console.log(`Payment flow load test completed in ${duration.toFixed(1)}s`);
}

// ==================== Report Generation ====================

export function handleSummary(data) {
  return {
    'payment-flow-report.html': htmlReport(data),
    'payment-flow-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

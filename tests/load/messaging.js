/**
 * k6 Load Test - Messaging System
 *
 * Simulates users interacting with the Skillancer messaging system:
 * listing conversations, opening threads, sending messages, and
 * testing WebSocket connectivity for real-time updates.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import ws from 'k6/ws';

// ==================== Configuration ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';
const API_VERSION = __ENV.API_VERSION || 'v1';

// ==================== Custom Metrics ====================

const errorRate = new Rate('errors');

const loginLatency = new Trend('login_latency');
const conversationListLatency = new Trend('conversation_list_latency');
const conversationOpenLatency = new Trend('conversation_open_latency');
const messageListLatency = new Trend('message_list_latency');
const messageSendLatency = new Trend('message_send_latency');
const messageReadLatency = new Trend('message_read_latency');
const wsConnectionLatency = new Trend('ws_connection_latency');

const totalRequests = new Counter('total_requests');
const messagesSent = new Counter('messages_sent');
const wsConnections = new Counter('ws_connections');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsMessagesReceived = new Counter('ws_messages_received');

// ==================== Test Scenarios ====================

export const options = {
  scenarios: {
    // Smoke test - verify messaging works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Load test - normal messaging activity
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 40 },
        { duration: '5m', target: 40 },
        { duration: '2m', target: 80 },
        { duration: '5m', target: 80 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '30s',
      tags: { scenario: 'load' },
      exec: 'loadTest',
      startTime: '35s',
    },

    // Stress test - heavy messaging load
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

    // Spike test - sudden message burst
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
    conversation_list_latency: ['p(95)<500'],
    conversation_open_latency: ['p(95)<500'],
    message_list_latency: ['p(95)<500'],
    message_send_latency: ['p(95)<500'],
    message_read_latency: ['p(95)<500'],
    ws_connection_latency: ['p(95)<500'],
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
  { email: 'freelancer1@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer2@skillancer.io', password: 'LoadTest123!' },
  { email: 'freelancer3@skillancer.io', password: 'LoadTest123!' },
];

const messageTexts = [
  'Hi, I wanted to follow up on the project requirements. Could you share more details about the timeline?',
  'Thank you for your message. I have reviewed the specifications and have a few questions about the scope.',
  'The latest deliverable has been uploaded. Please review and let me know if any changes are needed.',
  'I am available for a call this week if you want to discuss the project progress in more detail.',
  'Just a quick update: the milestone is on track and I expect to complete it by end of this week.',
  'Could you clarify the requirements for the authentication module? I want to make sure I am on the right track.',
  'Great progress so far! I have pushed the latest changes to the staging environment for your review.',
  'I noticed a potential issue with the design spec. Can we schedule a quick sync to discuss?',
  'The payment for the last milestone has been processed. Thank you for the prompt approval.',
  'I am starting work on the next phase. I will share daily updates on the progress.',
];

const attachmentTypes = [
  null,
  { name: 'screenshot.png', type: 'image/png', size: 245000 },
  { name: 'document.pdf', type: 'application/pdf', size: 512000 },
  { name: 'design-mockup.figma', type: 'application/octet-stream', size: 128000 },
  null,
  null,
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
      return {
        token: response.json('data.accessToken'),
        userId: response.json('data.user.id') || 'unknown',
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

// ==================== Messaging Actions ====================

function listConversations(token, page) {
  const p = page || 1;
  const start = Date.now();

  const response = makeRequest(
    'GET',
    `/conversations?page=${p}&limit=20`,
    null,
    authHeaders(token),
    { name: 'conversations_list' }
  );

  conversationListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'conversations listed': (r) => r.status === 200,
      'conversations has data': (r) => {
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

function openConversation(token, conversationId) {
  const id = conversationId || `conv-${getRandomInt(1, 50)}`;
  const start = Date.now();

  const response = makeRequest('GET', `/conversations/${id}`, null, authHeaders(token), {
    name: 'conversation_open',
  });

  conversationOpenLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'conversation opened': (r) => r.status === 200 || r.status === 404,
      'conversation has participants': (r) => {
        try {
          if (r.status === 404) return true;
          return r.json('data.participants') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function getMessages(token, conversationId, page) {
  const id = conversationId || `conv-${getRandomInt(1, 50)}`;
  const p = page || 1;
  const start = Date.now();

  const response = makeRequest(
    'GET',
    `/conversations/${id}/messages?page=${p}&limit=50`,
    null,
    authHeaders(token),
    { name: 'messages_list' }
  );

  messageListLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'messages retrieved': (r) => r.status === 200 || r.status === 404,
      'messages have data array': (r) => {
        try {
          if (r.status === 404) return true;
          return Array.isArray(r.json('data'));
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function sendMessage(token, conversationId) {
  const id = conversationId || `conv-${getRandomInt(1, 50)}`;
  const text = getRandomItem(messageTexts);
  const attachment = getRandomItem(attachmentTypes);

  const messageData = {
    content: text,
    type: 'text',
  };

  if (attachment) {
    messageData.attachments = [attachment];
    messageData.type = 'attachment';
  }

  messagesSent.add(1);
  const start = Date.now();

  const response = makeRequest(
    'POST',
    `/conversations/${id}/messages`,
    messageData,
    authHeaders(token),
    { name: 'message_send' }
  );

  messageSendLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'message sent': (r) => r.status === 200 || r.status === 201,
      'message has id': (r) => {
        try {
          if (r.status >= 300) return false;
          return r.json('data.id') !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  }

  return response;
}

function markMessagesRead(token, conversationId) {
  const id = conversationId || `conv-${getRandomInt(1, 50)}`;
  const start = Date.now();

  const response = makeRequest(
    'PATCH',
    `/conversations/${id}/read`,
    { readAt: new Date().toISOString() },
    authHeaders(token),
    { name: 'messages_read' }
  );

  messageReadLatency.add(Date.now() - start);

  if (response) {
    check(response, {
      'messages marked as read': (r) => r.status === 200 || r.status === 204,
    });
  }

  return response;
}

function getUnreadCount(token) {
  const response = makeRequest('GET', '/conversations/unread-count', null, authHeaders(token), {
    name: 'unread_count',
  });

  if (response) {
    check(response, {
      'unread count retrieved': (r) => r.status === 200,
    });
  }

  return response;
}

function createConversation(token, recipientId) {
  const recipient = recipientId || `user-${getRandomInt(1, 100)}`;

  const response = makeRequest(
    'POST',
    '/conversations',
    {
      participantIds: [recipient],
      initialMessage: getRandomItem(messageTexts),
    },
    authHeaders(token),
    { name: 'conversation_create' }
  );

  if (response) {
    check(response, {
      'conversation created': (r) => r.status === 200 || r.status === 201,
    });
  }

  return response;
}

function searchConversations(token, query) {
  const q = query || getRandomItem(['project', 'milestone', 'payment', 'design', 'update']);

  const response = makeRequest(
    'GET',
    `/conversations/search?q=${encodeURIComponent(q)}`,
    null,
    authHeaders(token),
    { name: 'conversations_search' }
  );

  if (response) {
    check(response, {
      'conversation search completed': (r) => r.status === 200,
    });
  }

  return response;
}

// ==================== WebSocket Testing ====================

function testWebSocketConnection(token) {
  const wsUrl = `${WS_URL}/ws/messaging?token=${token}`;
  const start = Date.now();

  wsConnections.add(1);

  try {
    const response = ws.connect(wsUrl, { tags: { name: 'ws_connect' } }, function (socket) {
      wsConnectionLatency.add(Date.now() - start);

      socket.on('open', function () {
        check(null, {
          'ws connection opened': () => true,
        });

        // Send a ping to verify connection is alive
        socket.send(JSON.stringify({ type: 'ping' }));
        wsMessagesSent.add(1);
      });

      socket.on('message', function (msg) {
        wsMessagesReceived.add(1);

        try {
          const data = JSON.parse(msg);
          check(null, {
            'ws message received': () => data !== undefined,
            'ws message has type': () => data.type !== undefined,
          });
        } catch (_e) {
          // Non-JSON message received; still valid
        }
      });

      socket.on('error', function (e) {
        errorRate.add(1);
        console.error(`WebSocket error: ${e.error()}`);
      });

      socket.on('close', function () {
        // Connection closed as expected
      });

      // Keep connection open briefly, then send a test message
      sleep(1);

      // Send a typing indicator
      socket.send(
        JSON.stringify({
          type: 'typing',
          conversationId: `conv-${getRandomInt(1, 50)}`,
        })
      );
      wsMessagesSent.add(1);

      sleep(1);

      // Gracefully close
      socket.close();
    });

    check(response, {
      'ws connection status is 101': (r) => r && r.status === 101,
    });
  } catch (e) {
    // WebSocket may not be available in all environments
    console.warn(`WebSocket test skipped or failed: ${e.message}`);
    wsConnectionLatency.add(Date.now() - start);
  }
}

// ==================== Test Functions ====================

export function smokeTest() {
  group('Messaging - Smoke Test', () => {
    group('Login', () => {
      const auth = login();
      if (!auth) {
        console.error('Smoke test: login failed');
        return;
      }

      const token = auth.token;

      group('Check Unread Count', () => {
        getUnreadCount(token);
      });

      sleep(0.5);

      group('List Conversations', () => {
        listConversations(token);
      });

      sleep(1);

      group('Open a Conversation', () => {
        openConversation(token, 'conv-1');
      });

      sleep(0.5);

      group('Get Messages', () => {
        getMessages(token, 'conv-1');
      });

      sleep(1);

      group('Send a Message', () => {
        sendMessage(token, 'conv-1');
      });

      sleep(0.5);

      group('Mark as Read', () => {
        markMessagesRead(token, 'conv-1');
      });

      sleep(0.5);

      group('WebSocket Connection', () => {
        testWebSocketConnection(token);
      });
    });
  });
}

export function loadTest() {
  group('Messaging - Load Test', () => {
    const auth = login();

    if (!auth) {
      sleep(1);
      return;
    }

    const token = auth.token;

    // Step 1: Check unread messages notification
    group('Check Unread Count', () => {
      getUnreadCount(token);
    });

    sleep(Math.random() + 0.5);

    // Step 2: List conversations
    group('List Conversations', () => {
      listConversations(token);
    });

    sleep(Math.random() * 2 + 1); // User scans conversation list

    // Step 3: Open a conversation
    const convId = `conv-${getRandomInt(1, 50)}`;

    group('Open Conversation', () => {
      openConversation(token, convId);
    });

    sleep(Math.random() + 0.5);

    // Step 4: Load message history
    group('Load Messages', () => {
      getMessages(token, convId);
    });

    sleep(Math.random() * 3 + 2); // User reads messages

    // Step 5: Mark conversation as read
    group('Mark as Read', () => {
      markMessagesRead(token, convId);
    });

    sleep(Math.random() + 0.5);

    // Step 6: Send a reply
    group('Send Reply', () => {
      sendMessage(token, convId);
    });

    sleep(Math.random() * 2 + 1); // User composes next message

    // Step 7: Maybe send another message
    if (Math.random() > 0.5) {
      group('Send Follow-up', () => {
        sendMessage(token, convId);
      });
      sleep(Math.random() * 2 + 1);
    }

    // Step 8: Maybe check another conversation
    if (Math.random() > 0.6) {
      const anotherConvId = `conv-${getRandomInt(1, 50)}`;
      group('Switch Conversation', () => {
        openConversation(token, anotherConvId);
        sleep(0.5);
        getMessages(token, anotherConvId);
      });
      sleep(Math.random() * 2 + 1);
    }

    // Step 9: Search conversations (occasionally)
    if (Math.random() > 0.7) {
      group('Search Conversations', () => {
        searchConversations(token);
      });
      sleep(Math.random() + 0.5);
    }

    // Step 10: WebSocket connection test (simulates real-time channel)
    if (Math.random() > 0.8) {
      group('WebSocket Connection', () => {
        testWebSocketConnection(token);
      });
    }

    sleep(Math.random() + 0.5);
  });
}

export function stressTest() {
  group('Messaging - Stress Test', () => {
    const auth = login();

    if (!auth) {
      sleep(0.5);
      return;
    }

    const token = auth.token;

    // Rapid conversation listing and switching
    group('Rapid Conversation Switching', () => {
      listConversations(token);
      for (let i = 0; i < 5; i++) {
        const convId = `conv-${getRandomInt(1, 50)}`;
        openConversation(token, convId);
        getMessages(token, convId);
        sleep(0.1);
      }
    });

    // Burst message sending
    group('Message Burst', () => {
      const convId = `conv-${getRandomInt(1, 50)}`;
      for (let i = 0; i < 5; i++) {
        sendMessage(token, convId);
        sleep(0.1);
      }
    });

    // Concurrent read markers
    group('Concurrent Read Markers', () => {
      for (let i = 0; i < 3; i++) {
        markMessagesRead(token, `conv-${getRandomInt(1, 50)}`);
        sleep(0.05);
      }
    });

    // Rapid unread count polling
    group('Unread Count Polling', () => {
      for (let i = 0; i < 5; i++) {
        getUnreadCount(token);
        sleep(0.1);
      }
    });

    // Message history pagination under load
    group('History Pagination', () => {
      const convId = `conv-${getRandomInt(1, 50)}`;
      for (let page = 1; page <= 3; page++) {
        getMessages(token, convId, page);
        sleep(0.1);
      }
    });

    sleep(Math.random() + 0.5);
  });
}

export function spikeTest() {
  group('Messaging - Spike Test', () => {
    const auth = login();

    if (!auth) {
      sleep(0.5);
      return;
    }

    const token = auth.token;

    // Burst of messaging actions
    getUnreadCount(token);
    listConversations(token);

    const convId = `conv-${getRandomInt(1, 50)}`;
    openConversation(token, convId);
    getMessages(token, convId);
    sendMessage(token, convId);
    markMessagesRead(token, convId);

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
  console.log(`Messaging load test completed in ${duration.toFixed(1)}s`);
}

// ==================== Report Generation ====================

export function handleSummary(data) {
  return {
    'messaging-report.html': htmlReport(data),
    'messaging-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

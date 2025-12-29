import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const messageLatency = new Trend('message_latency');
const connectionErrors = new Rate('connection_errors');
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp up to 100 connections
    { duration: '1m', target: 250 }, // Ramp up to 250
    { duration: '2m', target: 500 }, // Hold at 500 connections
    { duration: '30m', target: 500 }, // Stability test for 30 minutes
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    message_latency: ['p(95)<100'], // 95% of messages delivered < 100ms
    connection_errors: ['rate<0.01'], // Connection error rate < 1%
    ws_connecting: ['p(95)<1000'], // Connection time < 1s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:4000';

export function setup() {
  // Create test users and conversations
  const users = [];

  for (let i = 0; i < 10; i++) {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: `loadtest${i}@test.com`,
        password: 'LoadTest123!',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status === 200) {
      const data = JSON.parse(loginRes.body);
      users.push({
        id: data.user.id,
        token: data.accessToken,
      });
    }
  }

  return { users };
}

export default function (data) {
  const userIndex = __VU % data.users.length;
  const user = data.users[userIndex];

  if (!user) {
    console.error('No user available for VU', __VU);
    return;
  }

  const url = `${WS_URL}/api/messages/ws?token=${user.token}`;

  const res = ws.connect(url, {}, function (socket) {
    let messageId = 0;
    const pendingMessages = new Map();

    socket.on('open', () => {
      console.log(`VU ${__VU}: WebSocket connected`);

      // Send periodic messages
      socket.setInterval(() => {
        const msgId = `msg_${__VU}_${messageId++}`;
        const sendTime = Date.now();

        pendingMessages.set(msgId, sendTime);

        socket.send(
          JSON.stringify({
            type: 'message',
            id: msgId,
            conversationId: 'test-conversation',
            content: `Load test message from VU ${__VU}`,
            timestamp: sendTime,
          })
        );

        messagesSent.add(1);
      }, 2000); // Send message every 2 seconds
    });

    socket.on('message', (msg) => {
      messagesReceived.add(1);

      try {
        const data = JSON.parse(msg);

        // Calculate latency for acknowledged messages
        if (data.type === 'ack' && data.messageId) {
          const sendTime = pendingMessages.get(data.messageId);
          if (sendTime) {
            const latency = Date.now() - sendTime;
            messageLatency.add(latency);
            pendingMessages.delete(data.messageId);

            check(latency, {
              'message latency < 100ms': (l) => l < 100,
            });
          }
        }

        // Handle incoming messages
        if (data.type === 'message') {
          // Send delivery receipt
          socket.send(
            JSON.stringify({
              type: 'receipt',
              messageId: data.id,
              status: 'delivered',
            })
          );
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });

    socket.on('error', (e) => {
      console.error(`VU ${__VU}: WebSocket error:`, e);
      connectionErrors.add(1);
    });

    socket.on('close', () => {
      console.log(`VU ${__VU}: WebSocket closed`);
    });

    // Keep connection alive for the test duration
    socket.setTimeout(() => {
      socket.close();
    }, 60000); // Close after 1 minute, k6 will reconnect
  });

  const connected = check(res, {
    'WebSocket connected successfully': (r) => r && r.status === 101,
  });

  if (!connected) {
    connectionErrors.add(1);
  }

  sleep(1);
}

export function teardown(data) {
  console.log('Real-time messaging load test completed');
}

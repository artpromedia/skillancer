# @skillancer/websocket-client

Shared WebSocket client library with React hooks for Skillancer real-time features.

## Features

- 🔌 **Auto-reconnection** with exponential backoff
- 🔐 **JWT authentication** token attachment
- 📊 **Connection state management** (connecting, connected, reconnecting, disconnected)
- 🎯 **Type-safe events** with full TypeScript support
- ⚛️ **React hooks** for easy integration
- 👥 **Presence tracking** for online status
- 💬 **Conversation hooks** for messaging
- 🔔 **Notification hooks** for real-time alerts

## Installation

```bash
pnpm add @skillancer/websocket-client
```

## Quick Start

### 1. Wrap your app with the provider

```tsx
import { WebSocketProvider } from '@skillancer/websocket-client';

function App() {
  const token = useAuthToken(); // Your auth token

  return (
    <WebSocketProvider
      options={{
        url: 'http://localhost:3010',
        token,
        debug: process.env.NODE_ENV === 'development',
      }}
    >
      <YourApp />
    </WebSocketProvider>
  );
}
```

### 2. Use hooks in your components

```tsx
import { useWebSocket, useSocketEvent, useOnlineStatus } from '@skillancer/websocket-client';

function ChatComponent() {
  const { isConnected, state } = useWebSocket();

  // Track user online status
  const { isOnline, presence } = useOnlineStatus('user-123');

  // Subscribe to events
  useSocketEvent('message:new', (data) => {
    console.log('New message:', data.message);
  });

  return (
    <div>
      <p>Connection: {state}</p>
      <p>User online: {isOnline ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## Hooks

### `useWebSocket()`

Main hook for connection management.

```tsx
const {
  state, // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  connectionInfo, // Full connection info including user, socketId, etc.
  isConnected, // boolean shorthand
  connect, // () => Promise<void>
  disconnect, // () => void
  setToken, // (token: string) => void
  client, // WebSocketClient instance
} = useWebSocket();
```

### `useSocketEvent(event, callback)`

Subscribe to server events with automatic cleanup.

```tsx
useSocketEvent('message:new', (data) => {
  // Handle new message
});

useSocketEvent('notification:push', (notification) => {
  // Handle notification
});

useSocketEvent('presence:changed', (data) => {
  // Handle presence change
});
```

### `useOnlineStatus(userId)`

Track a single user's online status.

```tsx
const { isOnline, presence, status, lastSeen } = useOnlineStatus('user-id');
```

### `useOnlineStatuses(userIds)`

Track multiple users' online statuses.

```tsx
const presences = useOnlineStatuses(['user-1', 'user-2', 'user-3']);
// presences['user-1'].status === 'online'
```

### `useConversation(conversationId)`

Full conversation management with messages, typing, etc.

```tsx
const {
  messages, // Message[]
  typingUsers, // { userId, name }[]
  sendMessage, // (content, options?) => Promise<{ messageId }>
  setTyping, // (isTyping: boolean) => void
  markAsRead, // (messageIds: string[]) => void
} = useConversation('conversation-id');
```

### `useNotifications()`

Notification management.

```tsx
const {
  notifications, // NotificationPayload[]
  unreadCount, // number
  markAsRead, // (notificationId: string) => void
  markAllRead, // () => void
  dismiss, // (notificationId: string) => void
} = useNotifications();
```

### `useRoom(roomName)`

Room membership management.

```tsx
const {
  isJoined, // boolean
  members, // number
  join, // (metadata?) => Promise<void>
  leave, // (reason?) => Promise<void>
} = useRoom('project:123');
```

### `useSocketEmit()` & `useSocketEmitWithAck()`

Emit events to the server.

```tsx
const emit = useSocketEmit();
const emitWithAck = useSocketEmitWithAck();

// Fire and forget
emit('message:typing', { conversationId: '123', isTyping: true });

// With acknowledgment
const response = await emitWithAck('message:send', {
  conversationId: '123',
  content: 'Hello!',
});
```

## Client API

For non-React usage or advanced cases:

```typescript
import { WebSocketClient, createWebSocketClient } from '@skillancer/websocket-client';

const client = createWebSocketClient({
  url: 'http://localhost:3010',
  token: 'your-jwt-token',
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  debug: true,
});

// Subscribe to events
client.on('message:new', (data) => {
  console.log('New message:', data.message);
});

// Emit events
client.emit('message:send', {
  conversationId: '123',
  content: 'Hello!',
});

// With acknowledgment
const response = await client.emitWithAck('message:send', {
  conversationId: '123',
  content: 'Hello!',
});

// Connection management
await client.connect();
client.disconnect();
client.setToken('new-token');

// Room management
await client.joinRoom('conversation:123');
await client.leaveRoom('conversation:123');

// State
client.getState(); // 'connected'
client.isConnected(); // true
client.getConnectionInfo(); // { state, socketId, user, ... }
```

## Events

### Client → Server Events

| Event                | Payload                          | Description              |
| -------------------- | -------------------------------- | ------------------------ |
| `room:join`          | `{ room, metadata? }`            | Join a room              |
| `room:leave`         | `{ room, reason? }`              | Leave a room             |
| `message:send`       | `MessagePayload`                 | Send a message           |
| `message:typing`     | `{ conversationId, isTyping }`   | Typing indicator         |
| `message:read`       | `{ conversationId, messageIds }` | Mark messages read       |
| `presence:update`    | `{ status, currentActivity? }`   | Update presence          |
| `presence:subscribe` | `{ userIds }`                    | Subscribe to presence    |
| `notification:ack`   | `{ notificationId }`             | Acknowledge notification |

### Server → Client Events

| Event               | Payload                       | Description           |
| ------------------- | ----------------------------- | --------------------- |
| `message:new`       | `{ message, conversationId }` | New message received  |
| `message:typing`    | `TypingEvent`                 | User is typing        |
| `notification:push` | `NotificationPayload`         | New notification      |
| `presence:update`   | `UserPresence`                | User presence changed |
| `presence:changed`  | `{ userId, status }`          | Quick status change   |
| `room:joined`       | `{ room, members? }`          | Joined a room         |
| `room:user-joined`  | `{ room, user, timestamp }`   | User joined room      |

## Configuration Options

```typescript
interface WebSocketClientOptions {
  url?: string; // Server URL (default: 'http://localhost:3010')
  path?: string; // Socket.io path (default: '/socket.io')
  token?: string; // JWT token
  getToken?: () => string | Promise<string>; // Token getter function
  autoConnect?: boolean; // Connect on init (default: true)
  reconnection?: boolean; // Enable reconnection (default: true)
  reconnectionAttempts?: number; // Max attempts (default: 10)
  reconnectionDelay?: number; // Initial delay ms (default: 1000)
  reconnectionDelayMax?: number; // Max delay ms (default: 30000)
  randomizationFactor?: number; // Jitter (default: 0.5)
  timeout?: number; // Connection timeout ms (default: 20000)
  debug?: boolean; // Enable logging (default: false)
}
```

## License

MIT - Skillancer Platform

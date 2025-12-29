import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// SkillPod Integration Tests
// Tests the complete VDI session lifecycle

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface TestContext {
  accessToken: string;
  userId: string;
  contractId: string;
  podId: string;
  sessionId: string;
}

const ctx: TestContext = {
  accessToken: '',
  userId: '',
  contractId: '',
  podId: '',
  sessionId: '',
};

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.accessToken && { Authorization: `Bearer ${ctx.accessToken}` }),
      ...options.headers,
    },
  });
}

describe('SkillPod Integration Flow', () => {
  beforeAll(async () => {
    // Setup: Create test user and authenticate
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'freelancer@test.com',
        password: 'TestPassword123!',
      }),
    });
    const loginData = await loginRes.json();
    ctx.accessToken = loginData.accessToken;
    ctx.userId = loginData.user.id;

    // Create a test contract for the pod
    const contractRes = await apiRequest('/api/contracts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Contract for VDI',
        clientId: 'test-client-id',
        hourlyRate: 75,
        requiresVdi: true,
      }),
    });
    const contractData = await contractRes.json();
    ctx.contractId = contractData.id;
  });

  afterAll(async () => {
    // Cleanup: Terminate any active sessions
    if (ctx.sessionId) {
      await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/terminate`, {
        method: 'POST',
      });
    }
    if (ctx.podId) {
      await apiRequest(`/api/skillpod/pods/${ctx.podId}`, {
        method: 'DELETE',
      });
    }
  });

  describe('Pod Provisioning', () => {
    it('should create a new pod', async () => {
      const res = await apiRequest('/api/skillpod/pods', {
        method: 'POST',
        body: JSON.stringify({
          contractId: ctx.contractId,
          template: 'development-standard',
          resources: {
            cpu: 2,
            memory: 4096,
            storage: 50,
          },
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBe('provisioning');
      ctx.podId = data.id;
    });

    it('should poll until pod is ready', async () => {
      const maxAttempts = 30;
      let attempts = 0;
      let status = 'provisioning';

      while (status !== 'ready' && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000));
        const res = await apiRequest(`/api/skillpod/pods/${ctx.podId}`);
        const data = await res.json();
        status = data.status;
        attempts++;
      }

      expect(status).toBe('ready');
    }, 60000);

    it('should list user pods', async () => {
      const res = await apiRequest('/api/skillpod/pods');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.pods)).toBe(true);
      expect(data.pods.some((p: { id: string }) => p.id === ctx.podId)).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should create a VDI session', async () => {
      const res = await apiRequest(`/api/skillpod/pods/${ctx.podId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          resolution: '1920x1080',
          quality: 'high',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sessionId).toBeDefined();
      expect(data.connectionUrl).toBeDefined();
      expect(data.status).toBe('connecting');
      ctx.sessionId = data.sessionId;
    });

    it('should get session connection details', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/connection`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webSocketUrl).toBeDefined();
      expect(data.iceServers).toBeDefined();
    });

    it('should update session status to active', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Containment Policy', () => {
    it('should have containment policy applied', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/policy`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.clipboardBlocked).toBe(true);
      expect(data.fileTransferBlocked).toBe(true);
      expect(data.printingBlocked).toBe(true);
      expect(data.recordingEnabled).toBe(true);
    });

    it('should block clipboard operation', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/clipboard`, {
        method: 'POST',
        body: JSON.stringify({
          operation: 'copy',
          content: 'sensitive data',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('blocked');
    });

    it('should block file transfer', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/files/upload`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: 'test.txt',
          content: 'base64content',
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Violation Detection', () => {
    it('should log policy violation attempt', async () => {
      // Trigger a violation
      await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/clipboard`, {
        method: 'POST',
        body: JSON.stringify({ operation: 'copy', content: 'test' }),
      });

      // Check violation log
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/violations`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.violations.length).toBeGreaterThan(0);
      expect(data.violations[0].type).toBe('clipboard_blocked');
    });

    it('should include violation in audit log', async () => {
      const res = await apiRequest(`/api/audit/sessions/${ctx.sessionId}/events`);
      expect(res.status).toBe(200);
      const data = await res.json();
      const violationEvent = data.events.find(
        (e: { eventType: string }) => e.eventType === 'policy_violation'
      );
      expect(violationEvent).toBeDefined();
    });
  });

  describe('Session Recording', () => {
    it('should have recording enabled', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/recording/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isRecording).toBe(true);
      expect(data.startedAt).toBeDefined();
    });

    it('should capture session metrics', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/metrics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duration).toBeDefined();
      expect(data.keystrokes).toBeDefined();
      expect(data.mouseEvents).toBeDefined();
    });
  });

  describe('Session Termination', () => {
    it('should terminate session', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/terminate`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('terminated');
    });

    it('should have recording available after termination', async () => {
      const res = await apiRequest(`/api/skillpod/sessions/${ctx.sessionId}/recording`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.recordingUrl).toBeDefined();
      expect(data.duration).toBeGreaterThan(0);
    });

    it('should cleanup pod resources', async () => {
      const res = await apiRequest(`/api/skillpod/pods/${ctx.podId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      // Verify pod is deleted
      const checkRes = await apiRequest(`/api/skillpod/pods/${ctx.podId}`);
      expect(checkRes.status).toBe(404);
    });
  });
});

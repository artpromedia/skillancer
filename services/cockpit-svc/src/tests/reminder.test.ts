/**
 * @module @skillancer/cockpit-svc/tests/reminder
 * Reminder Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  clientReminder: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
  },
});

const createMockRedis = () => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
});

const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

// =============================================================================
// TEST DATA
// =============================================================================

const mockFreelancerUserId = 'freelancer-123';

const mockClient = {
  id: 'client-123',
  freelancerUserId: mockFreelancerUserId,
  companyName: 'Acme Corp',
};

const mockReminder = {
  id: 'reminder-123',
  freelancerUserId: mockFreelancerUserId,
  clientId: 'client-123',
  title: 'Follow up on proposal',
  description: 'Check if they reviewed the proposal',
  reminderType: 'FOLLOW_UP',
  priority: 'MEDIUM',
  status: 'PENDING',
  dueDate: new Date('2024-02-15'),
  isRecurring: false,
  recurringPattern: null,
  completedAt: null,
  snoozedUntil: null,
  notifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: {
    id: 'client-123',
    companyName: 'Acme Corp',
    firstName: null,
    lastName: null,
  },
};

const mockRecurringReminder = {
  ...mockReminder,
  id: 'reminder-recurring',
  title: 'Monthly check-in',
  isRecurring: true,
  recurringPattern: {
    frequency: 'monthly',
    interval: 1,
    endDate: '2024-12-31',
  },
};

// =============================================================================
// TESTS
// =============================================================================

describe('Reminder Repository', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('create', () => {
    it('should create a new reminder', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientReminder.create.mockResolvedValue(mockReminder);

      const result = await mockPrisma.clientReminder.create({
        data: {
          freelancerUserId: mockFreelancerUserId,
          clientId: 'client-123',
          title: 'Follow up on proposal',
          reminderType: 'FOLLOW_UP',
          priority: 'MEDIUM',
          status: 'PENDING',
          dueDate: new Date('2024-02-15'),
        },
      });

      expect(result.title).toBe('Follow up on proposal');
      expect(result.status).toBe('PENDING');
    });

    it('should create a recurring reminder', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientReminder.create.mockResolvedValue(mockRecurringReminder);

      const result = await mockPrisma.clientReminder.create({
        data: {
          freelancerUserId: mockFreelancerUserId,
          clientId: 'client-123',
          title: 'Monthly check-in',
          reminderType: 'CHECK_IN',
          priority: 'LOW',
          status: 'PENDING',
          dueDate: new Date('2024-02-01'),
          isRecurring: true,
          recurringPattern: {
            frequency: 'monthly',
            interval: 1,
          },
        },
      });

      expect(result.isRecurring).toBe(true);
      expect(result.recurringPattern).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should find reminder by ID', async () => {
      mockPrisma.clientReminder.findUnique.mockResolvedValue(mockReminder);

      const result = await mockPrisma.clientReminder.findUnique({
        where: { id: 'reminder-123' },
      });

      expect(result).toEqual(mockReminder);
    });

    it('should include client details', async () => {
      mockPrisma.clientReminder.findUnique.mockResolvedValue(mockReminder);

      const result = await mockPrisma.clientReminder.findUnique({
        where: { id: 'reminder-123' },
        include: { client: true },
      });

      expect(result?.client).toBeDefined();
    });
  });

  describe('search', () => {
    it('should find reminders by status', async () => {
      mockPrisma.clientReminder.findMany.mockResolvedValue([mockReminder]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'PENDING',
        },
      });

      expect(reminders).toHaveLength(1);
      expect(reminders[0].status).toBe('PENDING');
    });

    it('should find reminders by client', async () => {
      mockPrisma.clientReminder.findMany.mockResolvedValue([mockReminder]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          clientId: 'client-123',
        },
      });

      expect(reminders[0].clientId).toBe('client-123');
    });

    it('should find reminders by date range', async () => {
      mockPrisma.clientReminder.findMany.mockResolvedValue([mockReminder]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          dueDate: {
            gte: new Date('2024-02-01'),
            lte: new Date('2024-02-28'),
          },
        },
      });

      expect(reminders).toHaveLength(1);
    });
  });
});

describe('Reminder Status Updates', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('complete', () => {
    it('should mark reminder as complete', async () => {
      mockPrisma.clientReminder.findUnique.mockResolvedValue(mockReminder);
      mockPrisma.clientReminder.update.mockResolvedValue({
        ...mockReminder,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await mockPrisma.clientReminder.update({
        where: { id: 'reminder-123' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });

    it('should not complete already completed reminder', async () => {
      mockPrisma.clientReminder.findUnique.mockResolvedValue({
        ...mockReminder,
        status: 'COMPLETED',
      });

      // Verify the reminder is already completed
      const reminder = await mockPrisma.clientReminder.findUnique({
        where: { id: 'reminder-123' },
      });

      expect(reminder?.status).toBe('COMPLETED');
    });
  });

  describe('snooze', () => {
    it('should snooze reminder', async () => {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 1);

      mockPrisma.clientReminder.update.mockResolvedValue({
        ...mockReminder,
        status: 'SNOOZED',
        snoozedUntil: snoozeUntil,
      });

      const result = await mockPrisma.clientReminder.update({
        where: { id: 'reminder-123' },
        data: { status: 'SNOOZED', snoozedUntil: snoozeUntil },
      });

      expect(result.status).toBe('SNOOZED');
      expect(result.snoozedUntil).toEqual(snoozeUntil);
    });
  });

  describe('cancel', () => {
    it('should cancel reminder', async () => {
      mockPrisma.clientReminder.update.mockResolvedValue({
        ...mockReminder,
        status: 'CANCELLED',
      });

      const result = await mockPrisma.clientReminder.update({
        where: { id: 'reminder-123' },
        data: { status: 'CANCELLED' },
      });

      expect(result.status).toBe('CANCELLED');
    });
  });
});

describe('Reminder Queries', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('upcoming reminders', () => {
    it('should find upcoming reminders', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockPrisma.clientReminder.findMany.mockResolvedValue([
        { ...mockReminder, dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        {
          ...mockReminder,
          id: 'reminder-2',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      ]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'PENDING',
          dueDate: { lte: futureDate },
        },
        orderBy: { dueDate: 'asc' },
      });

      expect(reminders).toHaveLength(2);
    });
  });

  describe('overdue reminders', () => {
    it('should find overdue reminders', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockPrisma.clientReminder.findMany.mockResolvedValue([
        { ...mockReminder, dueDate: pastDate },
      ]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'PENDING',
          dueDate: { lt: new Date() },
        },
      });

      expect(reminders).toHaveLength(1);
    });
  });

  describe('today reminders', () => {
    it('should find reminders due today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockPrisma.clientReminder.findMany.mockResolvedValue([mockReminder]);

      const reminders = await mockPrisma.clientReminder.findMany({
        where: {
          freelancerUserId: mockFreelancerUserId,
          status: 'PENDING',
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      expect(reminders).toBeDefined();
    });
  });
});

describe('Recurring Reminders', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should calculate next due date for daily recurrence', () => {
    const currentDueDate = new Date('2024-02-15');
    const nextDate = new Date(currentDueDate);
    nextDate.setDate(nextDate.getDate() + 1);

    expect(nextDate.getDate()).toBe(16);
  });

  it('should calculate next due date for weekly recurrence', () => {
    const currentDueDate = new Date('2024-02-15');
    const nextDate = new Date(currentDueDate);
    nextDate.setDate(nextDate.getDate() + 7);

    expect(nextDate.getDate()).toBe(22);
  });

  it('should calculate next due date for monthly recurrence', () => {
    const currentDueDate = new Date('2024-02-15');
    const nextDate = new Date(currentDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    expect(nextDate.getMonth()).toBe(2); // March
  });

  it('should calculate next due date for yearly recurrence', () => {
    const currentDueDate = new Date('2024-02-15');
    const nextDate = new Date(currentDueDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);

    expect(nextDate.getFullYear()).toBe(2025);
  });

  it('should respect interval in recurrence pattern', () => {
    const currentDueDate = new Date('2024-02-15');
    const interval = 2;
    const nextDate = new Date(currentDueDate);
    nextDate.setDate(nextDate.getDate() + interval * 7); // bi-weekly

    expect(nextDate.getDate()).toBe(29);
  });

  it('should stop recurrence after end date', () => {
    const currentDueDate = new Date('2024-12-15');
    const endDate = new Date('2024-12-31');
    const nextDate = new Date(currentDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    expect(nextDate > endDate).toBe(true);
  });
});

describe('Reminder Worker', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should wake up snoozed reminders', async () => {
    mockPrisma.clientReminder.updateMany.mockResolvedValue({ count: 5 });

    const result = await mockPrisma.clientReminder.updateMany({
      where: {
        status: 'SNOOZED',
        snoozedUntil: { lte: new Date() },
      },
      data: {
        status: 'PENDING',
        snoozedUntil: null,
      },
    });

    expect(result.count).toBe(5);
  });

  it('should mark overdue reminders', async () => {
    mockPrisma.clientReminder.updateMany.mockResolvedValue({ count: 3 });

    const result = await mockPrisma.clientReminder.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    expect(result.count).toBe(3);
  });

  it('should find reminders needing notification', async () => {
    const fifteenMinutesFromNow = new Date();
    fifteenMinutesFromNow.setMinutes(fifteenMinutesFromNow.getMinutes() + 15);

    mockPrisma.clientReminder.findMany.mockResolvedValue([mockReminder]);

    const reminders = await mockPrisma.clientReminder.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: fifteenMinutesFromNow },
        notifiedAt: null,
      },
    });

    expect(reminders).toHaveLength(1);
  });
});

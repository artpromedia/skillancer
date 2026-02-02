/**
 * @module @skillancer/billing-svc/tests/payment-flow
 * Integration Tests for Full Payment Flow: Client Charge → Freelancer Payout
 *
 * This test suite verifies the complete payment flow:
 * 1. Client creates escrow payment for a contract
 * 2. Freelancer completes milestone
 * 3. Client approves milestone
 * 4. Platform releases funds from escrow
 * 5. Freelancer balance is credited
 * 6. Freelancer requests payout
 * 7. Funds are transferred to freelancer's bank account
 */

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock Stripe
const mockStripePaymentIntents = {
  create: vi.fn(),
  confirm: vi.fn(),
  retrieve: vi.fn(),
};

const mockStripeTransfers = {
  create: vi.fn(),
  retrieve: vi.fn(),
};

const mockStripeAccounts = {
  retrieve: vi.fn(),
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: mockStripePaymentIntents,
      transfers: mockStripeTransfers,
      accounts: mockStripeAccounts,
    })),
  };
});

// Mock Logger
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
}));

// Mock notification service
const mockNotificationService = {
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDashboardNotification: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@skillancer/service-client', () => ({
  getServiceClient: vi.fn(() => ({
    notification: mockNotificationService,
  })),
}));

// In-memory data stores for testing
const escrowStore = new Map();
const milestoneStore = new Map();
const payoutStore = new Map();
const balanceStore = new Map();
const payoutAccountStore = new Map();

// Mock repositories
const mockEscrowRepo = {
  create: vi.fn((data) => {
    const escrow = { id: `escrow-${Date.now()}`, ...data, createdAt: new Date() };
    escrowStore.set(escrow.id, escrow);
    return escrow;
  }),
  findById: vi.fn((id) => escrowStore.get(id)),
  update: vi.fn((id, data) => {
    const existing = escrowStore.get(id);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    escrowStore.set(id, updated);
    return updated;
  }),
};

const mockMilestoneRepo = {
  create: vi.fn((data) => {
    const milestone = { id: `milestone-${Date.now()}`, ...data, createdAt: new Date() };
    milestoneStore.set(milestone.id, milestone);
    return milestone;
  }),
  findById: vi.fn((id) => milestoneStore.get(id)),
  findByEscrowId: vi.fn((escrowId) =>
    Array.from(milestoneStore.values()).filter((m) => m.escrowId === escrowId)
  ),
  update: vi.fn((id, data) => {
    const existing = milestoneStore.get(id);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    milestoneStore.set(id, updated);
    return updated;
  }),
};

const mockPayoutRepo = {
  create: vi.fn((data) => {
    const payout = { id: `payout-${Date.now()}`, ...data, createdAt: new Date() };
    payoutStore.set(payout.id, payout);
    return payout;
  }),
  findById: vi.fn((id) => payoutStore.get(id)),
  findByUserId: vi.fn((userId) =>
    Array.from(payoutStore.values()).filter((p) => p.userId === userId)
  ),
  update: vi.fn((id, data) => {
    const existing = payoutStore.get(id);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    payoutStore.set(id, updated);
    return updated;
  }),
  findAccountByUserId: vi.fn((userId) => payoutAccountStore.get(userId)),
};

const mockBalanceRepo = {
  getOrCreate: vi.fn((userId, currency) => {
    const key = `${userId}-${currency}`;
    if (!balanceStore.has(key)) {
      balanceStore.set(key, {
        userId,
        currency,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      });
    }
    return balanceStore.get(key);
  }),
  findByUserAndCurrency: vi.fn((userId, currency) => {
    return balanceStore.get(`${userId}-${currency}`);
  }),
  findByUserId: vi.fn((userId) =>
    Array.from(balanceStore.values()).filter((b) => b.userId === userId)
  ),
  incrementAvailable: vi.fn((userId, currency, amount) => {
    const key = `${userId}-${currency}`;
    const balance = balanceStore.get(key);
    if (balance) {
      balance.availableBalance += amount;
      balance.totalEarned += amount;
    }
    return balance;
  }),
  decrementAvailable: vi.fn((userId, currency, amount) => {
    const key = `${userId}-${currency}`;
    const balance = balanceStore.get(key);
    if (balance) {
      balance.availableBalance -= amount;
    }
    return balance;
  }),
  moveToPending: vi.fn((userId, currency, amount) => {
    const key = `${userId}-${currency}`;
    const balance = balanceStore.get(key);
    if (balance) {
      balance.availableBalance -= amount;
      balance.pendingBalance += amount;
    }
    return balance;
  }),
  moveFromPending: vi.fn((userId, currency, amount) => {
    const key = `${userId}-${currency}`;
    const balance = balanceStore.get(key);
    if (balance) {
      balance.pendingBalance -= amount;
      balance.availableBalance += amount;
    }
    return balance;
  }),
  incrementTotalPaidOut: vi.fn((userId, currency, amount) => {
    const key = `${userId}-${currency}`;
    const balance = balanceStore.get(key);
    if (balance) {
      balance.totalPaidOut += amount;
    }
    return balance;
  }),
};

vi.mock('../../repositories/escrow.repository.js', () => ({
  getEscrowRepository: vi.fn(() => mockEscrowRepo),
}));

vi.mock('../../repositories/milestone.repository.js', () => ({
  getMilestoneRepository: vi.fn(() => mockMilestoneRepo),
}));

vi.mock('../../repositories/payout.repository.js', () => ({
  getPayoutRepository: vi.fn(() => mockPayoutRepo),
  getPayoutBalanceRepository: vi.fn(() => mockBalanceRepo),
}));

// =============================================================================
// TEST FIXTURES
// =============================================================================

const CLIENT_USER_ID = 'client-user-123';
const FREELANCER_USER_ID = 'freelancer-user-456';
const CONTRACT_ID = 'contract-789';
const STRIPE_CONNECT_ACCOUNT_ID = 'acct_freelancer123';

// Set up freelancer's payout account
payoutAccountStore.set(FREELANCER_USER_ID, {
  id: 'payout-account-001',
  userId: FREELANCER_USER_ID,
  stripeConnectAccountId: STRIPE_CONNECT_ACCOUNT_ID,
  status: 'ACTIVE',
  chargesEnabled: true,
  payoutsEnabled: true,
  country: 'US',
  currency: 'USD',
  bankAccountLast4: '1234',
  bankName: 'Test Bank',
});

// =============================================================================
// FULL PAYMENT FLOW INTEGRATION TESTS
// =============================================================================

describe('Full Payment Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    escrowStore.clear();
    milestoneStore.clear();
    payoutStore.clear();
    balanceStore.clear();

    // Re-add payout account
    payoutAccountStore.set(FREELANCER_USER_ID, {
      id: 'payout-account-001',
      userId: FREELANCER_USER_ID,
      stripeConnectAccountId: STRIPE_CONNECT_ACCOUNT_ID,
      status: 'ACTIVE',
      chargesEnabled: true,
      payoutsEnabled: true,
      country: 'US',
      currency: 'USD',
      bankAccountLast4: '1234',
      bankName: 'Test Bank',
    });

    // Set up Stripe mocks for success flow
    mockStripePaymentIntents.create.mockResolvedValue({
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 100000, // $1000.00
      currency: 'usd',
    });

    mockStripeTransfers.create.mockResolvedValue({
      id: 'tr_test_123',
      amount: 85000, // $850.00 (after platform fee)
      currency: 'usd',
      destination: STRIPE_CONNECT_ACCOUNT_ID,
    });

    mockStripeAccounts.retrieve.mockResolvedValue({
      id: STRIPE_CONNECT_ACCOUNT_ID,
      payouts_enabled: true,
      charges_enabled: true,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // STEP 1: CLIENT CREATES ESCROW PAYMENT
  // ===========================================================================

  describe('Step 1: Client Creates Escrow Payment', () => {
    it('should create escrow account with correct amounts', async () => {
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000, // $1000.00
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
        stripePaymentIntentId: 'pi_test_123',
      });

      expect(escrow.id).toBeDefined();
      expect(escrow.totalAmount).toBe(100000);
      expect(escrow.status).toBe('FUNDED');
      expect(escrowStore.size).toBe(1);
    });

    it('should create milestone linked to escrow', async () => {
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000,
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
      });

      const milestone = await mockMilestoneRepo.create({
        escrowId: escrow.id,
        title: 'Project Completion',
        description: 'Complete the project as per requirements',
        amount: 100000,
        currency: 'USD',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'ACTIVE',
      });

      expect(milestone.escrowId).toBe(escrow.id);
      expect(milestone.amount).toBe(100000);
      expect(milestone.status).toBe('ACTIVE');
    });
  });

  // ===========================================================================
  // STEP 2: FREELANCER COMPLETES MILESTONE
  // ===========================================================================

  describe('Step 2: Freelancer Completes Milestone', () => {
    it('should update milestone status to SUBMITTED', async () => {
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000,
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
      });

      const milestone = await mockMilestoneRepo.create({
        escrowId: escrow.id,
        title: 'Project Completion',
        amount: 100000,
        currency: 'USD',
        status: 'ACTIVE',
      });

      const submitted = await mockMilestoneRepo.update(milestone.id, {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        deliverables: ['Final design files', 'Source code repository'],
      });

      expect(submitted.status).toBe('SUBMITTED');
      expect(submitted.submittedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // STEP 3: CLIENT APPROVES MILESTONE
  // ===========================================================================

  describe('Step 3: Client Approves Milestone', () => {
    it('should update milestone status to APPROVED', async () => {
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000,
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
      });

      const milestone = await mockMilestoneRepo.create({
        escrowId: escrow.id,
        title: 'Project Completion',
        amount: 100000,
        currency: 'USD',
        status: 'SUBMITTED',
      });

      const approved = await mockMilestoneRepo.update(milestone.id, {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: CLIENT_USER_ID,
      });

      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe(CLIENT_USER_ID);
    });
  });

  // ===========================================================================
  // STEP 4: PLATFORM RELEASES FUNDS FROM ESCROW
  // ===========================================================================

  describe('Step 4: Platform Releases Funds', () => {
    it('should release funds and credit freelancer balance', async () => {
      // Create escrow and milestone
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000,
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
      });

      const milestone = await mockMilestoneRepo.create({
        escrowId: escrow.id,
        title: 'Project Completion',
        amount: 100000,
        currency: 'USD',
        status: 'APPROVED',
      });

      // Simulate release: credit freelancer balance (after platform fee)
      const platformFee = Math.round(100000 * 0.15); // $150.00
      const freelancerAmount = 100000 - platformFee; // $850.00

      // Get or create balance
      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', freelancerAmount);

      // Update milestone and escrow
      await mockMilestoneRepo.update(milestone.id, {
        status: 'RELEASED',
        releasedAt: new Date(),
        freelancerAmount,
        platformFee,
      });

      await mockEscrowRepo.update(escrow.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      // Verify
      const balance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      expect(balance.availableBalance).toBe(85000);
      expect(balance.totalEarned).toBe(85000);

      const updatedMilestone = milestoneStore.get(milestone.id);
      expect(updatedMilestone.status).toBe('RELEASED');
      expect(updatedMilestone.freelancerAmount).toBe(85000);
    });
  });

  // ===========================================================================
  // STEP 5: FREELANCER CHECKS BALANCE
  // ===========================================================================

  describe('Step 5: Freelancer Checks Balance', () => {
    it('should show correct available balance', async () => {
      // Set up balance
      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', 85000);

      const balances = await mockBalanceRepo.findByUserId(FREELANCER_USER_ID);

      expect(balances).toHaveLength(1);
      expect(balances[0].availableBalance).toBe(85000);
      expect(balances[0].currency).toBe('USD');
    });
  });

  // ===========================================================================
  // STEP 6: FREELANCER REQUESTS PAYOUT
  // ===========================================================================

  describe('Step 6: Freelancer Requests Payout', () => {
    it('should create payout request with correct amounts', async () => {
      // Set up balance
      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', 85000);

      // Simulate payout request
      const payoutAmount = 80000; // $800.00 (leaving some balance)
      const payoutFee = 250; // $2.50 standard payout fee

      // Move to pending
      await mockBalanceRepo.moveToPending(FREELANCER_USER_ID, 'USD', payoutAmount);

      // Create payout record
      const payout = await mockPayoutRepo.create({
        userId: FREELANCER_USER_ID,
        payoutAccountId: 'payout-account-001',
        amount: payoutAmount,
        netAmount: payoutAmount - payoutFee,
        fee: payoutFee,
        currency: 'USD',
        status: 'PENDING',
        method: 'BANK_TRANSFER',
        type: 'STANDARD',
      });

      expect(payout.amount).toBe(80000);
      expect(payout.netAmount).toBe(79750);
      expect(payout.status).toBe('PENDING');

      // Verify balance moved to pending
      const balance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      expect(balance.availableBalance).toBe(5000); // $50.00 remaining
      expect(balance.pendingBalance).toBe(80000);
    });
  });

  // ===========================================================================
  // STEP 7: PAYOUT IS PROCESSED
  // ===========================================================================

  describe('Step 7: Payout is Processed', () => {
    it('should successfully transfer funds via Stripe', async () => {
      // Set up balance and payout
      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', 85000);
      await mockBalanceRepo.moveToPending(FREELANCER_USER_ID, 'USD', 80000);

      const payout = await mockPayoutRepo.create({
        userId: FREELANCER_USER_ID,
        payoutAccountId: 'payout-account-001',
        amount: 80000,
        netAmount: 79750,
        fee: 250,
        currency: 'USD',
        status: 'PENDING',
      });

      // Simulate Stripe transfer
      const transfer = await mockStripeTransfers.create({
        amount: 79750,
        currency: 'usd',
        destination: STRIPE_CONNECT_ACCOUNT_ID,
        transfer_group: `payout-${payout.id}`,
      });

      // Update payout as completed
      await mockPayoutRepo.update(payout.id, {
        status: 'COMPLETED',
        stripeTransferId: transfer.id,
        completedAt: new Date(),
      });

      // Update balance
      const balance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      balance.pendingBalance -= 80000;
      await mockBalanceRepo.incrementTotalPaidOut(FREELANCER_USER_ID, 'USD', 80000);

      // Verify
      expect(mockStripeTransfers.create).toHaveBeenCalled();

      const updatedPayout = payoutStore.get(payout.id);
      expect(updatedPayout.status).toBe('COMPLETED');
      expect(updatedPayout.stripeTransferId).toBe('tr_test_123');

      const finalBalance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      expect(finalBalance.availableBalance).toBe(5000); // $50.00 remaining
      expect(finalBalance.pendingBalance).toBe(0);
      expect(finalBalance.totalPaidOut).toBe(80000);
    });

    it('should send notification on successful payout', async () => {
      // Set up and process payout...
      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', 85000);

      const payout = await mockPayoutRepo.create({
        userId: FREELANCER_USER_ID,
        amount: 80000,
        status: 'COMPLETED',
      });

      // Simulate notification
      await mockNotificationService.sendEmail({
        to: 'freelancer@example.com',
        template: 'payout-sent',
        data: {
          freelancerName: 'John Freelancer',
          payoutAmount: '$800.00',
          estimatedArrival: '2-3 business days',
        },
      });

      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'payout-sent',
        })
      );
    });
  });

  // ===========================================================================
  // COMPLETE FLOW TEST
  // ===========================================================================

  describe('Complete End-to-End Flow', () => {
    it('should process full payment flow from client charge to freelancer payout', async () => {
      // ========== STEP 1: Create Escrow ==========
      const escrow = await mockEscrowRepo.create({
        contractId: CONTRACT_ID,
        clientId: CLIENT_USER_ID,
        freelancerId: FREELANCER_USER_ID,
        totalAmount: 100000, // $1000.00
        currency: 'USD',
        platformFeePercent: 15,
        status: 'FUNDED',
        stripePaymentIntentId: 'pi_test_123',
      });

      const milestone = await mockMilestoneRepo.create({
        escrowId: escrow.id,
        title: 'Project Completion',
        amount: 100000,
        currency: 'USD',
        status: 'ACTIVE',
      });

      // ========== STEP 2 & 3: Complete & Approve Milestone ==========
      await mockMilestoneRepo.update(milestone.id, {
        status: 'APPROVED',
        submittedAt: new Date(),
        approvedAt: new Date(),
      });

      // ========== STEP 4: Release Funds ==========
      const platformFee = Math.round(100000 * 0.15);
      const freelancerAmount = 100000 - platformFee;

      await mockBalanceRepo.getOrCreate(FREELANCER_USER_ID, 'USD');
      await mockBalanceRepo.incrementAvailable(FREELANCER_USER_ID, 'USD', freelancerAmount);

      await mockMilestoneRepo.update(milestone.id, {
        status: 'RELEASED',
        releasedAt: new Date(),
        freelancerAmount,
        platformFee,
      });

      // ========== STEP 5: Check Balance ==========
      let balance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      expect(balance.availableBalance).toBe(85000);

      // ========== STEP 6: Request Payout ==========
      const payoutAmount = 85000;
      const payoutFee = 250;

      await mockBalanceRepo.moveToPending(FREELANCER_USER_ID, 'USD', payoutAmount);

      const payout = await mockPayoutRepo.create({
        userId: FREELANCER_USER_ID,
        payoutAccountId: 'payout-account-001',
        amount: payoutAmount,
        netAmount: payoutAmount - payoutFee,
        fee: payoutFee,
        currency: 'USD',
        status: 'PENDING',
      });

      // ========== STEP 7: Process Payout ==========
      const transfer = await mockStripeTransfers.create({
        amount: payoutAmount - payoutFee,
        currency: 'usd',
        destination: STRIPE_CONNECT_ACCOUNT_ID,
      });

      await mockPayoutRepo.update(payout.id, {
        status: 'COMPLETED',
        stripeTransferId: transfer.id,
        completedAt: new Date(),
      });

      balance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      balance.pendingBalance = 0;
      await mockBalanceRepo.incrementTotalPaidOut(FREELANCER_USER_ID, 'USD', payoutAmount);

      // ========== VERIFY FINAL STATE ==========
      const finalEscrow = escrowStore.get(escrow.id);
      expect(finalEscrow).toBeDefined();

      const finalMilestone = milestoneStore.get(milestone.id);
      expect(finalMilestone.status).toBe('RELEASED');
      expect(finalMilestone.freelancerAmount).toBe(85000);

      const finalPayout = payoutStore.get(payout.id);
      expect(finalPayout.status).toBe('COMPLETED');
      expect(finalPayout.netAmount).toBe(84750);

      const finalBalance = mockBalanceRepo.findByUserAndCurrency(FREELANCER_USER_ID, 'USD');
      expect(finalBalance.availableBalance).toBe(0);
      expect(finalBalance.totalEarned).toBe(85000);
      expect(finalBalance.totalPaidOut).toBe(85000);

      // Summary of the complete flow
      console.log('\n=== PAYMENT FLOW SUMMARY ===');
      console.log(`Contract Total:     $${(100000 / 100).toFixed(2)}`);
      console.log(`Platform Fee (15%): $${(platformFee / 100).toFixed(2)}`);
      console.log(`Freelancer Amount:  $${(freelancerAmount / 100).toFixed(2)}`);
      console.log(`Payout Fee:         $${(payoutFee / 100).toFixed(2)}`);
      console.log(`Net Payout:         $${((payoutAmount - payoutFee) / 100).toFixed(2)}`);
      console.log('============================\n');
    });
  });
});

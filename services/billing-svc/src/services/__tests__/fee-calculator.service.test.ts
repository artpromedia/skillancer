/**
 * @module @skillancer/billing-svc/services/__tests__/fee-calculator
 * Unit tests for the fee calculator service
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { FeeCalculatorService } from '../fee-calculator.service.js';

describe('FeeCalculatorService', () => {
  let service: FeeCalculatorService;

  beforeEach(() => {
    service = new FeeCalculatorService();
  });

  // ===========================================================================
  // calculateEscrowFees
  // ===========================================================================

  describe('calculateEscrowFees', () => {
    it('should calculate fees for standard escrow funding', () => {
      const result = service.calculateEscrowFees({
        amount: 1000,
      });

      // Platform fee: 10% of 1000 = 100
      expect(result.platformFee).toBe(100);
      expect(result.platformFeePercent).toBe(10);
      // No secure mode
      expect(result.secureModeAmount).toBe(0);
      // Stripe fee: 2.9% of 1100 + 0.30 = 32.19
      expect(result.processingFee).toBeCloseTo(32.19, 2);
      // Gross amount is the original
      expect(result.grossAmount).toBe(1000);
      // Net amount should equal gross (held in escrow)
      expect(result.netAmount).toBe(1000);
      // Total charge to client
      expect(result.totalCharge).toBeCloseTo(1132.19, 2);
    });

    it('should calculate fees with secure mode enabled', () => {
      const result = service.calculateEscrowFees({
        amount: 1000,
        secureMode: true,
      });

      // Platform fee: 10% of 1000 = 100
      expect(result.platformFee).toBe(100);
      // Secure mode fee: 5% of 1000 = 50
      expect(result.secureModeAmount).toBe(50);
      // Stripe fee: 2.9% of 1150 + 0.30 = 33.65
      expect(result.processingFee).toBeCloseTo(33.65, 2);
      // Total charge should include all fees
      expect(result.totalCharge).toBeCloseTo(1183.65, 2);
    });

    it('should calculate fees with custom platform fee', () => {
      const result = service.calculateEscrowFees({
        amount: 1000,
        platformFeePercent: 15,
      });

      // Platform fee: 15% of 1000 = 150
      expect(result.platformFee).toBe(150);
      expect(result.platformFeePercent).toBe(15);
    });

    it('should handle large amounts correctly', () => {
      const result = service.calculateEscrowFees({
        amount: 100000,
      });

      // Platform fee: 10% of 100000 = 10000
      expect(result.platformFee).toBe(10000);
      // Stripe fee: 2.9% of 110000 + 0.30 = 3190.30
      expect(result.processingFee).toBeCloseTo(3190.3, 2);
    });

    it('should handle small amounts correctly', () => {
      const result = service.calculateEscrowFees({
        amount: 10,
      });

      // Platform fee: 10% of 10 = 1
      expect(result.platformFee).toBe(1);
      // Stripe fee: 2.9% of 11 + 0.30 = 0.619
      expect(result.processingFee).toBeCloseTo(0.62, 2);
    });
  });

  // ===========================================================================
  // calculateReleaseFees
  // ===========================================================================

  describe('calculateReleaseFees', () => {
    it('should calculate release fees correctly', () => {
      const result = service.calculateReleaseFees({
        amount: 1000,
      });

      // Platform fee: 10% of 1000 = 100
      expect(result.platformFee).toBe(100);
      // No processing fee on release
      expect(result.processingFee).toBe(0);
      // Net to freelancer: 1000 - 100 = 900
      expect(result.netAmount).toBe(900);
      // Total charge equals amount (no additional fees)
      expect(result.totalCharge).toBe(1000);
    });

    it('should calculate release fees with secure mode', () => {
      const result = service.calculateReleaseFees({
        amount: 1000,
        secureMode: true,
      });

      // Platform fee: 10% of 1000 = 100
      expect(result.platformFee).toBe(100);
      // Secure mode fee: 5% of 1000 = 50
      expect(result.secureModeAmount).toBe(50);
      // Net to freelancer: 1000 - 100 - 50 = 850
      expect(result.netAmount).toBe(850);
    });

    it('should calculate release fees with custom platform fee', () => {
      const result = service.calculateReleaseFees({
        amount: 1000,
        platformFeePercent: 8,
      });

      // Platform fee: 8% of 1000 = 80
      expect(result.platformFee).toBe(80);
      expect(result.platformFeePercent).toBe(8);
      // Net to freelancer: 1000 - 80 = 920
      expect(result.netAmount).toBe(920);
    });
  });

  // ===========================================================================
  // calculateTimeLogBilling
  // ===========================================================================

  describe('calculateTimeLogBilling', () => {
    it('should calculate hourly billing from minutes', () => {
      const result = service.calculateTimeLogBilling({
        durationMinutes: 120, // 2 hours
        hourlyRate: 100,
      });

      // Gross: 2 * 100 = 200
      expect(result.grossAmount).toBe(200);
      // Platform fee: 10% of 200 = 20
      expect(result.platformFee).toBe(20);
      // Net: 200 - 20 = 180
      expect(result.netAmount).toBe(180);
    });

    it('should handle fractional hours', () => {
      const result = service.calculateTimeLogBilling({
        durationMinutes: 90, // 1.5 hours
        hourlyRate: 100,
      });

      // Gross: 1.5 * 100 = 150
      expect(result.grossAmount).toBe(150);
      // Platform fee: 10% of 150 = 15
      expect(result.platformFee).toBe(15);
      // Net: 150 - 15 = 135
      expect(result.netAmount).toBe(135);
    });

    it('should use custom platform fee', () => {
      const result = service.calculateTimeLogBilling({
        durationMinutes: 60,
        hourlyRate: 100,
        platformFeePercent: 5,
      });

      // Gross: 1 * 100 = 100
      expect(result.grossAmount).toBe(100);
      // Platform fee: 5% of 100 = 5
      expect(result.platformFee).toBe(5);
      // Net: 100 - 5 = 95
      expect(result.netAmount).toBe(95);
    });
  });

  // ===========================================================================
  // calculateDisputeSplit
  // ===========================================================================

  describe('calculateDisputeSplit', () => {
    it('should calculate 50/50 split correctly', () => {
      const result = service.calculateDisputeSplit({
        totalAmount: 1000,
        clientPercent: 50,
      });

      // Client refund: 50% of 1000 = 500
      expect(result.clientRefund).toBe(500);
      // Freelancer gross: 1000 - 500 = 500
      // Platform fee: 10% of 500 = 50
      expect(result.platformFee).toBe(50);
      // Freelancer payout: 500 - 50 = 450
      expect(result.freelancerPayout).toBe(450);
    });

    it('should calculate full client refund', () => {
      const result = service.calculateDisputeSplit({
        totalAmount: 1000,
        clientPercent: 100,
      });

      // Client refund: 100% of 1000 = 1000
      expect(result.clientRefund).toBe(1000);
      // Freelancer gets nothing
      expect(result.freelancerPayout).toBe(0);
      // No platform fee since freelancer gets nothing
      expect(result.platformFee).toBe(0);
    });

    it('should calculate full freelancer release', () => {
      const result = service.calculateDisputeSplit({
        totalAmount: 1000,
        clientPercent: 0,
      });

      // Client refund: 0
      expect(result.clientRefund).toBe(0);
      // Freelancer gross: 1000
      // Platform fee: 10% of 1000 = 100
      expect(result.platformFee).toBe(100);
      // Freelancer payout: 1000 - 100 = 900
      expect(result.freelancerPayout).toBe(900);
    });

    it('should use custom platform fee', () => {
      const result = service.calculateDisputeSplit({
        totalAmount: 1000,
        clientPercent: 50,
        platformFeePercent: 5,
      });

      // Client refund: 50% of 1000 = 500
      expect(result.clientRefund).toBe(500);
      // Platform fee: 5% of 500 = 25
      expect(result.platformFee).toBe(25);
      // Freelancer payout: 500 - 25 = 475
      expect(result.freelancerPayout).toBe(475);
    });
  });

  // ===========================================================================
  // getFeesPreview
  // ===========================================================================

  describe('getFeesPreview', () => {
    it('should return fee breakdown', () => {
      const result = service.getFeesPreview({
        amount: 1000,
      });

      // Should have breakdown array
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.breakdown.length).toBeGreaterThan(0);

      // Should have standard fee properties
      expect(result.grossAmount).toBe(1000);
      expect(result.platformFee).toBe(100);
    });

    it('should include secure mode in breakdown when enabled', () => {
      const result = service.getFeesPreview({
        amount: 1000,
        secureMode: true,
      });

      // Should have secure mode fee in breakdown
      const secureModeItem = result.breakdown.find((item) =>
        item.label.toLowerCase().includes('secure')
      );
      expect(secureModeItem).toBeDefined();
      expect(secureModeItem?.amount).toBe(50);
    });
  });

  // ===========================================================================
  // calculateHourlyBilling
  // ===========================================================================

  describe('calculateHourlyBilling', () => {
    it('should calculate hourly billing correctly', () => {
      const result = service.calculateHourlyBilling({
        hours: 8,
        hourlyRate: 50,
      });

      // Gross: 8 * 50 = 400
      expect(result.grossAmount).toBe(400);
      // Platform fee: 10% of 400 = 40
      expect(result.platformFee).toBe(40);
      // Net: 400 - 40 = 360
      expect(result.netAmount).toBe(360);
    });
  });

  // ===========================================================================
  // validateRefundAmount
  // ===========================================================================

  describe('validateRefundAmount', () => {
    it('should validate valid refund amount', () => {
      const result = service.validateRefundAmount({
        requestedAmount: 500,
        availableBalance: 1000,
        frozenAmount: 0,
      });

      expect(result.valid).toBe(true);
      expect(result.maxRefundable).toBe(1000);
      expect(result.error).toBeUndefined();
    });

    it('should reject negative refund amount', () => {
      const result = service.validateRefundAmount({
        requestedAmount: -100,
        availableBalance: 1000,
        frozenAmount: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Refund amount must be positive');
    });

    it('should reject refund exceeding available balance', () => {
      const result = service.validateRefundAmount({
        requestedAmount: 800,
        availableBalance: 1000,
        frozenAmount: 500,
      });

      expect(result.valid).toBe(false);
      expect(result.maxRefundable).toBe(500);
      expect(result.error).toContain('Insufficient available balance');
    });

    it('should account for frozen amount', () => {
      const result = service.validateRefundAmount({
        requestedAmount: 500,
        availableBalance: 1000,
        frozenAmount: 500,
      });

      expect(result.valid).toBe(true);
      expect(result.maxRefundable).toBe(500);
    });
  });

  // ===========================================================================
  // calculateRequiredFunding
  // ===========================================================================

  describe('calculateRequiredFunding', () => {
    it('should calculate funding needed for desired net amount', () => {
      // If we want freelancer to receive $900 net
      // With 10% platform fee, gross = 900 / 0.9 = 1000
      const result = service.calculateRequiredFunding({
        desiredNetAmount: 900,
      });

      expect(result.grossAmount).toBe(1000);
      expect(result.netAmount).toBe(1000); // Held in escrow
      expect(result.platformFee).toBe(100);
    });

    it('should account for secure mode in required funding', () => {
      // With 10% platform + 5% secure mode = 15% total
      // For $850 net, gross = 850 / 0.85 = 1000
      const result = service.calculateRequiredFunding({
        desiredNetAmount: 850,
        secureMode: true,
      });

      expect(result.grossAmount).toBe(1000);
      expect(result.platformFee).toBe(100);
      expect(result.secureModeAmount).toBe(50);
    });
  });
});

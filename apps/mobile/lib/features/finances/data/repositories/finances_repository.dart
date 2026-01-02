/// Finances Data Repository
/// Sprint M5: Freelancer Financial Services
library;

import 'package:dio/dio.dart';
import '../../domain/models/finance_models.dart';

/// Repository for treasury, cards, and tax vault operations
class FinancesRepository {
  final Dio _dio;

  FinancesRepository({required Dio dio}) : _dio = dio;

  // ============================================================================
  // TREASURY & BALANCE
  // ============================================================================

  /// Get treasury balance
  Future<TreasuryBalance> getBalance() async {
    final response = await _dio.get('/api/treasury/balance');
    return TreasuryBalance.fromJson(response.data);
  }

  /// Get payout eligibility and options
  Future<Map<String, dynamic>> getPayoutOptions() async {
    final response = await _dio.get('/api/treasury/payout/options');
    return response.data as Map<String, dynamic>;
  }

  /// Request a payout
  Future<Payout> requestPayout({
    required double amount,
    required PayoutSpeed speed,
    required PayoutDestination destination,
    required String destinationId,
  }) async {
    final response = await _dio.post('/api/treasury/payout', data: {
      'amount': amount,
      'speed': speed.name,
      'destination': destination.name,
      'destinationId': destinationId,
    });
    return Payout.fromJson(response.data);
  }

  /// Get payout history
  Future<List<Payout>> getPayouts({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get('/api/treasury/payouts', queryParameters: {
      'page': page,
      'limit': limit,
    });
    final List<dynamic> data = response.data['payouts'];
    return data.map((json) => Payout.fromJson(json)).toList();
  }

  /// Get a specific payout
  Future<Payout> getPayout(String payoutId) async {
    final response = await _dio.get('/api/treasury/payouts/$payoutId');
    return Payout.fromJson(response.data);
  }

  // ============================================================================
  // CARDS
  // ============================================================================

  /// Get all user cards
  Future<List<SkillancerCard>> getCards() async {
    final response = await _dio.get('/api/cards');
    final List<dynamic> data = response.data['cards'];
    return data.map((json) => SkillancerCard.fromJson(json)).toList();
  }

  /// Get card details
  Future<SkillancerCard> getCard(String cardId) async {
    final response = await _dio.get('/api/cards/$cardId');
    return SkillancerCard.fromJson(response.data);
  }

  /// Request a virtual card
  Future<SkillancerCard> requestVirtualCard() async {
    final response = await _dio.post('/api/cards/virtual');
    return SkillancerCard.fromJson(response.data);
  }

  /// Request a physical card
  Future<SkillancerCard> requestPhysicalCard({
    required Map<String, dynamic> shippingAddress,
  }) async {
    final response = await _dio.post('/api/cards/physical', data: {
      'shippingAddress': shippingAddress,
    });
    return SkillancerCard.fromJson(response.data);
  }

  /// Freeze a card
  Future<SkillancerCard> freezeCard(String cardId) async {
    final response = await _dio.post('/api/cards/$cardId/freeze');
    return SkillancerCard.fromJson(response.data);
  }

  /// Unfreeze a card
  Future<SkillancerCard> unfreezeCard(String cardId) async {
    final response = await _dio.post('/api/cards/$cardId/unfreeze');
    return SkillancerCard.fromJson(response.data);
  }

  /// Update spending limits
  Future<SkillancerCard> updateSpendingLimits(
    String cardId,
    SpendingLimits limits,
  ) async {
    final response = await _dio.patch(
      '/api/cards/$cardId/limits',
      data: limits.toJson(),
    );
    return SkillancerCard.fromJson(response.data);
  }

  /// Get card transactions
  Future<List<CardTransaction>> getCardTransactions(
    String cardId, {
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _dio.get(
      '/api/cards/$cardId/transactions',
      queryParameters: {'page': page, 'limit': limit},
    );
    final List<dynamic> data = response.data['transactions'];
    return data.map((json) => CardTransaction.fromJson(json)).toList();
  }

  /// Get sensitive card details (requires authentication)
  Future<Map<String, String>> getCardSensitiveDetails(String cardId) async {
    final response = await _dio.get('/api/cards/$cardId/sensitive');
    return Map<String, String>.from(response.data);
  }

  /// Enable digital wallet
  Future<Map<String, dynamic>> enableDigitalWallet(
    String cardId,
    String walletType,
  ) async {
    final response = await _dio.post(
      '/api/cards/$cardId/wallet',
      data: {'walletType': walletType},
    );
    return response.data as Map<String, dynamic>;
  }

  // ============================================================================
  // TAX VAULT
  // ============================================================================

  /// Get tax vault summary
  Future<TaxVaultSummary> getTaxVaultSummary() async {
    final response = await _dio.get('/api/tax/vault');
    return TaxVaultSummary.fromJson(response.data);
  }

  /// Update tax vault settings
  Future<TaxVaultSettings> updateTaxVaultSettings(
    TaxVaultSettings settings,
  ) async {
    final response = await _dio.patch(
      '/api/tax/vault/settings',
      data: settings.toJson(),
    );
    return TaxVaultSettings.fromJson(response.data);
  }

  /// Manual deposit to tax vault
  Future<void> depositToTaxVault(double amount) async {
    await _dio.post('/api/tax/vault/deposit', data: {'amount': amount});
  }

  /// Withdraw from tax vault
  Future<void> withdrawFromTaxVault(double amount) async {
    await _dio.post('/api/tax/vault/withdraw', data: {'amount': amount});
  }

  /// Get tax estimate
  Future<TaxEstimate> getTaxEstimate() async {
    final response = await _dio.get('/api/tax/estimate');
    return TaxEstimate.fromJson(response.data);
  }

  /// Get quarterly payment status
  Future<List<QuarterlyPaymentStatus>> getQuarterlyPayments({
    int? year,
  }) async {
    final response = await _dio.get('/api/tax/quarterly', queryParameters: {
      if (year != null) 'year': year,
    });
    final List<dynamic> data = response.data['payments'];
    return data.map((json) => QuarterlyPaymentStatus.fromJson(json)).toList();
  }

  /// Record a quarterly tax payment
  Future<void> recordQuarterlyPayment({
    required int quarter,
    required int year,
    required double amount,
    required String paymentMethod,
  }) async {
    await _dio.post('/api/tax/quarterly/payment', data: {
      'quarter': quarter,
      'year': year,
      'amount': amount,
      'paymentMethod': paymentMethod,
    });
  }
}

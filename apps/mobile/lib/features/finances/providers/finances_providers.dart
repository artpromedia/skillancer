/// Finances Providers
/// Sprint M5: Freelancer Financial Services
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../data/repositories/finances_repository.dart';
import '../domain/models/finance_models.dart';

// ============================================================================
// DIO PROVIDER (should be defined in core, using local for now)
// ============================================================================

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(
    baseUrl: const String.fromEnvironment(
      'API_URL',
      defaultValue: 'http://localhost:3001',
    ),
  ));
});

// ============================================================================
// REPOSITORY PROVIDER
// ============================================================================

final financesRepositoryProvider = Provider<FinancesRepository>((ref) {
  return FinancesRepository(dio: ref.read(dioProvider));
});

// ============================================================================
// BALANCE PROVIDERS
// ============================================================================

/// Treasury balance provider
final balanceProvider = FutureProvider<TreasuryBalance>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getBalance();
});

/// Refresh balance
final balanceRefreshProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    ref.invalidate(balanceProvider);
  };
});

// ============================================================================
// PAYOUT PROVIDERS
// ============================================================================

/// Payout options provider
final payoutOptionsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getPayoutOptions();
});

/// Payouts history provider
final payoutsProvider =
    FutureProvider.family<List<Payout>, int>((ref, page) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getPayouts(page: page);
});

/// Request payout state
class PayoutRequestState {
  final bool isLoading;
  final Payout? payout;
  final String? error;

  const PayoutRequestState({
    this.isLoading = false,
    this.payout,
    this.error,
  });

  PayoutRequestState copyWith({
    bool? isLoading,
    Payout? payout,
    String? error,
  }) {
    return PayoutRequestState(
      isLoading: isLoading ?? this.isLoading,
      payout: payout ?? this.payout,
      error: error,
    );
  }
}

/// Payout request notifier
class PayoutRequestNotifier extends StateNotifier<PayoutRequestState> {
  final FinancesRepository _repo;
  final Ref _ref;

  PayoutRequestNotifier(this._repo, this._ref)
      : super(const PayoutRequestState());

  Future<bool> requestPayout({
    required double amount,
    required PayoutSpeed speed,
    required PayoutDestination destination,
    required String destinationId,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final payout = await _repo.requestPayout(
        amount: amount,
        speed: speed,
        destination: destination,
        destinationId: destinationId,
      );

      state = state.copyWith(isLoading: false, payout: payout);

      // Refresh balance after successful payout
      _ref.invalidate(balanceProvider);

      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  void reset() {
    state = const PayoutRequestState();
  }
}

final payoutRequestProvider =
    StateNotifierProvider<PayoutRequestNotifier, PayoutRequestState>((ref) {
  return PayoutRequestNotifier(
    ref.read(financesRepositoryProvider),
    ref,
  );
});

// ============================================================================
// CARD PROVIDERS
// ============================================================================

/// All cards provider
final cardsProvider = FutureProvider<List<SkillancerCard>>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getCards();
});

/// Single card provider
final cardProvider =
    FutureProvider.family<SkillancerCard, String>((ref, cardId) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getCard(cardId);
});

/// Card transactions provider
final cardTransactionsProvider =
    FutureProvider.family<List<CardTransaction>, String>((ref, cardId) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getCardTransactions(cardId);
});

/// Card actions notifier
class CardActionsNotifier extends StateNotifier<AsyncValue<SkillancerCard?>> {
  final FinancesRepository _repo;
  final Ref _ref;

  CardActionsNotifier(this._repo, this._ref)
      : super(const AsyncValue.data(null));

  Future<bool> freezeCard(String cardId) async {
    state = const AsyncValue.loading();
    try {
      final card = await _repo.freezeCard(cardId);
      state = AsyncValue.data(card);
      _ref.invalidate(cardsProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> unfreezeCard(String cardId) async {
    state = const AsyncValue.loading();
    try {
      final card = await _repo.unfreezeCard(cardId);
      state = AsyncValue.data(card);
      _ref.invalidate(cardsProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> requestVirtualCard() async {
    state = const AsyncValue.loading();
    try {
      final card = await _repo.requestVirtualCard();
      state = AsyncValue.data(card);
      _ref.invalidate(cardsProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final cardActionsProvider =
    StateNotifierProvider<CardActionsNotifier, AsyncValue<SkillancerCard?>>(
        (ref) {
  return CardActionsNotifier(
    ref.read(financesRepositoryProvider),
    ref,
  );
});

// ============================================================================
// TAX VAULT PROVIDERS
// ============================================================================

/// Tax vault summary provider
final taxVaultProvider = FutureProvider<TaxVaultSummary>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getTaxVaultSummary();
});

/// Tax estimate provider
final taxEstimateProvider = FutureProvider<TaxEstimate>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getTaxEstimate();
});

/// Quarterly payments provider
final quarterlyPaymentsProvider =
    FutureProvider<List<QuarterlyPaymentStatus>>((ref) async {
  final repo = ref.read(financesRepositoryProvider);
  return repo.getQuarterlyPayments();
});

/// Tax vault actions notifier
class TaxVaultActionsNotifier extends StateNotifier<AsyncValue<void>> {
  final FinancesRepository _repo;
  final Ref _ref;

  TaxVaultActionsNotifier(this._repo, this._ref)
      : super(const AsyncValue.data(null));

  Future<bool> updateSettings(TaxVaultSettings settings) async {
    state = const AsyncValue.loading();
    try {
      await _repo.updateTaxVaultSettings(settings);
      state = const AsyncValue.data(null);
      _ref.invalidate(taxVaultProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deposit(double amount) async {
    state = const AsyncValue.loading();
    try {
      await _repo.depositToTaxVault(amount);
      state = const AsyncValue.data(null);
      _ref.invalidate(taxVaultProvider);
      _ref.invalidate(balanceProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> withdraw(double amount) async {
    state = const AsyncValue.loading();
    try {
      await _repo.withdrawFromTaxVault(amount);
      state = const AsyncValue.data(null);
      _ref.invalidate(taxVaultProvider);
      _ref.invalidate(balanceProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final taxVaultActionsProvider =
    StateNotifierProvider<TaxVaultActionsNotifier, AsyncValue<void>>((ref) {
  return TaxVaultActionsNotifier(
    ref.read(financesRepositoryProvider),
    ref,
  );
});

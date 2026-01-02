import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers/providers.dart';
import '../../data/repositories/executive_repository.dart';
import '../../domain/models/engagement.dart';
import '../../domain/models/executive_profile.dart';

/// Executive repository provider
final executiveRepositoryProvider = Provider<ExecutiveRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ExecutiveRepository(apiClient: apiClient);
});

/// Current user's executive profile
final myExecutiveProfileProvider = FutureProvider<ExecutiveProfile?>((ref) async {
  final repository = ref.watch(executiveRepositoryProvider);
  return repository.getMyProfile();
});

/// Executive profile by ID
final executiveProfileProvider = FutureProvider.family<ExecutiveProfile, String>(
  (ref, id) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getProfileById(id);
  },
);

/// Featured executives
final featuredExecutivesProvider = FutureProvider<List<ExecutiveProfile>>((ref) async {
  final repository = ref.watch(executiveRepositoryProvider);
  return repository.getFeaturedExecutives();
});

/// Executive search results
final executiveSearchProvider = FutureProvider.family<PaginatedExecutives, ExecutiveSearchFilters>(
  (ref, filters) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.searchExecutives(filters);
  },
);

/// Executive engagements
final executiveEngagementsProvider = FutureProvider.family<List<ExecutiveEngagement>, String>(
  (ref, executiveProfileId) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getExecutiveEngagements(executiveProfileId: executiveProfileId);
  },
);

/// Active engagements only
final activeEngagementsProvider = FutureProvider.family<List<ExecutiveEngagement>, String>(
  (ref, executiveProfileId) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getExecutiveEngagements(
      executiveProfileId: executiveProfileId,
      status: EngagementStatus.active,
    );
  },
);

/// Single engagement
final engagementProvider = FutureProvider.family<ExecutiveEngagement, String>(
  (ref, id) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getEngagement(id);
  },
);

/// Engagement milestones
final engagementMilestonesProvider = FutureProvider.family<List<ExecutiveMilestone>, String>(
  (ref, engagementId) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getMilestones(engagementId);
  },
);

/// Engagement time entries
final engagementTimeEntriesProvider = FutureProvider.family<List<ExecutiveTimeEntry>, String>(
  (ref, engagementId) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getTimeEntries(engagementId: engagementId);
  },
);

/// Executive stats
final executiveStatsProvider = FutureProvider.family<ExecutiveStats, String?>(
  (ref, executiveProfileId) async {
    final repository = ref.watch(executiveRepositoryProvider);
    return repository.getStats(executiveProfileId: executiveProfileId);
  },
);

/// State notifier for managing executive profile updates
class ExecutiveProfileNotifier extends StateNotifier<AsyncValue<ExecutiveProfile?>> {
  final ExecutiveRepository _repository;

  ExecutiveProfileNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadProfile();
  }

  Future<void> loadProfile() async {
    state = const AsyncValue.loading();
    try {
      final profile = await _repository.getMyProfile();
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> createProfile({
    required ExecutiveType executiveType,
    required String headline,
    String? executiveSummary,
    int? yearsExecutiveExp,
    List<String>? industries,
    List<String>? specializations,
  }) async {
    try {
      final profile = await _repository.createProfile(
        executiveType: executiveType,
        headline: headline,
        executiveSummary: executiveSummary,
        yearsExecutiveExp: yearsExecutiveExp,
        industries: industries,
        specializations: specializations,
      );
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> updateProfile(Map<String, dynamic> updates) async {
    try {
      final profile = await _repository.updateProfile(updates);
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }
}

final executiveProfileNotifierProvider =
    StateNotifierProvider<ExecutiveProfileNotifier, AsyncValue<ExecutiveProfile?>>((ref) {
  final repository = ref.watch(executiveRepositoryProvider);
  return ExecutiveProfileNotifier(repository);
});

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/domain/models/auth_state.dart';
import '../../features/auth/domain/models/user.dart';
import '../../features/contracts/domain/models/contract.dart';
import '../../features/jobs/domain/models/job.dart';
import '../../features/jobs/domain/models/job_filter.dart';
import '../../features/messages/domain/models/conversation.dart';
import '../../features/notifications/domain/models/notification.dart' as app;
import '../../features/proposals/domain/models/proposal.dart';
import '../../features/time/domain/models/time_entry.dart';
import '../connectivity/connectivity_service.dart';
import '../network/api_client.dart';
import '../storage/local_cache.dart';
import '../storage/secure_storage.dart';

// ============================================================================
// Core Providers
// ============================================================================

/// App lifecycle state
final appLifecycleProvider = StateProvider<AppLifecycleState>((ref) {
  return AppLifecycleState.resumed;
});

/// Theme mode provider
final themeModeProvider = StateProvider<ThemeMode>((ref) {
  return ThemeMode.system;
});

/// API client provider
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

/// Secure storage provider
final secureStorageProvider = Provider<SecureStorage>((ref) {
  return SecureStorage();
});

/// Local cache provider
final localCacheProvider = Provider<LocalCache>((ref) {
  return LocalCache();
});

/// Connectivity provider
final connectivityProvider = StreamProvider<ConnectivityStatus>((ref) {
  return ConnectivityService().statusStream;
});

/// Is online provider
final isOnlineProvider = Provider<bool>((ref) {
  final connectivity = ref.watch(connectivityProvider);
  return connectivity.whenOrNull(data: (status) => status.isOnline) ?? true;
});

// ============================================================================
// Auth Providers
// ============================================================================

/// Auth state provider
final authStateProvider =
    StateNotifierProvider<AuthStateNotifier, AuthState>((ref) {
  return AuthStateNotifier(ref);
});

/// Current user provider
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).user;
});

/// Is authenticated provider
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider).isAuthenticated;
});

/// Auth state notifier
class AuthStateNotifier extends StateNotifier<AuthState> {
  final Ref _ref;

  AuthStateNotifier(this._ref) : super(const AuthState.initial());

  Future<void> login(String email, String password) async {
    state = const AuthState.loading();
    try {
      // TODO: Implement actual login
      await Future.delayed(const Duration(seconds: 1));
      state = AuthState.authenticated(
        user: User(
          id: '1',
          email: email,
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: null,
          role: UserRole.freelancer,
        ),
        token: 'mock_token',
      );
    } catch (e) {
      state = AuthState.error(e.toString());
    }
  }

  Future<void> logout() async {
    await _ref.read(secureStorageProvider).deleteToken();
    state = const AuthState.initial();
  }
}

// ============================================================================
// Jobs Providers
// ============================================================================

/// Jobs filter provider
final jobsFilterProvider = StateProvider<JobFilter>((ref) {
  return const JobFilter();
});

/// Jobs list provider
final jobsProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  final filter = ref.watch(jobsFilterProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    // Return cached jobs when offline
    return ref.read(localCacheProvider).getCachedJobs();
  }

  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockJobs;
});

/// Job detail provider
final jobDetailProvider =
    FutureProvider.family<Job?, String>((ref, jobId) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(milliseconds: 500));
  return _mockJobs.firstWhere((j) => j.id == jobId,
      orElse: () => _mockJobs.first);
});

/// Saved jobs provider
final savedJobsProvider =
    StateNotifierProvider<SavedJobsNotifier, Set<String>>((ref) {
  return SavedJobsNotifier();
});

class SavedJobsNotifier extends StateNotifier<Set<String>> {
  SavedJobsNotifier() : super({});

  void toggle(String jobId) {
    if (state.contains(jobId)) {
      state = {...state}..remove(jobId);
    } else {
      state = {...state, jobId};
    }
  }

  bool isSaved(String jobId) => state.contains(jobId);
}

// ============================================================================
// Proposals Providers
// ============================================================================

/// My proposals provider
final myProposalsProvider =
    FutureProvider.autoDispose<List<Proposal>>((ref) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockProposals;
});

/// Proposal detail provider
final proposalDetailProvider =
    FutureProvider.family<Proposal?, String>((ref, proposalId) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(milliseconds: 500));
  return _mockProposals.firstWhere((p) => p.id == proposalId,
      orElse: () => _mockProposals.first);
});

// ============================================================================
// Time Tracking Providers
// ============================================================================

/// Active timer provider
final activeTimerProvider =
    StateNotifierProvider<ActiveTimerNotifier, ActiveTimer?>((ref) {
  return ActiveTimerNotifier();
});

class ActiveTimerNotifier extends StateNotifier<ActiveTimer?> {
  ActiveTimerNotifier() : super(null);

  void start(String projectId, String projectName) {
    state = ActiveTimer(
      projectId: projectId,
      projectName: projectName,
      startTime: DateTime.now(),
    );
  }

  void stop() {
    state = null;
  }

  void pause() {
    if (state != null) {
      state = state!.copyWith(isPaused: true);
    }
  }

  void resume() {
    if (state != null) {
      state = state!.copyWith(isPaused: false);
    }
  }
}

class ActiveTimer {
  final String projectId;
  final String projectName;
  final DateTime startTime;
  final bool isPaused;
  final String? description;

  ActiveTimer({
    required this.projectId,
    required this.projectName,
    required this.startTime,
    this.isPaused = false,
    this.description,
  });

  ActiveTimer copyWith({
    String? projectId,
    String? projectName,
    DateTime? startTime,
    bool? isPaused,
    String? description,
  }) {
    return ActiveTimer(
      projectId: projectId ?? this.projectId,
      projectName: projectName ?? this.projectName,
      startTime: startTime ?? this.startTime,
      isPaused: isPaused ?? this.isPaused,
      description: description ?? this.description,
    );
  }
}

/// Time entries provider
final timeEntriesProvider =
    FutureProvider.autoDispose<List<TimeEntry>>((ref) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockTimeEntries;
});

// ============================================================================
// Contracts Providers
// ============================================================================

/// Contracts provider
final contractsProvider =
    FutureProvider.autoDispose<List<Contract>>((ref) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockContracts;
});

/// Contract detail provider
final contractDetailProvider =
    FutureProvider.family<Contract?, String>((ref, contractId) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(milliseconds: 500));
  return _mockContracts.firstWhere((c) => c.id == contractId,
      orElse: () => _mockContracts.first);
});

// ============================================================================
// Messages Providers
// ============================================================================

/// Conversations provider
final conversationsProvider =
    FutureProvider.autoDispose<List<Conversation>>((ref) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockConversations;
});

/// Unread count provider
final unreadMessagesCountProvider = Provider<int>((ref) {
  final conversations = ref.watch(conversationsProvider);
  return conversations.whenOrNull(
        data: (list) => list.fold<int>(0, (sum, c) => sum + c.unreadCount),
      ) ??
      0;
});

// ============================================================================
// Notifications Providers
// ============================================================================

/// Notifications provider
final notificationsProvider =
    FutureProvider.autoDispose<List<app.Notification>>((ref) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(seconds: 1));
  return _mockNotifications;
});

/// Unread notifications count
final unreadNotificationsCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider);
  return notifications.whenOrNull(
        data: (list) => list.where((n) => !n.isRead).length,
      ) ??
      0;
});

// ============================================================================
// Mock Data
// ============================================================================

final _mockJobs = <Job>[
  Job(
    id: '1',
    title: 'Senior Flutter Developer for E-commerce App',
    description: 'We are looking for an experienced Flutter developer...',
    clientName: 'TechStart Inc.',
    clientAvatarUrl: null,
    budget: 5000,
    budgetType: BudgetType.fixed,
    skills: ['Flutter', 'Dart', 'Firebase', 'REST API'],
    postedAt: DateTime.now().subtract(const Duration(hours: 2)),
    proposalCount: 12,
    experienceLevel: ExperienceLevel.expert,
    projectDuration: ProjectDuration.oneToThreeMonths,
    isRemote: true,
    smartMatchScore: 95,
  ),
  Job(
    id: '2',
    title: 'Mobile App UI/UX Designer',
    description: 'Design beautiful mobile app interfaces...',
    clientName: 'DesignHub',
    clientAvatarUrl: null,
    budget: 50,
    budgetType: BudgetType.hourly,
    skills: ['Figma', 'UI Design', 'Mobile Design'],
    postedAt: DateTime.now().subtract(const Duration(days: 1)),
    proposalCount: 8,
    experienceLevel: ExperienceLevel.intermediate,
    projectDuration: ProjectDuration.lessThanOneMonth,
    isRemote: true,
    smartMatchScore: 82,
  ),
];

final _mockProposals = <Proposal>[
  Proposal(
    id: '1',
    jobId: '1',
    jobTitle: 'Senior Flutter Developer for E-commerce App',
    clientName: 'TechStart Inc.',
    bidAmount: 4500,
    coverLetter: 'I am excited to apply for this position...',
    status: ProposalStatus.pending,
    submittedAt: DateTime.now().subtract(const Duration(days: 1)),
  ),
];

final _mockTimeEntries = <TimeEntry>[
  TimeEntry(
    id: '1',
    projectId: '1',
    projectName: 'E-commerce App',
    startTime: DateTime.now().subtract(const Duration(hours: 3)),
    endTime: DateTime.now().subtract(const Duration(hours: 1)),
    description: 'Implemented product listing screen',
    category: 'Development',
    isBillable: true,
  ),
];

final _mockContracts = <Contract>[
  Contract(
    id: '1',
    title: 'E-commerce App Development',
    clientName: 'TechStart Inc.',
    clientAvatarUrl: null,
    status: ContractStatus.active,
    totalAmount: 5000,
    paidAmount: 2000,
    startDate: DateTime.now().subtract(const Duration(days: 30)),
    endDate: DateTime.now().add(const Duration(days: 60)),
    type: ContractType.fixed,
  ),
];

final _mockConversations = <Conversation>[
  Conversation(
    id: '1',
    participantName: 'John Smith',
    participantAvatarUrl: null,
    lastMessage: 'Thanks for the update!',
    lastMessageAt: DateTime.now().subtract(const Duration(minutes: 30)),
    unreadCount: 2,
    isOnline: true,
  ),
];

final _mockNotifications = <app.Notification>[
  app.Notification(
    id: '1',
    type: app.NotificationType.jobMatch,
    title: 'New Job Match',
    body: 'A new job matching your skills has been posted',
    createdAt: DateTime.now().subtract(const Duration(hours: 1)),
    isRead: false,
    data: {'jobId': '1'},
  ),
];

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/repositories/auth_repository.dart';
import '../../features/auth/domain/models/auth_state.dart';
import '../../features/auth/domain/models/user.dart';
import '../../features/auth/presentation/state/signup_state.dart';
import '../../features/contracts/data/repositories/contracts_repository.dart';
import '../../features/contracts/domain/models/contract.dart';
import '../../features/jobs/data/repositories/jobs_repository.dart';
import '../../features/jobs/domain/models/job.dart';
import '../../features/jobs/domain/models/job_filter.dart';
import '../../features/messages/data/repositories/messages_repository.dart';
import '../../features/messages/domain/models/message.dart';
import '../../features/notifications/domain/models/notification.dart' as app;
import '../../features/proposals/data/repositories/proposals_repository.dart';
import '../../features/proposals/domain/models/proposal.dart';
import '../../features/time_tracking/data/repositories/time_tracking_repository.dart';
import '../../features/time_tracking/domain/models/time_entry.dart';
import '../../features/time_tracking/domain/services/timer_service.dart';
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
// Repository Providers
// ============================================================================

/// Auth repository provider
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiClient: ref.watch(apiClientProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

/// Jobs repository provider
final jobsRepositoryProvider = Provider<JobsRepository>((ref) {
  return JobsRepository(
    apiClient: ref.watch(apiClientProvider),
    localCache: ref.watch(localCacheProvider),
  );
});

/// Proposals repository provider
final proposalsRepositoryProvider = Provider<ProposalsRepository>((ref) {
  return ProposalsRepository(apiClient: ref.watch(apiClientProvider));
});

/// Contracts repository provider
final contractsRepositoryProvider = Provider<ContractsRepository>((ref) {
  return ContractsRepository(apiClient: ref.watch(apiClientProvider));
});

/// Messages repository provider
final messagesRepositoryProvider = Provider<MessagesRepository>((ref) {
  return MessagesRepository(apiClient: ref.watch(apiClientProvider));
});

/// Time tracking repository provider
final timeTrackingRepositoryProvider = Provider<TimeTrackingRepository>((ref) {
  return TimeTrackingRepository(apiClient: ref.watch(apiClientProvider));
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
      final authRepo = _ref.read(authRepositoryProvider);
      final result = await authRepo.login(email: email, password: password);

      switch (result) {
        case AuthResultSuccess(:final user, :final token):
          state = AuthState.authenticated(user: user, token: token);
        case AuthResultFailure(:final message):
          state = AuthState.error(message);
      }
    } catch (e) {
      state = AuthState.error(e.toString());
    }
  }

  Future<void> logout() async {
    final authRepo = _ref.read(authRepositoryProvider);
    await authRepo.logout();
    state = const AuthState.initial();
  }

  Future<void> checkAuthStatus() async {
    state = const AuthState.loading();
    try {
      final authRepo = _ref.read(authRepositoryProvider);
      final user = await authRepo.getCurrentUser();
      if (user != null) {
        final token = await _ref.read(secureStorageProvider).getToken();
        state = AuthState.authenticated(user: user, token: token ?? '');
      } else {
        state = const AuthState.initial();
      }
    } catch (_) {
      state = const AuthState.initial();
    }
  }
}

// ============================================================================
// Signup Provider
// ============================================================================

/// Signup state provider
final signupStateProvider =
    StateNotifierProvider<SignupStateNotifier, SignupState>((ref) {
  return SignupStateNotifier(ref);
});

/// Signup state notifier
class SignupStateNotifier extends StateNotifier<SignupState> {
  final Ref _ref;

  SignupStateNotifier(this._ref) : super(const SignupState.initial());

  Future<void> signup({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required UserRole role,
  }) async {
    state = const SignupState.loading();
    try {
      final authRepo = _ref.read(authRepositoryProvider);
      final result = await authRepo.signup(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        role: role,
      );

      switch (result) {
        case SignupResultSuccess(
            :final email,
            :final message,
            :final requiresEmailVerification
          ):
          state = SignupState.success(
            email: email,
            message: message,
            requiresEmailVerification: requiresEmailVerification,
          );
        case SignupResultFailure(:final message):
          state = SignupState.error(message);
      }
    } catch (e) {
      state = SignupState.error(e.toString());
    }
  }

  void reset() {
    state = const SignupState.initial();
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
  final filter = ref.watch(jobsFilterProvider); // Watch for reactivity
  final isOnline = ref.watch(isOnlineProvider);
  final jobsRepo = ref.watch(jobsRepositoryProvider);

  if (!isOnline) {
    // Return cached jobs when offline
    return jobsRepo.getCachedJobs();
  }

  try {
    final result = await jobsRepo.getJobs(filter: filter);
    return result.jobs;
  } catch (_) {
    // Fallback to cache on error
    return jobsRepo.getCachedJobs();
  }
});

/// Job detail provider
final jobDetailProvider =
    FutureProvider.family<Job?, String>((ref, jobId) async {
  final jobsRepo = ref.watch(jobsRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return jobsRepo.getCachedJob(jobId);
  }

  try {
    return await jobsRepo.getJobById(jobId);
  } catch (_) {
    return jobsRepo.getCachedJob(jobId);
  }
});

/// Saved jobs provider
final savedJobsProvider =
    StateNotifierProvider<SavedJobsNotifier, Set<String>>((ref) {
  return SavedJobsNotifier(ref);
});

class SavedJobsNotifier extends StateNotifier<Set<String>> {
  final Ref _ref;

  SavedJobsNotifier(this._ref) : super({});

  Future<void> toggle(String jobId) async {
    final jobsRepo = _ref.read(jobsRepositoryProvider);

    if (state.contains(jobId)) {
      state = {...state}..remove(jobId);
      try {
        await jobsRepo.unsaveJob(jobId);
      } catch (_) {
        // Revert on error
        state = {...state, jobId};
      }
    } else {
      state = {...state, jobId};
      try {
        await jobsRepo.saveJob(jobId);
      } catch (_) {
        // Revert on error
        state = {...state}..remove(jobId);
      }
    }
  }

  bool isSaved(String jobId) => state.contains(jobId);

  Future<void> loadSavedJobs() async {
    final jobsRepo = _ref.read(jobsRepositoryProvider);
    try {
      final savedJobs = await jobsRepo.getSavedJobs();
      state = savedJobs.map((j) => j.id).toSet();
    } catch (_) {
      // Ignore errors, keep current state
    }
  }
}

// ============================================================================
// Proposals Providers
// ============================================================================

/// My proposals provider
final myProposalsProvider =
    FutureProvider.autoDispose<List<Proposal>>((ref) async {
  final proposalsRepo = ref.watch(proposalsRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for proposals
  }

  try {
    final result = await proposalsRepo.getMyProposals();
    return result.proposals;
  } catch (_) {
    return [];
  }
});

/// Proposal detail provider
final proposalDetailProvider =
    FutureProvider.family<Proposal?, String>((ref, proposalId) async {
  final proposalsRepo = ref.watch(proposalsRepositoryProvider);

  try {
    return await proposalsRepo.getProposalById(proposalId);
  } catch (_) {
    return null;
  }
});

// ============================================================================
// Time Tracking Providers
// ============================================================================

/// Timer service provider
final timerServiceProvider = ChangeNotifierProvider<TimerService>((ref) {
  return TimerService();
});

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

/// Time entries provider (for a specific contract)
final timeEntriesProvider = FutureProvider.autoDispose
    .family<List<TimeEntry>, String>((ref, contractId) async {
  final timeTrackingRepo = ref.watch(timeTrackingRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for time entries
  }

  try {
    return await timeTrackingRepo.getTimeEntries(contractId);
  } catch (_) {
    return [];
  }
});

/// All time entries provider (aggregates entries from all active contracts)
final allTimeEntriesProvider =
    FutureProvider.autoDispose<List<TimeEntry>>((ref) async {
  final contractsAsync = ref.watch(contractsProvider);
  final timeTrackingRepo = ref.watch(timeTrackingRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for time entries
  }

  return contractsAsync.maybeWhen(
    data: (contracts) async {
      final allEntries = <TimeEntry>[];
      for (final contract in contracts) {
        try {
          final entries = await timeTrackingRepo.getTimeEntries(contract.id);
          allEntries.addAll(entries);
        } catch (_) {
          // Skip failed contract entries
        }
      }
      // Sort by start time descending
      allEntries.sort((a, b) => b.startTime.compareTo(a.startTime));
      return allEntries;
    },
    orElse: () => <TimeEntry>[],
  );
});

// ============================================================================
// Contracts Providers
// ============================================================================

/// Contracts provider
final contractsProvider =
    FutureProvider.autoDispose<List<Contract>>((ref) async {
  final contractsRepo = ref.watch(contractsRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for contracts
  }

  try {
    return await contractsRepo.getMyContracts();
  } catch (_) {
    return [];
  }
});

/// My contracts provider (alias for contractsProvider, filtered for current user)
final myContractsProvider =
    FutureProvider.autoDispose<List<Contract>>((ref) async {
  return ref.watch(contractsProvider).maybeWhen(
        data: (contracts) => contracts,
        orElse: () => [],
      );
});

/// Contract detail provider
final contractDetailProvider =
    FutureProvider.family<Contract?, String>((ref, contractId) async {
  final contractsRepo = ref.watch(contractsRepositoryProvider);

  try {
    return await contractsRepo.getContractById(contractId);
  } catch (_) {
    return null;
  }
});

// ============================================================================
// Messages Providers
// ============================================================================

/// Conversations provider
final conversationsProvider =
    FutureProvider.autoDispose<List<Conversation>>((ref) async {
  final messagesRepo = ref.watch(messagesRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for conversations
  }

  try {
    final result = await messagesRepo.getConversations();
    return result.conversations;
  } catch (_) {
    return [];
  }
});

/// Unread count provider
final unreadMessagesCountProvider = FutureProvider<int>((ref) async {
  final messagesRepo = ref.watch(messagesRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return 0;
  }

  try {
    return await messagesRepo.getTotalUnreadCount();
  } catch (_) {
    // Fallback to calculating from conversations
    final conversations = ref.watch(conversationsProvider);
    return conversations.whenOrNull(
          data: (list) => list.fold<int>(0, (sum, c) => sum + c.unreadCount),
        ) ??
        0;
  }
});

/// Conversation detail provider
final conversationDetailProvider =
    FutureProvider.family<Conversation?, String>((ref, conversationId) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(milliseconds: 500));
  final conversations = await ref.watch(conversationsProvider.future);
  return conversations.where((c) => c.id == conversationId).firstOrNull;
});

/// Messages provider for a conversation
final messagesProvider =
    FutureProvider.family<List<Message>, String>((ref, conversationId) async {
  // TODO: Fetch from API
  await Future.delayed(const Duration(milliseconds: 500));
  return _mockMessages
      .where((m) => m.conversationId == conversationId)
      .toList();
});

// ============================================================================
// Notifications Providers
// ============================================================================

/// Notifications provider
final notificationsProvider =
    FutureProvider.autoDispose<List<app.AppNotification>>((ref) async {
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
// Mock Data (for development/testing - to be removed in production)
// ============================================================================

// ignore: unused_element
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

// ignore: unused_element
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

// ignore: unused_element
final _mockTimeEntries = <TimeEntry>[
  TimeEntry(
    id: '1',
    contractId: '1',
    contractTitle: 'E-commerce App Development',
    startTime: DateTime.now().subtract(const Duration(hours: 3)),
    endTime: DateTime.now().subtract(const Duration(hours: 1)),
    description: 'Implemented product listing screen',
    memo: 'Development work',
    isBillable: true,
  ),
];

// ignore: unused_element
final _mockContracts = <Contract>[
  Contract(
    id: '1',
    title: 'E-commerce App Development',
    clientId: 'client_1',
    clientName: 'TechStart Inc.',
    clientAvatarUrl: null,
    status: ContractStatus.active,
    totalAmount: 5000,
    paidAmount: 2000,
    hourlyRate: 0,
    startDate: DateTime.now().subtract(const Duration(days: 30)),
    endDate: DateTime.now().add(const Duration(days: 60)),
    description: 'Building a full-featured e-commerce mobile app with Flutter',
  ),
  Contract(
    id: '2',
    title: 'Mobile App Maintenance',
    clientId: 'client_2',
    clientName: 'DesignHub',
    clientAvatarUrl: null,
    status: ContractStatus.active,
    totalAmount: 0,
    paidAmount: 1200,
    hourlyRate: 75,
    startDate: DateTime.now().subtract(const Duration(days: 60)),
    endDate: null,
    description: 'Ongoing maintenance and feature development',
  ),
];

// ignore: unused_element
final _mockConversations = <Conversation>[
  Conversation(
    id: '1',
    participantId: 'user_1',
    participantName: 'John Smith',
    participantAvatarUrl: null,
    jobTitle: 'E-commerce App Development',
    lastMessage: Message(
      id: 'msg_1',
      conversationId: '1',
      senderId: 'user_1',
      content: 'Thanks for the update!',
      sentAt: DateTime.now().subtract(const Duration(minutes: 30)),
      isRead: false,
    ),
    unreadCount: 2,
    updatedAt: DateTime.now().subtract(const Duration(minutes: 30)),
  ),
];

final _mockMessages = <Message>[
  Message(
    id: '1',
    conversationId: '1',
    senderId: 'client1',
    content: 'Hi! I saw your proposal and I am interested.',
    sentAt: DateTime.now().subtract(const Duration(hours: 1)),
    isRead: true,
  ),
  Message(
    id: '2',
    conversationId: '1',
    senderId: 'me',
    content: 'Thank you for reaching out! I would love to discuss the project.',
    sentAt: DateTime.now().subtract(const Duration(minutes: 30)),
    isRead: true,
  ),
];

final _mockNotifications = <app.AppNotification>[
  app.AppNotification(
    id: '1',
    type: app.NotificationType.job,
    title: 'New Job Match',
    body: 'A new job matching your skills has been posted',
    createdAt: DateTime.now().subtract(const Duration(hours: 1)),
    isRead: false,
    data: {'jobId': '1'},
  ),
];

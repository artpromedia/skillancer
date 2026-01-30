import 'dart:async';
import 'dart:io';

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
import '../../features/notifications/data/repositories/notifications_repository.dart';
import '../../features/notifications/domain/models/notification.dart' as app;
import '../../features/proposals/data/repositories/proposals_repository.dart';
import '../../features/proposals/domain/models/proposal.dart';
import '../../features/time_tracking/data/repositories/time_tracking_repository.dart';
import '../../features/time_tracking/domain/models/time_entry.dart';
import '../../features/time_tracking/domain/services/timer_service.dart';
import '../connectivity/connectivity_service.dart';
import '../network/api_client.dart';
import '../network/websocket_client.dart';
import '../services/message_queue.dart';
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

/// Notifications repository provider
final notificationsRepositoryProvider =
    Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(apiClient: ref.watch(apiClientProvider));
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
  final messagesRepo = ref.watch(messagesRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    // Try to find in cached conversations
    final conversations = ref.watch(conversationsProvider);
    return conversations.whenOrNull(
      data: (list) => list.where((c) => c.id == conversationId).firstOrNull,
    );
  }

  try {
    return await messagesRepo.getConversation(conversationId);
  } catch (_) {
    // Fallback to local list
    final conversations = await ref.watch(conversationsProvider.future);
    return conversations.where((c) => c.id == conversationId).firstOrNull;
  }
});

/// Messages provider for a conversation with pagination support
final messagesProvider =
    FutureProvider.family<List<Message>, String>((ref, conversationId) async {
  final messagesRepo = ref.watch(messagesRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for messages
  }

  try {
    final result =
        await messagesRepo.getMessages(conversationId: conversationId);
    return result.messages;
  } catch (_) {
    return [];
  }
});

// ============================================================================
// WebSocket Provider
// ============================================================================

/// WebSocket client provider
final webSocketClientProvider = Provider<WebSocketClient>((ref) {
  final client = WebSocketClient();

  // Connect when authenticated
  ref.listen(authStateProvider, (previous, next) {
    if (next.isAuthenticated) {
      client.connect();
    } else {
      client.disconnect();
    }
  });

  ref.onDispose(() {
    client.dispose();
  });

  return client;
});

/// WebSocket events stream provider
final webSocketEventsProvider = StreamProvider<WebSocketEvent>((ref) {
  final client = ref.watch(webSocketClientProvider);
  return client.events;
});

// ============================================================================
// Message Queue Provider
// ============================================================================

/// Offline message queue provider
final messageQueueProvider = Provider<MessageQueue>((ref) {
  final queue = MessageQueue();
  queue.initialize();

  // Listen to connectivity changes
  ref.listen(isOnlineProvider, (previous, next) {
    queue.setOnlineStatus(next);
  });

  ref.onDispose(() {
    queue.dispose();
  });

  return queue;
});

// ============================================================================
// Typing Indicators
// ============================================================================

/// Typing indicator state for a conversation
class TypingState {
  final Map<String, TypingIndicator> typingUsers;

  const TypingState({this.typingUsers = const {}});

  TypingState copyWith({Map<String, TypingIndicator>? typingUsers}) {
    return TypingState(typingUsers: typingUsers ?? this.typingUsers);
  }

  List<String> get typingUserNames =>
      typingUsers.values.map((t) => t.userName).toList();

  bool get hasTypingUsers => typingUsers.isNotEmpty;
}

/// Typing state provider for a conversation
final typingStateProvider = StateNotifierProvider.autoDispose
    .family<TypingStateNotifier, TypingState, String>((ref, conversationId) {
  return TypingStateNotifier(ref, conversationId);
});

/// Typing state notifier
class TypingStateNotifier extends StateNotifier<TypingState> {
  final Ref _ref;
  final String conversationId;
  StreamSubscription? _subscription;
  final Map<String, Timer> _timeoutTimers = {};

  TypingStateNotifier(this._ref, this.conversationId)
      : super(const TypingState()) {
    _listenToWebSocket();
  }

  void _listenToWebSocket() {
    final client = _ref.read(webSocketClientProvider);
    _subscription = client.events.listen((event) {
      if (event.type == WebSocketEventType.typing ||
          event.type == WebSocketEventType.typingStop) {
        final indicator = event.data as TypingIndicator;
        if (indicator.conversationId == conversationId) {
          _handleTypingEvent(indicator);
        }
      }
    });
  }

  void _handleTypingEvent(TypingIndicator indicator) {
    // Cancel existing timeout
    _timeoutTimers[indicator.userId]?.cancel();

    if (indicator.isTyping) {
      // Add typing user
      final newUsers = Map<String, TypingIndicator>.from(state.typingUsers);
      newUsers[indicator.userId] = indicator;
      state = state.copyWith(typingUsers: newUsers);

      // Set timeout to auto-remove after 5 seconds
      _timeoutTimers[indicator.userId] = Timer(
        const Duration(seconds: 5),
        () => _removeTypingUser(indicator.userId),
      );
    } else {
      _removeTypingUser(indicator.userId);
    }
  }

  void _removeTypingUser(String userId) {
    _timeoutTimers[userId]?.cancel();
    _timeoutTimers.remove(userId);

    final newUsers = Map<String, TypingIndicator>.from(state.typingUsers);
    newUsers.remove(userId);
    state = state.copyWith(typingUsers: newUsers);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    for (final timer in _timeoutTimers.values) {
      timer.cancel();
    }
    super.dispose();
  }
}

/// Messages pagination state for a conversation
class MessagesState {
  final List<Message> messages;
  final bool isLoading;
  final bool hasMore;
  final String? error;
  final Map<String, Message> pendingMessages; // Keyed by localId

  const MessagesState({
    this.messages = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.error,
    this.pendingMessages = const {},
  });

  MessagesState copyWith({
    List<Message>? messages,
    bool? isLoading,
    bool? hasMore,
    String? error,
    Map<String, Message>? pendingMessages,
  }) {
    return MessagesState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      pendingMessages: pendingMessages ?? this.pendingMessages,
    );
  }

  /// Get all messages including pending ones, sorted by date
  List<Message> get allMessages {
    final all = [...messages, ...pendingMessages.values];
    all.sort((a, b) => b.sentAt.compareTo(a.sentAt));
    return all;
  }

  /// Get failed messages that can be retried
  List<Message> get failedMessages {
    return pendingMessages.values
        .where((m) => m.status == MessageStatus.failed)
        .toList();
  }
}

/// Messages state notifier for handling pagination, sending, and real-time updates
class MessagesNotifier extends StateNotifier<MessagesState> {
  final Ref _ref;
  final String conversationId;
  StreamSubscription? _wsSubscription;
  StreamSubscription? _queueSubscription;
  Timer? _typingDebounce;
  bool _isCurrentlyTyping = false;

  MessagesNotifier(this._ref, this.conversationId)
      : super(const MessagesState()) {
    loadMessages();
    _listenToWebSocket();
    _listenToMessageQueue();
  }

  void _listenToWebSocket() {
    final client = _ref.read(webSocketClientProvider);
    _wsSubscription = client.events.listen((event) {
      switch (event.type) {
        case WebSocketEventType.newMessage:
          _handleNewMessage(event.data as Message);
          break;
        case WebSocketEventType.messageDelivered:
          _handleMessageDelivered(event.data as Map<String, dynamic>);
          break;
        case WebSocketEventType.messageRead:
          _handleMessageRead(event.data as Map<String, dynamic>);
          break;
        default:
          break;
      }
    });
  }

  void _listenToMessageQueue() {
    final queue = _ref.read(messageQueueProvider);
    _queueSubscription = queue.queueUpdates.listen((queuedMessage) {
      if (queuedMessage.message.conversationId == conversationId) {
        _updatePendingMessage(queuedMessage.message);
      }
    });
  }

  void _handleNewMessage(Message message) {
    if (message.conversationId != conversationId) return;

    // Check if this is a confirmation of our pending message
    final localId = message.localId;
    if (localId != null && state.pendingMessages.containsKey(localId)) {
      // Remove from pending and add to messages
      final newPending = Map<String, Message>.from(state.pendingMessages);
      newPending.remove(localId);

      state = state.copyWith(
        messages: [
          message.copyWith(status: MessageStatus.sent),
          ...state.messages
        ],
        pendingMessages: newPending,
      );

      // Remove from offline queue
      _ref.read(messageQueueProvider).markAsSent(localId);
    } else if (!state.messages.any((m) => m.id == message.id)) {
      // New message from another user
      state = state.copyWith(
        messages: [message, ...state.messages],
      );

      // Send read receipt
      final client = _ref.read(webSocketClientProvider);
      client.sendMessageRead(
        conversationId: conversationId,
        messageId: message.id,
      );
    }
  }

  void _handleMessageDelivered(Map<String, dynamic> data) {
    final messageId = data['messageId'] as String;

    final updatedMessages = state.messages.map((m) {
      if (m.id == messageId && m.status == MessageStatus.sent) {
        return m.copyWith(status: MessageStatus.delivered);
      }
      return m;
    }).toList();

    state = state.copyWith(messages: updatedMessages);
  }

  void _handleMessageRead(Map<String, dynamic> data) {
    final convId = data['conversationId'] as String;
    if (convId != conversationId) return;

    // Mark all sent messages as read
    final updatedMessages = state.messages.map((m) {
      if (m.status == MessageStatus.sent ||
          m.status == MessageStatus.delivered) {
        return m.copyWith(status: MessageStatus.read, isRead: true);
      }
      return m;
    }).toList();

    state = state.copyWith(messages: updatedMessages);
  }

  void _updatePendingMessage(Message message) {
    if (message.localId == null) return;

    final newPending = Map<String, Message>.from(state.pendingMessages);
    newPending[message.localId!] = message;
    state = state.copyWith(pendingMessages: newPending);
  }

  Future<void> loadMessages() async {
    if (state.isLoading) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final messagesRepo = _ref.read(messagesRepositoryProvider);
      final result =
          await messagesRepo.getMessages(conversationId: conversationId);

      state = state.copyWith(
        messages: result.messages,
        isLoading: false,
        hasMore: result.hasMore,
      );

      // Mark as read when loading messages
      await messagesRepo.markAsRead(conversationId);
      // Invalidate unread count
      _ref.invalidate(unreadMessagesCountProvider);
      _ref.invalidate(conversationsProvider);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> loadMoreMessages() async {
    if (state.isLoading || !state.hasMore || state.messages.isEmpty) return;

    state = state.copyWith(isLoading: true);

    try {
      final messagesRepo = _ref.read(messagesRepositoryProvider);
      final oldestMessage = state.messages.last;

      final result = await messagesRepo.getMessages(
        conversationId: conversationId,
        before: oldestMessage.id,
      );

      state = state.copyWith(
        messages: [...state.messages, ...result.messages],
        isLoading: false,
        hasMore: result.hasMore,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Send a message with optimistic updates
  Future<bool> sendMessage(
    String content, {
    MessageType type = MessageType.text,
    List<Attachment>? attachments,
  }) async {
    final currentUser = _ref.read(currentUserProvider);
    if (currentUser == null) return false;

    // Create pending message for optimistic UI
    final pendingMessage = Message.pending(
      conversationId: conversationId,
      senderId: currentUser.id,
      content: content,
      type: type,
      attachments: attachments,
    );

    // Add to pending messages
    final newPending = Map<String, Message>.from(state.pendingMessages);
    newPending[pendingMessage.localId!] = pendingMessage.copyWith(
      status: MessageStatus.sending,
    );
    state = state.copyWith(pendingMessages: newPending);

    // Also add to offline queue
    final queue = _ref.read(messageQueueProvider);
    await queue.enqueue(pendingMessage);

    try {
      final messagesRepo = _ref.read(messagesRepositoryProvider);
      final sentMessage = await messagesRepo.sendMessage(
        conversationId: conversationId,
        content: content,
        attachments: attachments?.map((a) => a.toJson()).toList(),
        localId: pendingMessage.localId,
      );

      // Remove from pending, add to messages
      final updatedPending = Map<String, Message>.from(state.pendingMessages);
      updatedPending.remove(pendingMessage.localId);

      state = state.copyWith(
        messages: [sentMessage, ...state.messages],
        pendingMessages: updatedPending,
      );

      // Remove from offline queue
      await queue.markAsSent(pendingMessage.localId!);

      // Invalidate conversations to update last message
      _ref.invalidate(conversationsProvider);

      return true;
    } catch (e) {
      // Mark as failed
      final failedPending = Map<String, Message>.from(state.pendingMessages);
      failedPending[pendingMessage.localId!] = pendingMessage.copyWith(
        status: MessageStatus.failed,
        errorMessage: e.toString(),
      );
      state = state.copyWith(
        pendingMessages: failedPending,
        error: 'Failed to send message',
      );
      return false;
    }
  }

  /// Send a message with attachments
  Future<bool> sendMessageWithAttachments(
    String content,
    List<File> files, {
    void Function(int uploaded, int total)? onProgress,
  }) async {
    final currentUser = _ref.read(currentUserProvider);
    if (currentUser == null) return false;

    try {
      final messagesRepo = _ref.read(messagesRepositoryProvider);
      final attachments = <Map<String, dynamic>>[];

      // Upload each file
      for (var i = 0; i < files.length; i++) {
        final result = await messagesRepo.uploadAttachment(
          conversationId: conversationId,
          file: files[i],
          onProgress: (sent, total) {
            onProgress?.call(i, files.length);
          },
        );
        attachments.add(result.toJson());
      }

      // Send message with attachments
      return sendMessage(
        content,
        type: _getMessageTypeForFiles(files),
        attachments: attachments
            .map((a) => Attachment(
                  id: a['id'] as String,
                  name: a['name'] as String,
                  url: a['url'] as String,
                  mimeType: a['mimeType'] as String,
                  size: a['size'] as int,
                ))
            .toList(),
      );
    } catch (e) {
      state = state.copyWith(error: 'Failed to upload attachments');
      return false;
    }
  }

  MessageType _getMessageTypeForFiles(List<File> files) {
    if (files.isEmpty) return MessageType.text;

    final firstFile = files.first;
    final ext = firstFile.path.split('.').last.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext)) {
      return MessageType.image;
    }
    return MessageType.file;
  }

  /// Retry sending a failed message
  Future<bool> retryMessage(String localId) async {
    final pendingMessage = state.pendingMessages[localId];
    if (pendingMessage == null ||
        pendingMessage.status != MessageStatus.failed) {
      return false;
    }

    // Update status to sending
    final retryingPending = Map<String, Message>.from(state.pendingMessages);
    retryingPending[localId] = pendingMessage.copyWith(
      status: MessageStatus.sending,
      retryCount: pendingMessage.retryCount + 1,
    );
    state = state.copyWith(pendingMessages: retryingPending);

    try {
      final messagesRepo = _ref.read(messagesRepositoryProvider);
      final sentMessage = await messagesRepo.sendMessage(
        conversationId: conversationId,
        content: pendingMessage.content,
        attachments:
            pendingMessage.attachments?.map((a) => a.toJson()).toList(),
        localId: localId,
      );

      // Remove from pending, add to messages
      final updatedPending = Map<String, Message>.from(state.pendingMessages);
      updatedPending.remove(localId);

      state = state.copyWith(
        messages: [sentMessage, ...state.messages],
        pendingMessages: updatedPending,
      );

      // Remove from offline queue
      final queue = _ref.read(messageQueueProvider);
      await queue.markAsSent(localId);

      return true;
    } catch (e) {
      // Mark as failed again
      final failedPending = Map<String, Message>.from(state.pendingMessages);
      failedPending[localId] = pendingMessage.copyWith(
        status: MessageStatus.failed,
        errorMessage: e.toString(),
        retryCount: pendingMessage.retryCount + 1,
      );
      state = state.copyWith(pendingMessages: failedPending);
      return false;
    }
  }

  /// Delete a failed message
  void deleteFailedMessage(String localId) {
    final newPending = Map<String, Message>.from(state.pendingMessages);
    newPending.remove(localId);
    state = state.copyWith(pendingMessages: newPending);

    // Remove from offline queue
    _ref.read(messageQueueProvider).removeFromQueue(localId);
  }

  /// Send typing indicator with debounce
  void setTyping(bool isTyping) {
    if (isTyping == _isCurrentlyTyping) return;

    _typingDebounce?.cancel();

    if (isTyping) {
      _isCurrentlyTyping = true;
      _sendTypingIndicator(true);

      // Auto-stop after 3 seconds
      _typingDebounce = Timer(const Duration(seconds: 3), () {
        setTyping(false);
      });
    } else {
      _isCurrentlyTyping = false;
      _sendTypingIndicator(false);
    }
  }

  void _sendTypingIndicator(bool isTyping) {
    final client = _ref.read(webSocketClientProvider);
    client.sendTypingIndicator(
      conversationId: conversationId,
      isTyping: isTyping,
    );
  }

  void addMessage(Message message) {
    // Add incoming message (e.g., from WebSocket)
    if (!state.messages.any((m) => m.id == message.id)) {
      state = state.copyWith(
        messages: [message, ...state.messages],
      );
    }
  }

  Future<void> refresh() async {
    state = const MessagesState();
    await loadMessages();
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    _queueSubscription?.cancel();
    _typingDebounce?.cancel();
    // Stop typing when leaving
    if (_isCurrentlyTyping) {
      _sendTypingIndicator(false);
    }
    super.dispose();
  }
}

/// Messages state provider (with pagination and send support)
final messagesStateProvider = StateNotifierProvider.autoDispose
    .family<MessagesNotifier, MessagesState, String>((ref, conversationId) {
  return MessagesNotifier(ref, conversationId);
});

// ============================================================================
// Notifications Providers
// ============================================================================

/// Notifications state for pagination and loading
class NotificationsState {
  final List<app.AppNotification> notifications;
  final bool isLoading;
  final bool hasMore;
  final String? error;
  final int unreadCount;

  const NotificationsState({
    this.notifications = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.error,
    this.unreadCount = 0,
  });

  NotificationsState copyWith({
    List<app.AppNotification>? notifications,
    bool? isLoading,
    bool? hasMore,
    String? error,
    int? unreadCount,
  }) {
    return NotificationsState(
      notifications: notifications ?? this.notifications,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}

/// Notifications state notifier for handling pagination
class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final Ref _ref;

  NotificationsNotifier(this._ref) : super(const NotificationsState()) {
    loadNotifications();
  }

  Future<void> loadNotifications() async {
    if (state.isLoading) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final notificationsRepo = _ref.read(notificationsRepositoryProvider);
      final result = await notificationsRepo.getNotifications();
      final unreadCount = await notificationsRepo.getUnreadCount();

      state = state.copyWith(
        notifications: result.notifications,
        isLoading: false,
        hasMore: result.hasMore,
        unreadCount: unreadCount,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> loadMoreNotifications() async {
    if (state.isLoading || !state.hasMore) return;

    state = state.copyWith(isLoading: true);

    try {
      final notificationsRepo = _ref.read(notificationsRepositoryProvider);
      final result = await notificationsRepo.getNotifications(
        offset: state.notifications.length,
      );

      state = state.copyWith(
        notifications: [...state.notifications, ...result.notifications],
        isLoading: false,
        hasMore: result.hasMore,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      final notificationsRepo = _ref.read(notificationsRepositoryProvider);
      await notificationsRepo.markAsRead(notificationId);

      // Update local state
      final updated = state.notifications.map((n) {
        if (n.id == notificationId && !n.isRead) {
          return app.AppNotification(
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt,
            isRead: true,
            actionUrl: n.actionUrl,
            data: n.data,
          );
        }
        return n;
      }).toList();

      state = state.copyWith(
        notifications: updated,
        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
      );
    } catch (e) {
      // Silently fail - notification will be marked on next refresh
    }
  }

  Future<void> markAllAsRead() async {
    try {
      final notificationsRepo = _ref.read(notificationsRepositoryProvider);
      await notificationsRepo.markAllAsRead();

      // Update local state - mark all as read
      final updated = state.notifications.map((n) {
        if (!n.isRead) {
          return app.AppNotification(
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt,
            isRead: true,
            actionUrl: n.actionUrl,
            data: n.data,
          );
        }
        return n;
      }).toList();

      state = state.copyWith(
        notifications: updated,
        unreadCount: 0,
      );
    } catch (e) {
      state = state.copyWith(error: 'Failed to mark all as read');
    }
  }

  Future<void> refresh() async {
    state = const NotificationsState();
    await loadNotifications();
  }
}

/// Notifications state provider
final notificationsStateProvider = StateNotifierProvider.autoDispose<
    NotificationsNotifier, NotificationsState>((ref) {
  return NotificationsNotifier(ref);
});

/// Simple notifications provider (for backwards compatibility)
final notificationsProvider =
    FutureProvider.autoDispose<List<app.AppNotification>>((ref) async {
  final notificationsRepo = ref.watch(notificationsRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return []; // No offline cache for notifications
  }

  try {
    final result = await notificationsRepo.getNotifications();
    return result.notifications;
  } catch (_) {
    return [];
  }
});

/// Unread notifications count (from API)
final unreadNotificationsCountProvider = FutureProvider<int>((ref) async {
  final notificationsRepo = ref.watch(notificationsRepositoryProvider);
  final isOnline = ref.watch(isOnlineProvider);

  if (!isOnline) {
    return 0;
  }

  try {
    return await notificationsRepo.getUnreadCount();
  } catch (_) {
    // Fallback to calculating from local state
    final state = ref.watch(notificationsStateProvider);
    return state.unreadCount;
  }
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

// Mock messages removed - using real API now
// Mock notifications removed - using real API now

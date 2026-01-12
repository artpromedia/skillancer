import '../../../core/network/api_client.dart';
import '../domain/models/message.dart';

/// Messages repository for fetching and managing conversations
class MessagesRepository {
  final ApiClient _apiClient;

  MessagesRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get user's conversations
  Future<ConversationsResult> getConversations({
    String? type,
    int limit = 50,
    String? cursor,
    bool? unreadOnly,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'limit': limit,
      };
      if (type != null) queryParams['type'] = type;
      if (cursor != null) queryParams['cursor'] = cursor;
      if (unreadOnly != null) queryParams['unreadOnly'] = unreadOnly;

      final response = await _apiClient.get(
        '/conversations',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final conversationsList = data['data'] as Map<String, dynamic>?;
      final conversations = (conversationsList?['conversations'] as List? ?? [])
          .map((c) => _mapToConversation(c as Map<String, dynamic>))
          .toList();

      return ConversationsResult(
        conversations: conversations,
        hasMore: conversationsList?['hasMore'] as bool? ?? false,
        cursor: conversationsList?['nextCursor'] as String?,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch conversations');
    }
  }

  /// Get or create direct conversation with another user
  Future<Conversation> getOrCreateDirectConversation(String otherUserId) async {
    try {
      final response = await _apiClient.post(
        '/conversations/direct',
        data: {'otherUserId': otherUserId},
      );

      final data = response.data as Map<String, dynamic>;
      return _mapToConversation(data['data'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'CREATE_ERROR', message: 'Failed to create conversation');
    }
  }

  /// Get conversation by ID
  Future<Conversation> getConversation(String conversationId) async {
    try {
      final response = await _apiClient.get('/conversations/$conversationId');
      final data = response.data as Map<String, dynamic>;
      return _mapToConversation(data['data'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch conversation');
    }
  }

  /// Get messages for a conversation
  Future<MessagesResult> getMessages({
    required String conversationId,
    int limit = 50,
    String? before,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'limit': limit,
      };
      if (before != null) queryParams['before'] = before;

      final response = await _apiClient.get(
        '/messages/$conversationId',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final messagesList = data['data'] as Map<String, dynamic>?;
      final messages = (messagesList?['messages'] as List? ?? [])
          .map((m) => _mapToMessage(m as Map<String, dynamic>))
          .toList();

      return MessagesResult(
        messages: messages,
        hasMore: messagesList?['hasMore'] as bool? ?? false,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch messages');
    }
  }

  /// Send a message
  Future<Message> sendMessage({
    required String conversationId,
    required String content,
    List<Map<String, dynamic>>? attachments,
  }) async {
    try {
      final body = <String, dynamic>{
        'content': content,
      };
      if (attachments != null) body['attachments'] = attachments;

      final response = await _apiClient.post(
        '/messages/$conversationId',
        data: body,
      );

      final data = response.data as Map<String, dynamic>;
      return _mapToMessage(data['data'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'SEND_ERROR', message: 'Failed to send message');
    }
  }

  /// Mark messages as read
  Future<void> markAsRead(String conversationId) async {
    try {
      await _apiClient.post('/messages/$conversationId/read');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'READ_ERROR', message: 'Failed to mark as read');
    }
  }

  /// Get total unread count
  Future<int> getTotalUnreadCount() async {
    try {
      final response = await _apiClient.get('/conversations/unread/total');
      final data = response.data as Map<String, dynamic>;
      return (data['data'] as Map<String, dynamic>?)?['totalUnreadCount'] as int? ?? 0;
    } on ApiError {
      rethrow;
    } catch (e) {
      return 0;
    }
  }

  /// Archive a conversation
  Future<void> archiveConversation(String conversationId) async {
    try {
      await _apiClient.post('/conversations/$conversationId/archive');
    } on ApiError {
      rethrow;
    }
  }

  /// Pin a conversation
  Future<void> pinConversation(String conversationId) async {
    try {
      await _apiClient.post('/conversations/$conversationId/pin');
    } on ApiError {
      rethrow;
    }
  }

  /// Mute a conversation
  Future<void> muteConversation(String conversationId, bool muted) async {
    try {
      await _apiClient.post(
        '/conversations/$conversationId/mute',
        data: {'muted': muted},
      );
    } on ApiError {
      rethrow;
    }
  }

  /// Map backend conversation to Conversation model
  Conversation _mapToConversation(Map<String, dynamic> conv) {
    final participants = conv['participants'] as List? ?? [];
    final otherParticipant = participants.isNotEmpty
        ? participants.first as Map<String, dynamic>?
        : null;

    final lastMsg = conv['lastMessage'] as Map<String, dynamic>?;

    return Conversation(
      id: conv['id'] as String,
      participantId: otherParticipant?['userId'] as String? ?? '',
      participantName: otherParticipant?['displayName'] as String? ??
          conv['title'] as String? ??
          '',
      participantAvatarUrl: otherParticipant?['avatarUrl'] as String?,
      jobTitle: conv['title'] as String?,
      lastMessage: lastMsg != null ? _mapToMessage(lastMsg) : null,
      unreadCount: conv['unreadCount'] as int? ?? 0,
      updatedAt: DateTime.tryParse(conv['updatedAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  /// Map backend message to Message model
  Message _mapToMessage(Map<String, dynamic> msg) {
    return Message(
      id: msg['id'] as String,
      conversationId: msg['conversationId'] as String,
      senderId: msg['senderId'] as String,
      content: msg['content'] as String? ?? '',
      sentAt:
          DateTime.tryParse(msg['createdAt'] as String? ?? '') ?? DateTime.now(),
      isRead: msg['isRead'] as bool? ?? false,
    );
  }
}

/// Result wrapper for conversations
class ConversationsResult {
  final List<Conversation> conversations;
  final bool hasMore;
  final String? cursor;

  const ConversationsResult({
    required this.conversations,
    required this.hasMore,
    this.cursor,
  });
}

/// Result wrapper for messages
class MessagesResult {
  final List<Message> messages;
  final bool hasMore;

  const MessagesResult({
    required this.messages,
    required this.hasMore,
  });
}

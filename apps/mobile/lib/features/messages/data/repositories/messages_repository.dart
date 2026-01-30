import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path/path.dart' as path;

import '../../../../core/network/api_client.dart';
import '../../domain/models/message.dart';

/// Attachment upload result
class AttachmentUploadResult {
  final String id;
  final String url;
  final String name;
  final String mimeType;
  final int size;

  const AttachmentUploadResult({
    required this.id,
    required this.url,
    required this.name,
    required this.mimeType,
    required this.size,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'url': url,
      'name': name,
      'mimeType': mimeType,
      'size': size,
    };
  }
}

/// Messages repository for fetching and managing conversations
class MessagesRepository {
  final ApiClient _apiClient;
  static const int _maxRetries = 3;
  static const Duration _retryDelay = Duration(seconds: 1);

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

  /// Send a message with retry logic
  Future<Message> sendMessage({
    required String conversationId,
    required String content,
    List<Map<String, dynamic>>? attachments,
    String? localId,
    int retryCount = 0,
  }) async {
    Exception? lastError;

    for (var attempt = 0;
        attempt <= retryCount && attempt < _maxRetries;
        attempt++) {
      try {
        final body = <String, dynamic>{
          'content': content,
        };
        if (attachments != null && attachments.isNotEmpty) {
          body['attachments'] = attachments;
        }
        if (localId != null) {
          body['localId'] = localId;
        }

        final response = await _apiClient.post(
          '/messages/$conversationId',
          data: body,
        );

        final data = response.data as Map<String, dynamic>;
        final message = _mapToMessage(data['data'] as Map<String, dynamic>);

        // Return with sent status
        return message.copyWith(
          status: MessageStatus.sent,
          localId: localId,
        );
      } on ApiError catch (e) {
        lastError = e;
        if (!_isRetryableError(e)) {
          rethrow;
        }
        if (attempt < _maxRetries - 1) {
          await Future.delayed(_retryDelay * (attempt + 1));
        }
      } catch (e) {
        lastError = e is Exception ? e : Exception(e.toString());
        if (attempt < _maxRetries - 1) {
          await Future.delayed(_retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError ??
        ApiError(code: 'SEND_ERROR', message: 'Failed to send message');
  }

  /// Check if an error is retryable
  bool _isRetryableError(ApiError error) {
    // Retry on network errors or server errors (5xx)
    return error.code == 'NETWORK_ERROR' ||
        error.code == 'TIMEOUT' ||
        (error.statusCode != null && error.statusCode! >= 500);
  }

  /// Upload an attachment file
  Future<AttachmentUploadResult> uploadAttachment({
    required String conversationId,
    required File file,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      final fileName = path.basename(file.path);
      final fileSize = await file.length();
      final mimeType = _getMimeType(fileName);

      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: fileName,
          contentType: DioMediaType.parse(mimeType),
        ),
      });

      final response = await _apiClient.post(
        '/messages/$conversationId/attachments',
        data: formData,
        onSendProgress: onProgress,
      );

      final data = response.data as Map<String, dynamic>;
      final attachment = data['data'] as Map<String, dynamic>;

      return AttachmentUploadResult(
        id: attachment['id'] as String,
        url: attachment['url'] as String,
        name: fileName,
        mimeType: mimeType,
        size: fileSize,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'UPLOAD_ERROR', message: 'Failed to upload attachment');
    }
  }

  /// Get MIME type from file extension
  String _getMimeType(String fileName) {
    final ext = path.extension(fileName).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.pdf':
        return 'application/pdf';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.txt':
        return 'text/plain';
      case '.mp4':
        return 'video/mp4';
      case '.mp3':
        return 'audio/mpeg';
      case '.wav':
        return 'audio/wav';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
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
      return (data['data'] as Map<String, dynamic>?)?['totalUnreadCount']
              as int? ??
          0;
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
      sentAt: DateTime.tryParse(msg['createdAt'] as String? ?? '') ??
          DateTime.now(),
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

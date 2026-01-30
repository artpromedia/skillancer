import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';

/// Message delivery status
enum MessageStatus {
  /// Message is queued locally (offline)
  pending,

  /// Message is being sent to the server
  sending,

  /// Message was sent to the server
  sent,

  /// Message was delivered to recipient's device
  delivered,

  /// Message was read by the recipient
  read,

  /// Message failed to send
  failed,
}

/// Message model
class Message extends Equatable {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final DateTime sentAt;
  final bool isRead;
  final MessageType type;
  final List<Attachment>? attachments;
  final MessageStatus status;
  final String? localId; // For tracking optimistic updates
  final int retryCount;
  final String? errorMessage;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    required this.sentAt,
    this.isRead = false,
    this.type = MessageType.text,
    this.attachments,
    this.status = MessageStatus.sent,
    this.localId,
    this.retryCount = 0,
    this.errorMessage,
  });

  /// Create a pending message for optimistic UI updates
  factory Message.pending({
    required String conversationId,
    required String senderId,
    required String content,
    MessageType type = MessageType.text,
    List<Attachment>? attachments,
  }) {
    final localId = const Uuid().v4();
    return Message(
      id: localId, // Temporary ID until server responds
      conversationId: conversationId,
      senderId: senderId,
      content: content,
      sentAt: DateTime.now(),
      type: type,
      attachments: attachments,
      status: MessageStatus.pending,
      localId: localId,
    );
  }

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String,
      sentAt: DateTime.parse(
          json['sentAt'] as String? ?? json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
      type: MessageType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => MessageType.text,
      ),
      attachments: json['attachments'] != null
          ? (json['attachments'] as List)
              .map((a) => Attachment.fromJson(a as Map<String, dynamic>))
              .toList()
          : null,
      status: json['status'] != null
          ? MessageStatus.values.firstWhere(
              (s) => s.name == json['status'],
              orElse: () => MessageStatus.sent,
            )
          : MessageStatus.sent,
      localId: json['localId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'conversationId': conversationId,
      'senderId': senderId,
      'content': content,
      'sentAt': sentAt.toIso8601String(),
      'isRead': isRead,
      'type': type.name,
      'attachments': attachments?.map((a) => a.toJson()).toList(),
      'status': status.name,
      'localId': localId,
    };
  }

  /// Create a copy with updated fields
  Message copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    String? content,
    DateTime? sentAt,
    bool? isRead,
    MessageType? type,
    List<Attachment>? attachments,
    MessageStatus? status,
    String? localId,
    int? retryCount,
    String? errorMessage,
  }) {
    return Message(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      content: content ?? this.content,
      sentAt: sentAt ?? this.sentAt,
      isRead: isRead ?? this.isRead,
      type: type ?? this.type,
      attachments: attachments ?? this.attachments,
      status: status ?? this.status,
      localId: localId ?? this.localId,
      retryCount: retryCount ?? this.retryCount,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  /// Check if this message failed and can be retried
  bool get canRetry => status == MessageStatus.failed && retryCount < 3;

  /// Check if this message is still being processed
  bool get isPending =>
      status == MessageStatus.pending || status == MessageStatus.sending;

  @override
  List<Object?> get props => [id, conversationId, sentAt, status, localId];
}

enum MessageType { text, file, image, system }

/// Attachment model
class Attachment extends Equatable {
  final String id;
  final String name;
  final String url;
  final String mimeType;
  final int size;

  const Attachment({
    required this.id,
    required this.name,
    required this.url,
    required this.mimeType,
    required this.size,
  });

  factory Attachment.fromJson(Map<String, dynamic> json) {
    return Attachment(
      id: json['id'] as String,
      name: json['name'] as String,
      url: json['url'] as String,
      mimeType: json['mimeType'] as String,
      size: json['size'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'url': url,
      'mimeType': mimeType,
      'size': size,
    };
  }

  @override
  List<Object?> get props => [id];
}

/// Conversation model
class Conversation extends Equatable {
  final String id;
  final String participantId;
  final String participantName;
  final String? participantAvatarUrl;
  final String? jobTitle;
  final Message? lastMessage;
  final int unreadCount;
  final DateTime updatedAt;

  const Conversation({
    required this.id,
    required this.participantId,
    required this.participantName,
    this.participantAvatarUrl,
    this.jobTitle,
    this.lastMessage,
    this.unreadCount = 0,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      participantId: json['participantId'] as String,
      participantName: json['participantName'] as String,
      participantAvatarUrl: json['participantAvatarUrl'] as String?,
      jobTitle: json['jobTitle'] as String?,
      lastMessage: json['lastMessage'] != null
          ? Message.fromJson(json['lastMessage'] as Map<String, dynamic>)
          : null,
      unreadCount: json['unreadCount'] as int? ?? 0,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'participantId': participantId,
      'participantName': participantName,
      'participantAvatarUrl': participantAvatarUrl,
      'jobTitle': jobTitle,
      'lastMessage': lastMessage?.toJson(),
      'unreadCount': unreadCount,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  @override
  List<Object?> get props => [id, unreadCount, updatedAt];
}

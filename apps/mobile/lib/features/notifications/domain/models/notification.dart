import 'package:equatable/equatable.dart';

/// App notification model
class AppNotification extends Equatable {
  final String id;
  final NotificationType type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool isRead;
  final String? actionUrl;
  final Map<String, dynamic>? data;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.isRead = false,
    this.actionUrl,
    this.data,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      type: NotificationType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => NotificationType.general,
      ),
      title: json['title'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
      actionUrl: json['actionUrl'] as String?,
      data: json['data'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.name,
      'title': title,
      'body': body,
      'createdAt': createdAt.toIso8601String(),
      'isRead': isRead,
      'actionUrl': actionUrl,
      'data': data,
    };
  }

  @override
  List<Object?> get props => [id, isRead];
}

enum NotificationType {
  general,
  proposal,
  job,
  message,
  contract,
  payment,
  milestone,
  review;

  String get displayName => switch (this) {
        NotificationType.general => 'General',
        NotificationType.proposal => 'Proposal',
        NotificationType.job => 'Job',
        NotificationType.message => 'Message',
        NotificationType.contract => 'Contract',
        NotificationType.payment => 'Payment',
        NotificationType.milestone => 'Milestone',
        NotificationType.review => 'Review',
      };
}

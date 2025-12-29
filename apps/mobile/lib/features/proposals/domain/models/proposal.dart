import 'package:equatable/equatable.dart';

/// Proposal status enum
enum ProposalStatus {
  draft,
  pending,
  viewed,
  shortlisted,
  accepted,
  rejected,
  withdrawn;

  String get displayName => switch (this) {
        ProposalStatus.draft => 'Draft',
        ProposalStatus.pending => 'Pending',
        ProposalStatus.viewed => 'Viewed',
        ProposalStatus.shortlisted => 'Shortlisted',
        ProposalStatus.accepted => 'Accepted',
        ProposalStatus.rejected => 'Rejected',
        ProposalStatus.withdrawn => 'Withdrawn',
      };

  bool get isActive =>
      this == ProposalStatus.pending ||
      this == ProposalStatus.viewed ||
      this == ProposalStatus.shortlisted;
}

/// Proposal model
class Proposal extends Equatable {
  final String id;
  final String jobId;
  final String jobTitle;
  final String clientName;
  final String? clientAvatarUrl;
  final double bidAmount;
  final String coverLetter;
  final ProposalStatus status;
  final DateTime submittedAt;
  final int? deliveryDays;
  final List<Milestone>? milestones;

  const Proposal({
    required this.id,
    required this.jobId,
    required this.jobTitle,
    required this.clientName,
    this.clientAvatarUrl,
    required this.bidAmount,
    required this.coverLetter,
    required this.status,
    required this.submittedAt,
    this.deliveryDays,
    this.milestones,
  });

  factory Proposal.fromJson(Map<String, dynamic> json) {
    return Proposal(
      id: json['id'] as String,
      jobId: json['jobId'] as String,
      jobTitle: json['jobTitle'] as String,
      clientName: json['clientName'] as String,
      clientAvatarUrl: json['clientAvatarUrl'] as String?,
      bidAmount: (json['bidAmount'] as num).toDouble(),
      coverLetter: json['coverLetter'] as String,
      status: ProposalStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => ProposalStatus.pending,
      ),
      submittedAt: DateTime.parse(json['submittedAt'] as String),
      deliveryDays: json['deliveryDays'] as int?,
      milestones: json['milestones'] != null
          ? (json['milestones'] as List)
              .map((m) => Milestone.fromJson(m as Map<String, dynamic>))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'jobId': jobId,
      'jobTitle': jobTitle,
      'clientName': clientName,
      'clientAvatarUrl': clientAvatarUrl,
      'bidAmount': bidAmount,
      'coverLetter': coverLetter,
      'status': status.name,
      'submittedAt': submittedAt.toIso8601String(),
      'deliveryDays': deliveryDays,
      'milestones': milestones?.map((m) => m.toJson()).toList(),
    };
  }

  @override
  List<Object?> get props => [id, jobId, status, submittedAt];
}

/// Milestone model
class Milestone extends Equatable {
  final String id;
  final String title;
  final double amount;
  final int durationDays;
  final String? description;

  const Milestone({
    required this.id,
    required this.title,
    required this.amount,
    required this.durationDays,
    this.description,
  });

  factory Milestone.fromJson(Map<String, dynamic> json) {
    return Milestone(
      id: json['id'] as String,
      title: json['title'] as String,
      amount: (json['amount'] as num).toDouble(),
      durationDays: json['durationDays'] as int,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'amount': amount,
      'durationDays': durationDays,
      'description': description,
    };
  }

  @override
  List<Object?> get props => [id, title, amount];
}

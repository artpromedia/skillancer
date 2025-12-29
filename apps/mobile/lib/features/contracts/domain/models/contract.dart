import 'package:equatable/equatable.dart';

/// Contract status enum
enum ContractStatus {
  pending,
  active,
  paused,
  completed,
  cancelled,
  disputed;

  String get displayName => switch (this) {
        ContractStatus.pending => 'Pending',
        ContractStatus.active => 'Active',
        ContractStatus.paused => 'Paused',
        ContractStatus.completed => 'Completed',
        ContractStatus.cancelled => 'Cancelled',
        ContractStatus.disputed => 'Disputed',
      };
}

/// Contract model
class Contract extends Equatable {
  final String id;
  final String title;
  final String clientId;
  final String clientName;
  final String? clientAvatarUrl;
  final ContractStatus status;
  final double totalAmount;
  final double paidAmount;
  final double hourlyRate;
  final DateTime startDate;
  final DateTime? endDate;
  final String? description;
  final List<ContractMilestone>? milestones;

  const Contract({
    required this.id,
    required this.title,
    required this.clientId,
    required this.clientName,
    this.clientAvatarUrl,
    required this.status,
    required this.totalAmount,
    required this.paidAmount,
    this.hourlyRate = 0,
    required this.startDate,
    this.endDate,
    this.description,
    this.milestones,
  });

  double get progress => totalAmount > 0 ? paidAmount / totalAmount : 0;

  factory Contract.fromJson(Map<String, dynamic> json) {
    return Contract(
      id: json['id'] as String,
      title: json['title'] as String,
      clientId: json['clientId'] as String,
      clientName: json['clientName'] as String,
      clientAvatarUrl: json['clientAvatarUrl'] as String?,
      status: ContractStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => ContractStatus.pending,
      ),
      totalAmount: (json['totalAmount'] as num).toDouble(),
      paidAmount: (json['paidAmount'] as num).toDouble(),
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : null,
      description: json['description'] as String?,
      milestones: json['milestones'] != null
          ? (json['milestones'] as List)
              .map((m) => ContractMilestone.fromJson(m as Map<String, dynamic>))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'clientId': clientId,
      'clientName': clientName,
      'clientAvatarUrl': clientAvatarUrl,
      'status': status.name,
      'totalAmount': totalAmount,
      'paidAmount': paidAmount,
      'hourlyRate': hourlyRate,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'description': description,
      'milestones': milestones?.map((m) => m.toJson()).toList(),
    };
  }

  @override
  List<Object?> get props => [id, status, paidAmount];
}

/// Contract milestone status
enum MilestoneStatus {
  pending,
  inProgress,
  submitted,
  approved,
  rejected,
  paid;

  String get displayName => switch (this) {
        MilestoneStatus.pending => 'Pending',
        MilestoneStatus.inProgress => 'In Progress',
        MilestoneStatus.submitted => 'Submitted',
        MilestoneStatus.approved => 'Approved',
        MilestoneStatus.rejected => 'Rejected',
        MilestoneStatus.paid => 'Paid',
      };
}

/// Contract milestone model
class ContractMilestone extends Equatable {
  final String id;
  final String title;
  final double amount;
  final MilestoneStatus status;
  final DateTime? dueDate;
  final String? description;

  const ContractMilestone({
    required this.id,
    required this.title,
    required this.amount,
    required this.status,
    this.dueDate,
    this.description,
  });

  factory ContractMilestone.fromJson(Map<String, dynamic> json) {
    return ContractMilestone(
      id: json['id'] as String,
      title: json['title'] as String,
      amount: (json['amount'] as num).toDouble(),
      status: MilestoneStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => MilestoneStatus.pending,
      ),
      dueDate: json['dueDate'] != null
          ? DateTime.parse(json['dueDate'] as String)
          : null,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'amount': amount,
      'status': status.name,
      'dueDate': dueDate?.toIso8601String(),
      'description': description,
    };
  }

  @override
  List<Object?> get props => [id, status];
}

import 'package:equatable/equatable.dart';
import 'executive_profile.dart';

/// Engagement status for executive-client relationships
enum EngagementStatus {
  proposal,
  negotiating,
  pendingApproval,
  active,
  paused,
  completed,
  terminated;

  String get displayName => switch (this) {
        EngagementStatus.proposal => 'Proposal',
        EngagementStatus.negotiating => 'Negotiating',
        EngagementStatus.pendingApproval => 'Pending Approval',
        EngagementStatus.active => 'Active',
        EngagementStatus.paused => 'Paused',
        EngagementStatus.completed => 'Completed',
        EngagementStatus.terminated => 'Terminated',
      };

  bool get isActive => this == EngagementStatus.active;
  bool get isPending => this == EngagementStatus.proposal ||
                        this == EngagementStatus.negotiating ||
                        this == EngagementStatus.pendingApproval;
  bool get isEnded => this == EngagementStatus.completed ||
                      this == EngagementStatus.terminated;

  String get apiValue => switch (this) {
        EngagementStatus.proposal => 'PROPOSAL',
        EngagementStatus.negotiating => 'NEGOTIATING',
        EngagementStatus.pendingApproval => 'PENDING_APPROVAL',
        EngagementStatus.active => 'ACTIVE',
        EngagementStatus.paused => 'PAUSED',
        EngagementStatus.completed => 'COMPLETED',
        EngagementStatus.terminated => 'TERMINATED',
      };

  static EngagementStatus fromApiValue(String value) {
    return EngagementStatus.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => EngagementStatus.proposal,
    );
  }
}

/// Billing cycle for engagements
enum BillingCycle {
  weekly,
  biweekly,
  monthly,
  quarterly;

  String get displayName => switch (this) {
        BillingCycle.weekly => 'Weekly',
        BillingCycle.biweekly => 'Bi-weekly',
        BillingCycle.monthly => 'Monthly',
        BillingCycle.quarterly => 'Quarterly',
      };

  String get apiValue => name.toUpperCase();

  static BillingCycle fromApiValue(String value) {
    return BillingCycle.values.firstWhere(
      (e) => e.apiValue == value.toUpperCase(),
      orElse: () => BillingCycle.monthly,
    );
  }
}

/// Key result for an objective
class KeyResult extends Equatable {
  final String id;
  final String description;
  final double targetValue;
  final double? currentValue;
  final String? unit;
  final bool completed;

  const KeyResult({
    required this.id,
    required this.description,
    required this.targetValue,
    this.currentValue,
    this.unit,
    this.completed = false,
  });

  double get progress {
    if (currentValue == null || targetValue == 0) return 0;
    return (currentValue! / targetValue).clamp(0, 1);
  }

  factory KeyResult.fromJson(Map<String, dynamic> json) {
    return KeyResult(
      id: json['id'] as String? ?? '',
      description: json['description'] as String? ?? '',
      targetValue: (json['targetValue'] as num?)?.toDouble() ?? 0,
      currentValue: (json['currentValue'] as num?)?.toDouble(),
      unit: json['unit'] as String?,
      completed: json['completed'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'description': description,
        'targetValue': targetValue,
        'currentValue': currentValue,
        'unit': unit,
        'completed': completed,
      };

  @override
  List<Object?> get props => [id, description, targetValue, currentValue, completed];
}

/// Objective (OKR) for an engagement
class ExecutiveObjective extends Equatable {
  final String id;
  final String title;
  final String? description;
  final List<KeyResult> keyResults;
  final DateTime? dueDate;
  final bool completed;

  const ExecutiveObjective({
    required this.id,
    required this.title,
    this.description,
    this.keyResults = const [],
    this.dueDate,
    this.completed = false,
  });

  double get overallProgress {
    if (keyResults.isEmpty) return completed ? 1.0 : 0.0;
    final completedCount = keyResults.where((kr) => kr.completed).length;
    return completedCount / keyResults.length;
  }

  factory ExecutiveObjective.fromJson(Map<String, dynamic> json) {
    return ExecutiveObjective(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      keyResults: (json['keyResults'] as List<dynamic>?)
              ?.map((e) => KeyResult.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      dueDate: json['dueDate'] != null
          ? DateTime.parse(json['dueDate'] as String)
          : null,
      completed: json['completed'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'keyResults': keyResults.map((e) => e.toJson()).toList(),
        'dueDate': dueDate?.toIso8601String(),
        'completed': completed,
      };

  @override
  List<Object?> get props => [id, title, keyResults, dueDate, completed];
}

/// Success metric for an engagement
class SuccessMetric extends Equatable {
  final String name;
  final String target;
  final String? measurement;
  final String? currentValue;

  const SuccessMetric({
    required this.name,
    required this.target,
    this.measurement,
    this.currentValue,
  });

  factory SuccessMetric.fromJson(Map<String, dynamic> json) {
    return SuccessMetric(
      name: json['name'] as String? ?? '',
      target: json['target'] as String? ?? '',
      measurement: json['measurement'] as String?,
      currentValue: json['currentValue'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'target': target,
        'measurement': measurement,
        'currentValue': currentValue,
      };

  @override
  List<Object?> get props => [name, target, measurement, currentValue];
}

/// Executive engagement model
class ExecutiveEngagement extends Equatable {
  final String id;
  final String executiveProfileId;
  final String clientTenantId;
  final String clientUserId;
  final ExecutiveType role;
  final String title;
  final String? description;
  final EngagementStatus status;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? expectedEndDate;
  final int hoursPerWeek;

  // Financials
  final double? monthlyRetainer;
  final double? hourlyRate;
  final BillingCycle billingCycle;
  final double? equityPercentage;

  // Goals
  final List<ExecutiveObjective> objectives;
  final List<SuccessMetric> successMetrics;

  // Tracking
  final double totalHoursLogged;
  final DateTime? lastActivityAt;

  // Approval
  final String? approvalStatus;
  final List<String> approvedBy;
  final DateTime? approvedAt;

  // Client info (populated from relations)
  final String? clientName;
  final String? clientLogoUrl;

  final DateTime createdAt;
  final DateTime updatedAt;

  const ExecutiveEngagement({
    required this.id,
    required this.executiveProfileId,
    required this.clientTenantId,
    required this.clientUserId,
    required this.role,
    required this.title,
    this.description,
    required this.status,
    this.startDate,
    this.endDate,
    this.expectedEndDate,
    this.hoursPerWeek = 10,
    this.monthlyRetainer,
    this.hourlyRate,
    this.billingCycle = BillingCycle.monthly,
    this.equityPercentage,
    this.objectives = const [],
    this.successMetrics = const [],
    this.totalHoursLogged = 0,
    this.lastActivityAt,
    this.approvalStatus,
    this.approvedBy = const [],
    this.approvedAt,
    this.clientName,
    this.clientLogoUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isActive => status == EngagementStatus.active;

  String get compensationDisplay {
    if (monthlyRetainer != null) {
      return '\$${(monthlyRetainer! / 1000).toStringAsFixed(0)}k/mo';
    } else if (hourlyRate != null) {
      return '\$${hourlyRate!.toStringAsFixed(0)}/hr';
    }
    return 'TBD';
  }

  double get objectivesProgress {
    if (objectives.isEmpty) return 0;
    final total = objectives.fold<double>(
      0,
      (sum, obj) => sum + obj.overallProgress,
    );
    return total / objectives.length;
  }

  int get completedObjectives => objectives.where((o) => o.completed).length;

  factory ExecutiveEngagement.fromJson(Map<String, dynamic> json) {
    return ExecutiveEngagement(
      id: json['id'] as String,
      executiveProfileId: json['executiveProfileId'] as String,
      clientTenantId: json['clientTenantId'] as String,
      clientUserId: json['clientUserId'] as String,
      role: ExecutiveType.fromApiValue(json['role'] as String),
      title: json['title'] as String,
      description: json['description'] as String?,
      status: EngagementStatus.fromApiValue(json['status'] as String),
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : null,
      expectedEndDate: json['expectedEndDate'] != null
          ? DateTime.parse(json['expectedEndDate'] as String)
          : null,
      hoursPerWeek: json['hoursPerWeek'] as int? ?? 10,
      monthlyRetainer: (json['monthlyRetainer'] as num?)?.toDouble(),
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble(),
      billingCycle: BillingCycle.fromApiValue(json['billingCycle'] as String? ?? 'MONTHLY'),
      equityPercentage: (json['equityPercentage'] as num?)?.toDouble(),
      objectives: (json['objectives'] as List<dynamic>?)
              ?.map((e) => ExecutiveObjective.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      successMetrics: (json['successMetrics'] as List<dynamic>?)
              ?.map((e) => SuccessMetric.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      totalHoursLogged: (json['totalHoursLogged'] as num?)?.toDouble() ?? 0,
      lastActivityAt: json['lastActivityAt'] != null
          ? DateTime.parse(json['lastActivityAt'] as String)
          : null,
      approvalStatus: json['approvalStatus'] as String?,
      approvedBy: List<String>.from(json['approvedBy'] ?? []),
      approvedAt: json['approvedAt'] != null
          ? DateTime.parse(json['approvedAt'] as String)
          : null,
      clientName: json['clientTenant']?['name'] as String? ?? json['clientName'] as String?,
      clientLogoUrl: json['clientTenant']?['logoUrl'] as String? ?? json['clientLogoUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'executiveProfileId': executiveProfileId,
        'clientTenantId': clientTenantId,
        'clientUserId': clientUserId,
        'role': role.apiValue,
        'title': title,
        'description': description,
        'status': status.apiValue,
        'startDate': startDate?.toIso8601String(),
        'endDate': endDate?.toIso8601String(),
        'expectedEndDate': expectedEndDate?.toIso8601String(),
        'hoursPerWeek': hoursPerWeek,
        'monthlyRetainer': monthlyRetainer,
        'hourlyRate': hourlyRate,
        'billingCycle': billingCycle.apiValue,
        'equityPercentage': equityPercentage,
        'objectives': objectives.map((e) => e.toJson()).toList(),
        'successMetrics': successMetrics.map((e) => e.toJson()).toList(),
      };

  @override
  List<Object?> get props => [id, executiveProfileId, clientTenantId, status];
}

/// Time entry for an engagement
class ExecutiveTimeEntry extends Equatable {
  final String id;
  final String engagementId;
  final DateTime date;
  final double hours;
  final String? description;
  final String? category;
  final bool billable;
  final bool billed;
  final String? invoiceId;
  final DateTime createdAt;

  const ExecutiveTimeEntry({
    required this.id,
    required this.engagementId,
    required this.date,
    required this.hours,
    this.description,
    this.category,
    this.billable = true,
    this.billed = false,
    this.invoiceId,
    required this.createdAt,
  });

  factory ExecutiveTimeEntry.fromJson(Map<String, dynamic> json) {
    return ExecutiveTimeEntry(
      id: json['id'] as String,
      engagementId: json['engagementId'] as String,
      date: DateTime.parse(json['date'] as String),
      hours: (json['hours'] as num).toDouble(),
      description: json['description'] as String?,
      category: json['category'] as String?,
      billable: json['billable'] as bool? ?? true,
      billed: json['billed'] as bool? ?? false,
      invoiceId: json['invoiceId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'engagementId': engagementId,
        'date': date.toIso8601String().split('T')[0],
        'hours': hours,
        'description': description,
        'category': category,
        'billable': billable,
      };

  @override
  List<Object?> get props => [id, engagementId, date, hours];
}

/// Milestone for an engagement
class ExecutiveMilestone extends Equatable {
  final String id;
  final String engagementId;
  final String title;
  final String? description;
  final DateTime? dueDate;
  final DateTime? completedAt;
  final String status; // PENDING, IN_PROGRESS, COMPLETED, BLOCKED
  final List<String> deliverables;
  final String? successCriteria;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ExecutiveMilestone({
    required this.id,
    required this.engagementId,
    required this.title,
    this.description,
    this.dueDate,
    this.completedAt,
    this.status = 'PENDING',
    this.deliverables = const [],
    this.successCriteria,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isCompleted => status == 'COMPLETED';
  bool get isOverdue => dueDate != null &&
                        !isCompleted &&
                        dueDate!.isBefore(DateTime.now());

  factory ExecutiveMilestone.fromJson(Map<String, dynamic> json) {
    return ExecutiveMilestone(
      id: json['id'] as String,
      engagementId: json['engagementId'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      dueDate: json['dueDate'] != null
          ? DateTime.parse(json['dueDate'] as String)
          : null,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      status: json['status'] as String? ?? 'PENDING',
      deliverables: (json['deliverables'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      successCriteria: json['successCriteria'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'engagementId': engagementId,
        'title': title,
        'description': description,
        'dueDate': dueDate?.toIso8601String(),
        'status': status,
        'deliverables': deliverables,
        'successCriteria': successCriteria,
      };

  @override
  List<Object?> get props => [id, engagementId, title, status];
}

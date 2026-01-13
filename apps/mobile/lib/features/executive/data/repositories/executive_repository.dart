import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/models/engagement.dart';
import '../../domain/models/executive_profile.dart';
import '../../domain/models/executive_reference.dart';

/// Search filters for executives
class ExecutiveSearchFilters {
  final ExecutiveType? executiveType;
  final List<String>? industries;
  final List<String>? specializations;
  final List<String>? companyStages;
  final int? minExperience;
  final double? maxHourlyRate;
  final double? maxMonthlyRetainer;
  final bool? availableNow;
  final bool? hasBackgroundCheck;
  final bool? boardExperience;
  final bool? publicCompanyExp;
  final int page;
  final int limit;

  const ExecutiveSearchFilters({
    this.executiveType,
    this.industries,
    this.specializations,
    this.companyStages,
    this.minExperience,
    this.maxHourlyRate,
    this.maxMonthlyRetainer,
    this.availableNow,
    this.hasBackgroundCheck,
    this.boardExperience,
    this.publicCompanyExp,
    this.page = 1,
    this.limit = 20,
  });

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (executiveType != null)
      params['executiveType'] = executiveType!.apiValue;
    if (industries != null && industries!.isNotEmpty) {
      params['industries'] = industries!.join(',');
    }
    if (specializations != null && specializations!.isNotEmpty) {
      params['specializations'] = specializations!.join(',');
    }
    if (companyStages != null && companyStages!.isNotEmpty) {
      params['companyStages'] = companyStages!.join(',');
    }
    if (minExperience != null) params['minExperience'] = minExperience;
    if (maxHourlyRate != null) params['maxHourlyRate'] = maxHourlyRate;
    if (maxMonthlyRetainer != null)
      params['maxMonthlyRetainer'] = maxMonthlyRetainer;
    if (availableNow != null) params['availableNow'] = availableNow;
    if (hasBackgroundCheck != null)
      params['hasBackgroundCheck'] = hasBackgroundCheck;
    if (boardExperience != null) params['boardExperience'] = boardExperience;
    if (publicCompanyExp != null) params['publicCompanyExp'] = publicCompanyExp;
    return params;
  }
}

/// Paginated response for executives
class PaginatedExecutives {
  final List<ExecutiveProfile> executives;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  const PaginatedExecutives({
    required this.executives,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  bool get hasMore => page < totalPages;

  factory PaginatedExecutives.fromJson(Map<String, dynamic> json) {
    return PaginatedExecutives(
      executives: (json['data'] as List<dynamic>)
          .map((e) => ExecutiveProfile.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

/// Executive statistics
class ExecutiveStats {
  final int totalEngagements;
  final int activeEngagements;
  final double totalHoursLogged;
  final double totalEarnings;
  final int completedObjectives;
  final int upcomingMilestones;
  final double avgRating;
  final int profileViews;

  const ExecutiveStats({
    this.totalEngagements = 0,
    this.activeEngagements = 0,
    this.totalHoursLogged = 0,
    this.totalEarnings = 0,
    this.completedObjectives = 0,
    this.upcomingMilestones = 0,
    this.avgRating = 0,
    this.profileViews = 0,
  });

  factory ExecutiveStats.fromJson(Map<String, dynamic> json) {
    return ExecutiveStats(
      totalEngagements: json['totalEngagements'] as int? ?? 0,
      activeEngagements: json['activeEngagements'] as int? ?? 0,
      totalHoursLogged: (json['totalHoursLogged'] as num?)?.toDouble() ?? 0,
      totalEarnings: (json['totalEarnings'] as num?)?.toDouble() ?? 0,
      completedObjectives: json['completedObjectives'] as int? ?? 0,
      upcomingMilestones: json['upcomingMilestones'] as int? ?? 0,
      avgRating: (json['avgRating'] as num?)?.toDouble() ?? 0,
      profileViews: json['profileViews'] as int? ?? 0,
    );
  }
}

/// Repository for executive-related API operations
class ExecutiveRepository {
  final ApiClient _apiClient;
  static const String _basePath = '/api/v1/executive';

  ExecutiveRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  // ============== Profile Operations ==============

  /// Get current user's executive profile
  Future<ExecutiveProfile?> getMyProfile() async {
    try {
      final response = await _apiClient.get('$_basePath/profile/me');
      if (response.data != null) {
        return ExecutiveProfile.fromJson(response.data as Map<String, dynamic>);
      }
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Get executive profile by ID
  Future<ExecutiveProfile> getProfileById(String id) async {
    final response = await _apiClient.get('$_basePath/profile/$id');
    return ExecutiveProfile.fromJson(response.data as Map<String, dynamic>);
  }

  /// Create executive profile
  Future<ExecutiveProfile> createProfile({
    required ExecutiveType executiveType,
    required String headline,
    String? executiveSummary,
    int? yearsExecutiveExp,
    List<String>? industries,
    List<String>? specializations,
    List<String>? companyStagesExpertise,
  }) async {
    final response = await _apiClient.post('$_basePath/profile', data: {
      'executiveType': executiveType.apiValue,
      'headline': headline,
      if (executiveSummary != null) 'executiveSummary': executiveSummary,
      if (yearsExecutiveExp != null) 'yearsExecutiveExp': yearsExecutiveExp,
      if (industries != null) 'industries': industries,
      if (specializations != null) 'specializations': specializations,
      if (companyStagesExpertise != null)
        'companyStagesExpertise': companyStagesExpertise,
    });
    return ExecutiveProfile.fromJson(response.data as Map<String, dynamic>);
  }

  /// Update executive profile
  Future<ExecutiveProfile> updateProfile(Map<String, dynamic> updates) async {
    final response =
        await _apiClient.patch('$_basePath/profile', data: updates);
    return ExecutiveProfile.fromJson(response.data as Map<String, dynamic>);
  }

  /// Search approved executives
  Future<PaginatedExecutives> searchExecutives(
      ExecutiveSearchFilters filters) async {
    final response = await _apiClient.get(
      '$_basePath/search',
      queryParameters: filters.toQueryParams(),
    );
    return PaginatedExecutives.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get featured executives
  Future<List<ExecutiveProfile>> getFeaturedExecutives() async {
    final response = await _apiClient.get('$_basePath/featured');
    return (response.data as List<dynamic>)
        .map((e) => ExecutiveProfile.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Add reference for vetting
  Future<ExecutiveReference> addReference({
    required String referenceName,
    required String referenceTitle,
    required String referenceCompany,
    required String referenceEmail,
    String? referencePhone,
    required String relationshipType,
  }) async {
    final response =
        await _apiClient.post('$_basePath/profile/references', data: {
      'referenceName': referenceName,
      'referenceTitle': referenceTitle,
      'referenceCompany': referenceCompany,
      'referenceEmail': referenceEmail,
      if (referencePhone != null) 'referencePhone': referencePhone,
      'relationshipType': relationshipType,
    });
    return ExecutiveReference.fromJson(response.data as Map<String, dynamic>);
  }

  // ============== Engagement Operations ==============

  /// Get engagement by ID
  Future<ExecutiveEngagement> getEngagement(String id) async {
    final response = await _apiClient.get('$_basePath/engagements/$id');
    return ExecutiveEngagement.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get engagements for executive
  Future<List<ExecutiveEngagement>> getExecutiveEngagements({
    required String executiveProfileId,
    EngagementStatus? status,
  }) async {
    final response = await _apiClient.get(
      '$_basePath/engagements/executive/$executiveProfileId',
      queryParameters: status != null ? {'status': status.apiValue} : null,
    );
    return (response.data as List<dynamic>)
        .map((e) => ExecutiveEngagement.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Get engagements for client
  Future<List<ExecutiveEngagement>> getClientEngagements({
    required String clientTenantId,
    EngagementStatus? status,
  }) async {
    final response = await _apiClient.get(
      '$_basePath/engagements/client/$clientTenantId',
      queryParameters: status != null ? {'status': status.apiValue} : null,
    );
    return (response.data as List<dynamic>)
        .map((e) => ExecutiveEngagement.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Create engagement proposal
  Future<ExecutiveEngagement> createEngagement({
    required String executiveProfileId,
    required String clientTenantId,
    required ExecutiveType role,
    required String title,
    String? description,
    int? hoursPerWeek,
    double? monthlyRetainer,
    double? hourlyRate,
    DateTime? expectedEndDate,
  }) async {
    final response = await _apiClient.post('$_basePath/engagements', data: {
      'executiveProfileId': executiveProfileId,
      'clientTenantId': clientTenantId,
      'role': role.apiValue,
      'title': title,
      if (description != null) 'description': description,
      if (hoursPerWeek != null) 'hoursPerWeek': hoursPerWeek,
      if (monthlyRetainer != null) 'monthlyRetainer': monthlyRetainer,
      if (hourlyRate != null) 'hourlyRate': hourlyRate,
      if (expectedEndDate != null)
        'expectedEndDate': expectedEndDate.toIso8601String(),
    });
    return ExecutiveEngagement.fromJson(response.data as Map<String, dynamic>);
  }

  /// Update engagement
  Future<ExecutiveEngagement> updateEngagement(
    String id,
    Map<String, dynamic> updates,
  ) async {
    final response =
        await _apiClient.patch('$_basePath/engagements/$id', data: updates);
    return ExecutiveEngagement.fromJson(response.data as Map<String, dynamic>);
  }

  /// Approve engagement
  Future<ExecutiveEngagement> approveEngagement(String id) async {
    final response =
        await _apiClient.post('$_basePath/engagements/$id/approve');
    return ExecutiveEngagement.fromJson(response.data as Map<String, dynamic>);
  }

  /// End engagement
  Future<ExecutiveEngagement> endEngagement(String id) async {
    final response = await _apiClient.post('$_basePath/engagements/$id/end');
    return ExecutiveEngagement.fromJson(response.data as Map<String, dynamic>);
  }

  // ============== Time Entry Operations ==============

  /// Log time entry
  Future<ExecutiveTimeEntry> logTimeEntry({
    required String engagementId,
    required DateTime date,
    required double hours,
    String? description,
    String? category,
    bool billable = true,
  }) async {
    final response = await _apiClient.post(
      '$_basePath/engagements/$engagementId/time-entries',
      data: {
        'date': date.toIso8601String().split('T')[0],
        'hours': hours,
        if (description != null) 'description': description,
        if (category != null) 'category': category,
        'billable': billable,
      },
    );
    return ExecutiveTimeEntry.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get time entries for engagement
  Future<List<ExecutiveTimeEntry>> getTimeEntries({
    required String engagementId,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final response = await _apiClient.get(
      '$_basePath/engagements/$engagementId/time-entries',
      queryParameters: {
        if (startDate != null)
          'startDate': startDate.toIso8601String().split('T')[0],
        if (endDate != null) 'endDate': endDate.toIso8601String().split('T')[0],
      },
    );
    return (response.data as List<dynamic>)
        .map((e) => ExecutiveTimeEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ============== Milestone Operations ==============

  /// Create milestone
  Future<ExecutiveMilestone> createMilestone({
    required String engagementId,
    required String title,
    String? description,
    DateTime? dueDate,
    List<String>? deliverables,
    String? successCriteria,
  }) async {
    final response = await _apiClient.post(
      '$_basePath/engagements/$engagementId/milestones',
      data: {
        'title': title,
        if (description != null) 'description': description,
        if (dueDate != null) 'dueDate': dueDate.toIso8601String(),
        if (deliverables != null) 'deliverables': deliverables,
        if (successCriteria != null) 'successCriteria': successCriteria,
      },
    );
    return ExecutiveMilestone.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get milestones for engagement
  Future<List<ExecutiveMilestone>> getMilestones(String engagementId) async {
    final response =
        await _apiClient.get('$_basePath/engagements/$engagementId/milestones');
    return (response.data as List<dynamic>)
        .map((e) => ExecutiveMilestone.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Update milestone status
  Future<ExecutiveMilestone> updateMilestoneStatus({
    required String milestoneId,
    required String status,
  }) async {
    final response = await _apiClient.patch(
      '$_basePath/milestones/$milestoneId/status',
      data: {'status': status},
    );
    return ExecutiveMilestone.fromJson(response.data as Map<String, dynamic>);
  }

  // ============== Stats ==============

  /// Get executive stats
  Future<ExecutiveStats> getStats({String? executiveProfileId}) async {
    final response = await _apiClient.get(
      '$_basePath/stats',
      queryParameters: executiveProfileId != null
          ? {'executiveProfileId': executiveProfileId}
          : null,
    );
    return ExecutiveStats.fromJson(response.data as Map<String, dynamic>);
  }
}

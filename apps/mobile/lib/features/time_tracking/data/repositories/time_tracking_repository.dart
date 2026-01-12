import '../../../core/network/api_client.dart';
import '../domain/models/time_entry.dart';

/// Time tracking repository for managing time logs
class TimeTrackingRepository {
  final ApiClient _apiClient;

  TimeTrackingRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get time entries for a contract
  Future<List<TimeEntry>> getTimeEntries(String contractId) async {
    try {
      final response = await _apiClient.get('/time-logs/contract/$contractId');
      final data = response.data as Map<String, dynamic>;
      final timeLogs = (data['timeLogs'] as List? ?? [])
          .map((t) => _mapToTimeEntry(t as Map<String, dynamic>))
          .toList();
      return timeLogs;
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch time entries');
    }
  }

  /// Get time entry by ID
  Future<TimeEntry> getTimeEntry(String timeEntryId) async {
    try {
      final response = await _apiClient.get('/time-logs/$timeEntryId');
      final data = response.data as Map<String, dynamic>;
      return _mapToTimeEntry(data);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch time entry');
    }
  }

  /// Create a new time entry
  Future<TimeEntry> createTimeEntry({
    required String contractId,
    required DateTime startTime,
    DateTime? endTime,
    int? duration,
    required double hourlyRate,
    String? description,
  }) async {
    try {
      final body = <String, dynamic>{
        'contractId': contractId,
        'startTime': startTime.toIso8601String(),
        'hourlyRate': hourlyRate,
      };
      if (endTime != null) body['endTime'] = endTime.toIso8601String();
      if (duration != null) body['duration'] = duration;
      if (description != null) body['description'] = description;

      final response = await _apiClient.post('/time-logs', data: body);
      return _mapToTimeEntry(response.data as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'CREATE_ERROR', message: 'Failed to create time entry');
    }
  }

  /// Update a time entry
  Future<TimeEntry> updateTimeEntry({
    required String timeEntryId,
    DateTime? startTime,
    DateTime? endTime,
    int? duration,
    String? description,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (startTime != null) body['startTime'] = startTime.toIso8601String();
      if (endTime != null) body['endTime'] = endTime.toIso8601String();
      if (duration != null) body['duration'] = duration;
      if (description != null) body['description'] = description;

      final response =
          await _apiClient.patch('/time-logs/$timeEntryId', data: body);
      return _mapToTimeEntry(response.data as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'UPDATE_ERROR', message: 'Failed to update time entry');
    }
  }

  /// Delete a time entry
  Future<void> deleteTimeEntry(String timeEntryId) async {
    try {
      await _apiClient.delete('/time-logs/$timeEntryId');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'DELETE_ERROR', message: 'Failed to delete time entry');
    }
  }

  /// Get time log summary for a contract
  Future<TimeLogSummary> getTimeLogSummary(String contractId) async {
    try {
      final response =
          await _apiClient.get('/time-logs/contract/$contractId/summary');
      final data = response.data as Map<String, dynamic>;
      return TimeLogSummary.fromJson(data);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch time summary');
    }
  }

  /// Get pending time logs for client review
  Future<List<TimeEntry>> getPendingForReview(String contractId) async {
    try {
      final response =
          await _apiClient.get('/time-logs/contract/$contractId/pending');
      final data = response.data as Map<String, dynamic>;
      final timeLogs = (data['timeLogs'] as List? ?? [])
          .map((t) => _mapToTimeEntry(t as Map<String, dynamic>))
          .toList();
      return timeLogs;
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch pending time logs');
    }
  }

  /// Map backend time log to TimeEntry model
  TimeEntry _mapToTimeEntry(Map<String, dynamic> log) {
    final contract = log['contract'] as Map<String, dynamic>?;

    return TimeEntry(
      id: log['id'] as String,
      contractId: log['contractId'] as String,
      contractTitle: contract?['title'] as String? ?? '',
      startTime: DateTime.parse(log['startTime'] as String),
      endTime: log['endTime'] != null
          ? DateTime.parse(log['endTime'] as String)
          : null,
      description: log['description'] as String?,
      memo: log['memo'] as String?,
      isBillable: log['status'] == 'APPROVED' || log['status'] == 'BILLED',
    );
  }
}

/// Time log summary
class TimeLogSummary {
  final int totalMinutes;
  final double totalAmount;
  final int pendingMinutes;
  final double pendingAmount;
  final int approvedMinutes;
  final double approvedAmount;
  final int billedMinutes;
  final double billedAmount;

  const TimeLogSummary({
    required this.totalMinutes,
    required this.totalAmount,
    required this.pendingMinutes,
    required this.pendingAmount,
    required this.approvedMinutes,
    required this.approvedAmount,
    required this.billedMinutes,
    required this.billedAmount,
  });

  factory TimeLogSummary.fromJson(Map<String, dynamic> json) {
    return TimeLogSummary(
      totalMinutes: json['totalMinutes'] as int? ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      pendingMinutes: json['pendingMinutes'] as int? ?? 0,
      pendingAmount: (json['pendingAmount'] as num?)?.toDouble() ?? 0,
      approvedMinutes: json['approvedMinutes'] as int? ?? 0,
      approvedAmount: (json['approvedAmount'] as num?)?.toDouble() ?? 0,
      billedMinutes: json['billedMinutes'] as int? ?? 0,
      billedAmount: (json['billedAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}

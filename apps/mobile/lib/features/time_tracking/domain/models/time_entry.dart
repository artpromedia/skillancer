import 'package:equatable/equatable.dart';

/// Time entry model
class TimeEntry extends Equatable {
  final String id;
  final String contractId;
  final String contractTitle;
  final DateTime startTime;
  final DateTime? endTime;
  final int? durationSeconds;
  final String? description;
  final String? memo;
  final bool isBillable;
  final bool isApproved;

  const TimeEntry({
    required this.id,
    required this.contractId,
    required this.contractTitle,
    required this.startTime,
    this.endTime,
    this.durationSeconds,
    this.description,
    this.memo,
    this.isBillable = true,
    this.isApproved = false,
  });

  Duration get duration {
    if (durationSeconds != null) {
      return Duration(seconds: durationSeconds!);
    }
    if (endTime != null) {
      return endTime!.difference(startTime);
    }
    return DateTime.now().difference(startTime);
  }

  String get formattedDuration {
    final d = duration;
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  factory TimeEntry.fromJson(Map<String, dynamic> json) {
    return TimeEntry(
      id: json['id'] as String,
      contractId: json['contractId'] as String,
      contractTitle: json['contractTitle'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
      durationSeconds: json['durationSeconds'] as int?,
      description: json['description'] as String?,
      memo: json['memo'] as String?,
      isBillable: json['isBillable'] as bool? ?? true,
      isApproved: json['isApproved'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'contractId': contractId,
      'contractTitle': contractTitle,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'durationSeconds': durationSeconds,
      'description': description,
      'memo': memo,
      'isBillable': isBillable,
      'isApproved': isApproved,
    };
  }

  @override
  List<Object?> get props => [id, contractId, startTime, endTime];
}

/// Weekly summary for time tracking
class WeeklyTimeSummary {
  final DateTime weekStart;
  final int totalSeconds;
  final double totalEarnings;
  final List<DailyTimeSummary> dailySummaries;

  const WeeklyTimeSummary({
    required this.weekStart,
    required this.totalSeconds,
    required this.totalEarnings,
    required this.dailySummaries,
  });

  String get formattedTotal {
    final hours = (totalSeconds / 3600).floor();
    final minutes = ((totalSeconds % 3600) / 60).floor();
    return '${hours}h ${minutes}m';
  }
}

class DailyTimeSummary {
  final DateTime date;
  final int seconds;

  const DailyTimeSummary({required this.date, required this.seconds});

  double get hours => seconds / 3600;
}

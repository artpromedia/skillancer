import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/time_entry.dart';

/// Timer service for tracking active work sessions
class TimerService extends ChangeNotifier {
  Timer? _timer;
  DateTime? _startTime;
  String? _activeContractId;
  String? _activeContractTitle;
  int _elapsedSeconds = 0;
  bool _isPaused = false;

  bool get isRunning => _timer != null && !_isPaused;
  bool get isPaused => _isPaused;
  bool get hasActiveSession => _startTime != null;
  int get elapsedSeconds => _elapsedSeconds;
  String? get activeContractId => _activeContractId;
  String? get activeContractTitle => _activeContractTitle;

  String get formattedTime {
    final hours = (_elapsedSeconds / 3600).floor().toString().padLeft(2, '0');
    final minutes =
        ((_elapsedSeconds % 3600) / 60).floor().toString().padLeft(2, '0');
    final seconds = (_elapsedSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  void startTimer({required String contractId, required String contractTitle}) {
    if (_timer != null) return;

    _activeContractId = contractId;
    _activeContractTitle = contractTitle;
    _startTime = DateTime.now();
    _elapsedSeconds = 0;
    _isPaused = false;

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _elapsedSeconds++;
      notifyListeners();
    });

    notifyListeners();
  }

  void pauseTimer() {
    _timer?.cancel();
    _timer = null;
    _isPaused = true;
    notifyListeners();
  }

  void resumeTimer() {
    if (!_isPaused || _startTime == null) return;

    _isPaused = false;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _elapsedSeconds++;
      notifyListeners();
    });

    notifyListeners();
  }

  TimeEntry? stopTimer({String? memo}) {
    if (_startTime == null) return null;

    _timer?.cancel();
    _timer = null;

    final entry = TimeEntry(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      contractId: _activeContractId!,
      contractTitle: _activeContractTitle!,
      startTime: _startTime!,
      endTime: DateTime.now(),
      durationSeconds: _elapsedSeconds,
      memo: memo,
    );

    _startTime = null;
    _activeContractId = null;
    _activeContractTitle = null;
    _elapsedSeconds = 0;
    _isPaused = false;

    notifyListeners();

    return entry;
  }

  void discardTimer() {
    _timer?.cancel();
    _timer = null;
    _startTime = null;
    _activeContractId = null;
    _activeContractTitle = null;
    _elapsedSeconds = 0;
    _isPaused = false;

    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

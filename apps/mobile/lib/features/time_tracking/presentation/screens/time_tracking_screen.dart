import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/time_entry.dart';
import '../../domain/services/timer_service.dart';

/// Time tracking screen with timer and entries
class TimeTrackingScreen extends ConsumerStatefulWidget {
  const TimeTrackingScreen({super.key});

  @override
  ConsumerState<TimeTrackingScreen> createState() => _TimeTrackingScreenState();
}

class _TimeTrackingScreenState extends ConsumerState<TimeTrackingScreen> {
  DateTime _selectedWeek = _getWeekStart(DateTime.now());

  static DateTime _getWeekStart(DateTime date) {
    return date.subtract(Duration(days: date.weekday - 1));
  }

  @override
  Widget build(BuildContext context) {
    final timerService = ref.watch(timerServiceProvider);
    final entriesAsync = ref.watch(timeEntriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Time Tracking'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today),
            onPressed: () => _selectWeek(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Active timer widget
          _ActiveTimerWidget(timerService: timerService),

          // Week selector
          _WeekSelector(
            selectedWeek: _selectedWeek,
            onPrevious: () {
              setState(() {
                _selectedWeek = _selectedWeek.subtract(const Duration(days: 7));
              });
            },
            onNext: () {
              setState(() {
                _selectedWeek = _selectedWeek.add(const Duration(days: 7));
              });
            },
          ),

          // Time entries
          Expanded(
            child: entriesAsync.when(
              data: (entries) {
                if (entries.isEmpty) {
                  return const _EmptyState();
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  itemCount: entries.length,
                  itemBuilder: (context, index) {
                    return _TimeEntryCard(entry: entries[index]);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stack) => Center(child: Text('Error: $error')),
            ),
          ),
        ],
      ),
      floatingActionButton: !timerService.hasActiveSession
          ? FloatingActionButton.extended(
              onPressed: () => _showStartTimerSheet(context),
              icon: const Icon(Icons.play_arrow),
              label: const Text('Start Timer'),
            )
          : null,
    );
  }

  Future<void> _selectWeek(BuildContext context) async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedWeek,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 7)),
    );
    if (date != null) {
      setState(() {
        _selectedWeek = _getWeekStart(date);
      });
    }
  }

  void _showStartTimerSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => const _StartTimerSheet(),
    );
  }
}

class _ActiveTimerWidget extends ConsumerWidget {
  final TimerService timerService;

  const _ActiveTimerWidget({required this.timerService});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!timerService.hasActiveSession) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: AppTheme.primaryColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            timerService.activeContractTitle ?? '',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: Colors.white70,
                ),
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            timerService.formattedTime,
            style: const TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.bold,
              fontFeatures: [FontFeature.tabularFigures()],
              color: Colors.white,
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (timerService.isRunning)
                IconButton(
                  onPressed: () => timerService.pauseTimer(),
                  icon: const Icon(Icons.pause_circle, color: Colors.white),
                  iconSize: 48,
                )
              else if (timerService.isPaused)
                IconButton(
                  onPressed: () => timerService.resumeTimer(),
                  icon: const Icon(Icons.play_circle, color: Colors.white),
                  iconSize: 48,
                ),
              const SizedBox(width: AppTheme.spacingLg),
              IconButton(
                onPressed: () => _showStopDialog(context, ref),
                icon: const Icon(Icons.stop_circle, color: Colors.white),
                iconSize: 48,
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showStopDialog(BuildContext context, WidgetRef ref) {
    final memoController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Stop Timer'),
        content: TextField(
          controller: memoController,
          decoration: const InputDecoration(
            labelText: 'Memo (optional)',
            hintText: 'What did you work on?',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () {
              timerService.discardTimer();
              Navigator.of(context).pop();
            },
            child: const Text('Discard'),
          ),
          ElevatedButton(
            onPressed: () {
              timerService.stopTimer(memo: memoController.text);
              Navigator.of(context).pop();
            },
            child: const Text('Save Entry'),
          ),
        ],
      ),
    );
  }
}

class _WeekSelector extends StatelessWidget {
  final DateTime selectedWeek;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const _WeekSelector({
    required this.selectedWeek,
    required this.onPrevious,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final weekEnd = selectedWeek.add(const Duration(days: 6));
    final format = DateFormat('MMM d');

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: onPrevious,
          ),
          Expanded(
            child: Text(
              '${format.format(selectedWeek)} - ${format.format(weekEnd)}',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: onNext,
          ),
        ],
      ),
    );
  }
}

class _TimeEntryCard extends StatelessWidget {
  final TimeEntry entry;

  const _TimeEntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: ListTile(
        contentPadding: const EdgeInsets.all(AppTheme.spacingMd),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
          child: Center(
            child: Text(
              entry.formattedDuration.substring(0, 5),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
        ),
        title: Text(entry.contractTitle),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(DateFormat('MMM d, yyyy • h:mm a').format(entry.startTime)),
            if (entry.memo != null)
              Text(
                entry.memo!,
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        trailing: entry.isApproved
            ? Icon(Icons.check_circle, color: AppTheme.successColor)
            : null,
      ),
    );
  }
}

class _StartTimerSheet extends ConsumerWidget {
  const _StartTimerSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractsAsync = ref.watch(myContractsProvider);

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Select Contract',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          contractsAsync.when(
            data: (contracts) {
              if (contracts.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(AppTheme.spacingLg),
                  child: Text('No active contracts'),
                );
              }

              return Column(
                children: contracts.map((contract) {
                  return ListTile(
                    title: Text(contract.title),
                    subtitle: Text(contract.clientName),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      ref.read(timerServiceProvider).startTimer(
                            contractId: contract.id,
                            contractTitle: contract.title,
                          );
                      Navigator.of(context).pop();
                    },
                  );
                }).toList(),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stack) => Text('Error: $error'),
          ),
          const SizedBox(height: AppTheme.spacingLg),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.timer_outlined, size: 64, color: AppTheme.neutral400),
          const SizedBox(height: AppTheme.spacingMd),
          Text(
            'No time entries this week',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'Start tracking time to see your entries here',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

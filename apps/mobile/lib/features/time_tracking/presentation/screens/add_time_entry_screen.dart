import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../contracts/domain/models/contract.dart';

/// Screen for adding a manual time entry
class AddTimeEntryScreen extends ConsumerStatefulWidget {
  const AddTimeEntryScreen({super.key});

  @override
  ConsumerState<AddTimeEntryScreen> createState() => _AddTimeEntryScreenState();
}

class _AddTimeEntryScreenState extends ConsumerState<AddTimeEntryScreen> {
  final _formKey = GlobalKey<FormState>();
  Contract? _selectedContract;
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = TimeOfDay.now();
  TimeOfDay _endTime = TimeOfDay.now();
  final _memoController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _memoController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final contractsAsync = ref.watch(myContractsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Time Entry'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _saveEntry,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Contract selector
              _SectionTitle(title: 'Contract'),
              const SizedBox(height: AppTheme.spacingSm),
              contractsAsync.when(
                data: (contracts) {
                  if (contracts.isEmpty) {
                    return const Card(
                      child: Padding(
                        padding: EdgeInsets.all(AppTheme.spacingMd),
                        child: Text('No active contracts available'),
                      ),
                    );
                  }

                  return DropdownButtonFormField<Contract>(
                    value: _selectedContract,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'Select a contract',
                    ),
                    items: contracts.map((contract) {
                      return DropdownMenuItem(
                        value: contract,
                        child: Text(
                          contract.title,
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: (contract) {
                      setState(() => _selectedContract = contract);
                    },
                    validator: (value) {
                      if (value == null) {
                        return 'Please select a contract';
                      }
                      return null;
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stack) => Text('Error: $error'),
              ),
              const SizedBox(height: AppTheme.spacingLg),

              // Date selector
              _SectionTitle(title: 'Date'),
              const SizedBox(height: AppTheme.spacingSm),
              InkWell(
                onTap: _selectDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    suffixIcon: Icon(Icons.calendar_today),
                  ),
                  child: Text(DateFormat('EEEE, MMM d, yyyy').format(_selectedDate)),
                ),
              ),
              const SizedBox(height: AppTheme.spacingLg),

              // Time range
              _SectionTitle(title: 'Time'),
              const SizedBox(height: AppTheme.spacingSm),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectTime(isStartTime: true),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Start',
                          border: OutlineInputBorder(),
                          suffixIcon: Icon(Icons.access_time),
                        ),
                        child: Text(_formatTime(_startTime)),
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
                    child: Text('to'),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectTime(isStartTime: false),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'End',
                          border: OutlineInputBorder(),
                          suffixIcon: Icon(Icons.access_time),
                        ),
                        child: Text(_formatTime(_endTime)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingSm),
              _DurationIndicator(
                startTime: _startTime,
                endTime: _endTime,
              ),
              const SizedBox(height: AppTheme.spacingLg),

              // Memo
              _SectionTitle(title: 'Memo'),
              const SizedBox(height: AppTheme.spacingSm),
              TextFormField(
                controller: _memoController,
                decoration: const InputDecoration(
                  hintText: 'What did you work on?',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                maxLines: 4,
                maxLength: 500,
              ),
              const SizedBox(height: AppTheme.spacingXl),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(TimeOfDay time) {
    final now = DateTime.now();
    final dt = DateTime(now.year, now.month, now.day, time.hour, time.minute);
    return DateFormat('h:mm a').format(dt);
  }

  Future<void> _selectDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      setState(() => _selectedDate = date);
    }
  }

  Future<void> _selectTime({required bool isStartTime}) async {
    final time = await showTimePicker(
      context: context,
      initialTime: isStartTime ? _startTime : _endTime,
    );
    if (time != null) {
      setState(() {
        if (isStartTime) {
          _startTime = time;
        } else {
          _endTime = time;
        }
      });
    }
  }

  Future<void> _saveEntry() async {
    if (!_formKey.currentState!.validate()) return;

    // Validate time range
    final startMinutes = _startTime.hour * 60 + _startTime.minute;
    final endMinutes = _endTime.hour * 60 + _endTime.minute;
    if (endMinutes <= startMinutes) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End time must be after start time')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // Simulate API call
      await Future.delayed(const Duration(seconds: 1));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Time entry saved successfully')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving time entry: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
    );
  }
}

class _DurationIndicator extends StatelessWidget {
  final TimeOfDay startTime;
  final TimeOfDay endTime;

  const _DurationIndicator({
    required this.startTime,
    required this.endTime,
  });

  @override
  Widget build(BuildContext context) {
    final startMinutes = startTime.hour * 60 + startTime.minute;
    final endMinutes = endTime.hour * 60 + endTime.minute;
    final durationMinutes = endMinutes - startMinutes;

    if (durationMinutes <= 0) {
      return Text(
        'Invalid time range',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppTheme.errorColor,
            ),
      );
    }

    final hours = durationMinutes ~/ 60;
    final minutes = durationMinutes % 60;
    final durationText = hours > 0
        ? '${hours}h ${minutes}m'
        : '${minutes}m';

    return Row(
      children: [
        Icon(Icons.timer_outlined, size: 16, color: AppTheme.primaryColor),
        const SizedBox(width: AppTheme.spacingXs),
        Text(
          'Duration: $durationText',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.primaryColor,
                fontWeight: FontWeight.w500,
              ),
        ),
      ],
    );
  }
}

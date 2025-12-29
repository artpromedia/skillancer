import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/proposal.dart';

/// Submit proposal screen
class SubmitProposalScreen extends ConsumerStatefulWidget {
  final String jobId;

  const SubmitProposalScreen({super.key, required this.jobId});

  @override
  ConsumerState<SubmitProposalScreen> createState() => _SubmitProposalScreenState();
}

class _SubmitProposalScreenState extends ConsumerState<SubmitProposalScreen> {
  final _formKey = GlobalKey<FormState>();
  final _coverLetterController = TextEditingController();
  final _bidAmountController = TextEditingController();

  bool _isLoading = false;
  int _deliveryDays = 7;
  bool _useMilestones = false;
  final List<_MilestoneData> _milestones = [];

  @override
  void dispose() {
    _coverLetterController.dispose();
    _bidAmountController.dispose();
    super.dispose();
  }

  double get _totalMilestoneAmount {
    return _milestones.fold(0.0, (sum, m) => sum + (m.amount ?? 0));
  }

  Future<void> _submitProposal() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // TODO: Submit proposal via API
      await Future.delayed(const Duration(seconds: 1));

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Proposal submitted successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobAsync = ref.watch(jobDetailProvider(widget.jobId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Proposal'),
      ),
      body: jobAsync.when(
        data: (job) {
          if (job == null) {
            return const Center(child: Text('Job not found'));
          }

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              children: [
                // Job summary
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacingMd),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          job.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppTheme.spacingSm),
                        Row(
                          children: [
                            Text(
                              'Budget: ${job.budgetDisplay}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(width: AppTheme.spacingMd),
                            Text(
                              job.budgetType.displayName,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Cover letter
                Text(
                  'Cover Letter',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppTheme.spacingSm),
                TextFormField(
                  controller: _coverLetterController,
                  maxLines: 6,
                  maxLength: 2000,
                  decoration: const InputDecoration(
                    hintText: 'Introduce yourself and explain why you\'re the best fit...',
                  ),
                  validator: (value) {
                    if (value == null || value.length < 50) {
                      return 'Cover letter must be at least 50 characters';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Bid amount
                Text(
                  'Your Bid',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppTheme.spacingSm),
                TextFormField(
                  controller: _bidAmountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    prefixText: '\$ ',
                    hintText: 'Enter your bid amount',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter a bid amount';
                    }
                    final amount = double.tryParse(value);
                    if (amount == null || amount <= 0) {
                      return 'Please enter a valid amount';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Delivery time
                Text(
                  'Delivery Time',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppTheme.spacingSm),
                Wrap(
                  spacing: AppTheme.spacingSm,
                  children: [7, 14, 30, 60].map((days) {
                    return ChoiceChip(
                      label: Text('$days days'),
                      selected: _deliveryDays == days,
                      onSelected: (selected) {
                        if (selected) setState(() => _deliveryDays = days);
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Milestones toggle
                SwitchListTile(
                  title: const Text('Use Milestones'),
                  subtitle: const Text('Break the project into phases'),
                  value: _useMilestones,
                  onChanged: (value) => setState(() => _useMilestones = value),
                  contentPadding: EdgeInsets.zero,
                ),

                if (_useMilestones) ...[
                  const SizedBox(height: AppTheme.spacingMd),
                  ..._milestones.asMap().entries.map((entry) {
                    final index = entry.key;
                    final milestone = entry.value;
                    return _MilestoneInput(
                      milestone: milestone,
                      onRemove: () {
                        setState(() => _milestones.removeAt(index));
                      },
                      onChanged: (updated) {
                        setState(() => _milestones[index] = updated);
                      },
                    );
                  }),
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _milestones.add(_MilestoneData());
                      });
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('Add Milestone'),
                  ),
                  if (_milestones.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: AppTheme.spacingSm),
                      child: Text(
                        'Total: \$${_totalMilestoneAmount.toStringAsFixed(0)}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                ],

                const SizedBox(height: AppTheme.spacing2xl),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(child: Text('Error: $error')),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: ElevatedButton(
            onPressed: _isLoading ? null : _submitProposal,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Submit Proposal'),
          ),
        ),
      ),
    );
  }
}

class _MilestoneData {
  String? title;
  double? amount;
  int? days;
}

class _MilestoneInput extends StatelessWidget {
  final _MilestoneData milestone;
  final VoidCallback onRemove;
  final ValueChanged<_MilestoneData> onChanged;

  const _MilestoneInput({
    required this.milestone,
    required this.onRemove,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Milestone Title',
                      isDense: true,
                    ),
                    onChanged: (value) {
                      milestone.title = value;
                      onChanged(milestone);
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: onRemove,
                ),
              ],
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      prefixText: '\$ ',
                      isDense: true,
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      milestone.amount = double.tryParse(value);
                      onChanged(milestone);
                    },
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Days',
                      isDense: true,
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      milestone.days = int.tryParse(value);
                      onChanged(milestone);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/navigation/app_router.dart';
import '../../../../widgets/loading_indicator.dart';
import '../../../../widgets/error_widget.dart';
import '../../domain/models/contract.dart';

/// Screen for freelancers to submit work for a milestone.
class SubmitWorkScreen extends ConsumerStatefulWidget {
  final String contractId;
  final String milestoneId;

  const SubmitWorkScreen({
    super.key,
    required this.contractId,
    required this.milestoneId,
  });

  @override
  ConsumerState<SubmitWorkScreen> createState() => _SubmitWorkScreenState();
}

class _SubmitWorkScreenState extends ConsumerState<SubmitWorkScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();
  final _hoursController = TextEditingController();

  bool _isSubmitting = false;
  final List<_AttachmentEntry> _attachments = [];

  @override
  void dispose() {
    _notesController.dispose();
    _hoursController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final contractAsync =
        ref.watch(contractDetailProvider(widget.contractId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Work'),
      ),
      body: contractAsync.when(
        data: (contract) {
          if (contract == null) {
            return const AppErrorWidget(
              message: 'Contract not found',
              description:
                  'The contract you are looking for could not be loaded.',
            );
          }

          final milestone = contract.milestones?.cast<ContractMilestone?>().firstWhere(
                (m) => m?.id == widget.milestoneId,
                orElse: () => null,
              );

          if (milestone == null) {
            return const AppErrorWidget(
              message: 'Milestone not found',
              description:
                  'The milestone you are looking for could not be found.',
            );
          }

          final isHourly = contract.hourlyRate > 0;

          return Stack(
            children: [
              Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  children: [
                    // Milestone info card
                    _MilestoneInfoCard(
                      milestone: milestone,
                      contractTitle: contract.title,
                    ),

                    const SizedBox(height: AppTheme.spacingLg),

                    // Description / Notes
                    Text(
                      'Work Description',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    TextFormField(
                      controller: _notesController,
                      maxLines: 6,
                      maxLength: 3000,
                      decoration: const InputDecoration(
                        hintText:
                            'Describe the work you have completed for this milestone...',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().length < 20) {
                          return 'Please provide a description of at least 20 characters';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: AppTheme.spacingLg),

                    // File / Link attachments
                    Text(
                      'Attachments',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppTheme.spacingXs),
                    Text(
                      'Add files or links to support your submission.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.neutral500,
                          ),
                    ),
                    const SizedBox(height: AppTheme.spacingMd),

                    // Attachment list
                    ..._attachments.asMap().entries.map((entry) {
                      final index = entry.key;
                      final attachment = entry.value;
                      return _AttachmentRow(
                        attachment: attachment,
                        onRemove: () {
                          setState(() => _attachments.removeAt(index));
                        },
                      );
                    }),

                    // Add attachment buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _addFileAttachment,
                            icon: const Icon(Icons.attach_file, size: 18),
                            label: const Text('Add File'),
                          ),
                        ),
                        const SizedBox(width: AppTheme.spacingSm),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _addLinkAttachment,
                            icon: const Icon(Icons.link, size: 18),
                            label: const Text('Add Link'),
                          ),
                        ),
                      ],
                    ),

                    // Hours worked (for hourly contracts)
                    if (isHourly) ...[
                      const SizedBox(height: AppTheme.spacingLg),
                      Text(
                        'Hours Worked',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      TextFormField(
                        controller: _hoursController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Enter hours worked',
                          suffixText: 'hours',
                          helperText:
                              'Rate: \$${contract.hourlyRate.toStringAsFixed(2)}/hr',
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter the hours worked';
                          }
                          final hours = double.tryParse(value);
                          if (hours == null || hours <= 0) {
                            return 'Please enter a valid number of hours';
                          }
                          if (hours > 999) {
                            return 'Hours cannot exceed 999';
                          }
                          return null;
                        },
                      ),
                      if (_hoursController.text.isNotEmpty) ...[
                        const SizedBox(height: AppTheme.spacingSm),
                        Builder(
                          builder: (context) {
                            final hours =
                                double.tryParse(_hoursController.text) ?? 0;
                            final total = hours * contract.hourlyRate;
                            final currencyFormat =
                                NumberFormat.currency(symbol: '\$');
                            return Text(
                              'Estimated total: ${currencyFormat.format(total)}',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                            );
                          },
                        ),
                      ],
                    ],

                    // Spacing for bottom button
                    const SizedBox(height: AppTheme.spacing2xl),
                  ],
                ),
              ),

              // Loading overlay
              if (_isSubmitting)
                LoadingIndicator.overlay(
                  message: 'Submitting your work...',
                ),
            ],
          );
        },
        loading: () => const LoadingIndicator(
          message: 'Loading milestone details...',
        ),
        error: (error, stack) => AppErrorWidget.retry(
          message: 'Failed to load milestone',
          description: error.toString(),
          onAction: () {
            ref.invalidate(contractDetailProvider(widget.contractId));
          },
        ),
      ),
      bottomNavigationBar: _buildBottomBar(context),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    return Container(
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
          onPressed: _isSubmitting ? null : _handleSubmit,
          child: _isSubmitting
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Submit Work'),
        ),
      ),
    );
  }

  void _addFileAttachment() {
    // In production, this would use file_picker or image_picker.
    // For now, show a placeholder dialog for the file name.
    final nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add File'),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(
            hintText: 'File name (e.g., design_v2.fig)',
            labelText: 'File Name',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (nameController.text.isNotEmpty) {
                setState(() {
                  _attachments.add(_AttachmentEntry(
                    name: nameController.text,
                    type: _AttachmentType.file,
                  ));
                });
              }
              Navigator.of(context).pop();
            },
            child: const Text('Add'),
          ),
        ],
      ),
    ).then((_) => nameController.dispose());
  }

  void _addLinkAttachment() {
    final nameController = TextEditingController();
    final urlController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Link'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                hintText: 'Link title',
                labelText: 'Title',
              ),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            TextField(
              controller: urlController,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                hintText: 'https://...',
                labelText: 'URL',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (urlController.text.isNotEmpty) {
                setState(() {
                  _attachments.add(_AttachmentEntry(
                    name: nameController.text.isNotEmpty
                        ? nameController.text
                        : urlController.text,
                    url: urlController.text,
                    type: _AttachmentType.link,
                  ));
                });
              }
              Navigator.of(context).pop();
            },
            child: const Text('Add'),
          ),
        ],
      ),
    ).then((_) {
      nameController.dispose();
      urlController.dispose();
    });
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Submission'),
        content: const Text(
          'Are you sure you want to submit this work for review? '
          'The client will be notified and can approve or request revisions.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isSubmitting = true);

    try {
      // TODO: Call actual API to submit milestone work
      // Example:
      // final contractsRepo = ref.read(contractsRepositoryProvider);
      // await contractsRepo.submitMilestoneWork(
      //   contractId: widget.contractId,
      //   milestoneId: widget.milestoneId,
      //   description: _notesController.text,
      //   attachments: _attachments.map((a) => a.toJson()).toList(),
      //   hoursWorked: double.tryParse(_hoursController.text),
      // );

      await Future.delayed(const Duration(seconds: 1));

      // Invalidate the contract detail to refresh milestone status
      ref.invalidate(contractDetailProvider(widget.contractId));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Work submitted successfully!'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit work: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }
}

// =============================================================================
// Milestone Info Card
// =============================================================================

class _MilestoneInfoCard extends StatelessWidget {
  final ContractMilestone milestone;
  final String contractTitle;

  const _MilestoneInfoCard({
    required this.milestone,
    required this.contractTitle,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final dateFormat = DateFormat('MMM d, yyyy');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Contract title (small label)
            Text(
              contractTitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.neutral500,
                  ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppTheme.spacingXs),

            // Milestone title
            Text(
              'Submit Work for: ${milestone.title}',
              style: Theme.of(context).textTheme.titleMedium,
            ),

            if (milestone.description != null &&
                milestone.description!.isNotEmpty) ...[
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                milestone.description!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.neutral500,
                    ),
              ),
            ],

            const SizedBox(height: AppTheme.spacingMd),
            const Divider(),
            const SizedBox(height: AppTheme.spacingSm),

            // Amount and due date
            Row(
              children: [
                _InfoChip(
                  icon: Icons.attach_money,
                  label: 'Amount',
                  value: currencyFormat.format(milestone.amount),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                if (milestone.dueDate != null)
                  _InfoChip(
                    icon: Icons.calendar_today_outlined,
                    label: 'Due Date',
                    value: dateFormat.format(milestone.dueDate!),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppTheme.neutral500),
        const SizedBox(width: AppTheme.spacingXs),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.neutral400,
                  ),
            ),
            Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ],
    );
  }
}

// =============================================================================
// Attachment Helpers
// =============================================================================

enum _AttachmentType { file, link }

class _AttachmentEntry {
  final String name;
  final String? url;
  final _AttachmentType type;

  const _AttachmentEntry({
    required this.name,
    this.url,
    required this.type,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'url': url,
        'type': type.name,
      };
}

class _AttachmentRow extends StatelessWidget {
  final _AttachmentEntry attachment;
  final VoidCallback onRemove;

  const _AttachmentRow({
    required this.attachment,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: ListTile(
        dense: true,
        leading: Icon(
          attachment.type == _AttachmentType.file
              ? Icons.insert_drive_file_outlined
              : Icons.link,
          color: AppTheme.primaryColor,
        ),
        title: Text(
          attachment.name,
          style: Theme.of(context).textTheme.bodyMedium,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: attachment.url != null
            ? Text(
                attachment.url!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.primaryColor,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: IconButton(
          icon: Icon(
            Icons.close,
            size: 18,
            color: AppTheme.neutral500,
          ),
          onPressed: onRemove,
        ),
      ),
    );
  }
}

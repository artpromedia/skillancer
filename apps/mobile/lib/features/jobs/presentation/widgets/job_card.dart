import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/theme/app_theme.dart';
import '../../domain/models/job.dart';

/// Job card widget for list display
class JobCard extends StatelessWidget {
  final Job job;
  final bool isSaved;
  final VoidCallback? onSaveToggle;

  const JobCard({
    super.key,
    required this.job,
    this.isSaved = false,
    this.onSaveToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      child: InkWell(
        onTap: () => context.push('/jobs/${job.id}'),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // SmartMatch badge
                        if (job.smartMatchScore != null &&
                            job.smartMatchScore! >= 80)
                          Container(
                            margin: const EdgeInsets.only(
                                bottom: AppTheme.spacingXs),
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppTheme.spacingSm,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.successColor.withOpacity(0.1),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusFull),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.bolt,
                                  size: 12,
                                  color: AppTheme.successColor,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '${job.smartMatchScore}% match',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.successColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        // Title
                        Text(
                          job.title,
                          style: Theme.of(context).textTheme.titleMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      isSaved ? Icons.bookmark : Icons.bookmark_border,
                      color: isSaved ? AppTheme.primaryColor : null,
                    ),
                    onPressed: onSaveToggle,
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Client info
              Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.neutral200,
                    backgroundImage: job.clientAvatarUrl != null
                        ? NetworkImage(job.clientAvatarUrl!)
                        : null,
                    child: job.clientAvatarUrl == null
                        ? Text(
                            job.clientName[0].toUpperCase(),
                            style: const TextStyle(fontSize: 10),
                          )
                        : null,
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    job.clientName,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  Text(
                    timeago.format(job.postedAt),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Budget and type
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingSm,
                      vertical: AppTheme.spacingXs,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Text(
                      job.budgetDisplay,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.primaryColor,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    job.budgetType.displayName,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  Icon(
                    Icons.description_outlined,
                    size: 14,
                    color: Theme.of(context).textTheme.bodySmall?.color,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${job.proposalCount} proposals',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingMd),

              // Skills
              Wrap(
                spacing: AppTheme.spacingSm,
                runSpacing: AppTheme.spacingXs,
                children: job.skills.take(4).map((skill) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingSm,
                      vertical: AppTheme.spacingXs,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.neutral100,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Text(
                      skill,
                      style: const TextStyle(fontSize: 12),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

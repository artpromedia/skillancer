import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Job detail screen with full job information
class JobDetailScreen extends ConsumerWidget {
  final String jobId;

  const JobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobAsync = ref.watch(jobDetailProvider(jobId));
    final savedJobs = ref.watch(savedJobsProvider);

    return jobAsync.when(
      data: (job) {
        if (job == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Job not found')),
          );
        }

        final isSaved = savedJobs.contains(job.id);

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              // App bar
              SliverAppBar(
                expandedHeight: 120,
                pinned: true,
                actions: [
                  IconButton(
                    icon:
                        Icon(isSaved ? Icons.bookmark : Icons.bookmark_border),
                    onPressed: () {
                      ref.read(savedJobsProvider.notifier).toggle(job.id);
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.share),
                    onPressed: () {
                      // TODO: Share job
                    },
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    job.title,
                    style: const TextStyle(fontSize: 14),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  titlePadding: const EdgeInsets.only(
                    left: 56,
                    right: 56,
                    bottom: 16,
                  ),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Client card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(AppTheme.spacingMd),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: AppTheme.neutral200,
                                backgroundImage: job.clientAvatarUrl != null
                                    ? NetworkImage(job.clientAvatarUrl!)
                                    : null,
                                child: job.clientAvatarUrl == null
                                    ? Text(job.clientName[0].toUpperCase())
                                    : null,
                              ),
                              const SizedBox(width: AppTheme.spacingMd),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      job.clientName,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall,
                                    ),
                                    Text(
                                      'Posted ${timeago.format(job.postedAt)}',
                                      style:
                                          Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: AppTheme.spacingLg),

                      // Budget and details
                      Row(
                        children: [
                          _DetailItem(
                            icon: Icons.attach_money,
                            label: 'Budget',
                            value: job.budgetDisplay,
                          ),
                          const SizedBox(width: AppTheme.spacingMd),
                          _DetailItem(
                            icon: Icons.access_time,
                            label: 'Duration',
                            value: job.projectDuration.displayName,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppTheme.spacingMd),
                      Row(
                        children: [
                          _DetailItem(
                            icon: Icons.star_outline,
                            label: 'Experience',
                            value: job.experienceLevel.displayName,
                          ),
                          const SizedBox(width: AppTheme.spacingMd),
                          _DetailItem(
                            icon: Icons.location_on_outlined,
                            label: 'Location',
                            value: job.isRemote
                                ? 'Remote'
                                : (job.location ?? 'On-site'),
                          ),
                        ],
                      ),

                      const SizedBox(height: AppTheme.spacingLg),

                      // Description
                      Text(
                        'Description',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Text(
                        job.description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),

                      const SizedBox(height: AppTheme.spacingLg),

                      // Skills
                      Text(
                        'Skills Required',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Wrap(
                        spacing: AppTheme.spacingSm,
                        runSpacing: AppTheme.spacingSm,
                        children: job.skills.map((skill) {
                          return Chip(
                            label: Text(skill),
                            visualDensity: VisualDensity.compact,
                          );
                        }).toList(),
                      ),

                      const SizedBox(height: AppTheme.spacingLg),

                      // Proposals info
                      Container(
                        padding: const EdgeInsets.all(AppTheme.spacingMd),
                        decoration: BoxDecoration(
                          color: AppTheme.neutral100,
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusMd),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.description_outlined),
                            const SizedBox(width: AppTheme.spacingSm),
                            Text(
                              '${job.proposalCount} proposals submitted',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),

                      // Bottom padding for FAB
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => context.push('/jobs/$jobId/apply'),
            icon: const Icon(Icons.send),
            label: const Text('Apply Now'),
          ),
          floatingActionButtonLocation:
              FloatingActionButtonLocation.centerFloat,
        );
      },
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Error: $error')),
      ),
    );
  }
}

class _DetailItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.neutral200),
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: AppTheme.neutral500),
                const SizedBox(width: 4),
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
        ),
      ),
    );
  }
}

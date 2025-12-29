import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/job_card.dart';

/// Jobs list screen with search, filters, and infinite scroll
class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      // Load more jobs
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobsAsync = ref.watch(jobsProvider);
    final filter = ref.watch(jobsFilterProvider);
    final savedJobs = ref.watch(savedJobsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Work'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Offline indicator
          const OfflineIndicator(),

          // Search bar
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search jobs...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                ref.read(jobsFilterProvider.notifier).state =
                                    filter.copyWith(query: null);
                              },
                            )
                          : null,
                    ),
                    onSubmitted: (value) {
                      ref.read(jobsFilterProvider.notifier).state =
                          filter.copyWith(query: value.isEmpty ? null : value);
                    },
                  ),
                ),
                const SizedBox(width: AppTheme.spacingSm),
                Badge(
                  isLabelVisible: filter.activeFilterCount > 0,
                  label: Text('${filter.activeFilterCount}'),
                  child: IconButton.filled(
                    onPressed: () => context.push('/jobs/filters'),
                    icon: const Icon(Icons.tune),
                  ),
                ),
              ],
            ),
          ),

          // Filter chips
          if (filter.hasFilters)
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
                children: [
                  if (filter.category != null)
                    _FilterChip(
                      label: filter.category!,
                      onRemove: () {
                        ref.read(jobsFilterProvider.notifier).state =
                            filter.copyWith(category: null);
                      },
                    ),
                  if (filter.experienceLevel != null)
                    _FilterChip(
                      label: filter.experienceLevel!.displayName,
                      onRemove: () {
                        ref.read(jobsFilterProvider.notifier).state =
                            filter.copyWith(experienceLevel: null);
                      },
                    ),
                  if (filter.isRemote == true)
                    _FilterChip(
                      label: 'Remote',
                      onRemove: () {
                        ref.read(jobsFilterProvider.notifier).state =
                            filter.copyWith(isRemote: null);
                      },
                    ),
                  TextButton(
                    onPressed: () {
                      ref.read(jobsFilterProvider.notifier).state =
                          filter.clear();
                    },
                    child: const Text('Clear all'),
                  ),
                ],
              ),
            ),

          // Jobs list
          Expanded(
            child: jobsAsync.when(
              data: (jobs) {
                if (jobs.isEmpty) {
                  return _EmptyState(hasFilters: filter.hasFilters);
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(jobsProvider);
                  },
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.only(bottom: AppTheme.spacingLg),
                    itemCount: jobs.length,
                    itemBuilder: (context, index) {
                      final job = jobs[index];
                      return JobCard(
                        job: job,
                        isSaved: savedJobs.contains(job.id),
                        onSaveToggle: () {
                          ref.read(savedJobsProvider.notifier).toggle(job.id);
                        },
                      );
                    },
                  ),
                );
              },
              loading: () => const _LoadingSkeleton(),
              error: (error, stack) => _ErrorState(
                message: error.toString(),
                onRetry: () => ref.invalidate(jobsProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const _FilterChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppTheme.spacingSm),
      child: Chip(
        label: Text(label),
        deleteIcon: const Icon(Icons.close, size: 16),
        onDeleted: onRemove,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool hasFilters;

  const _EmptyState({required this.hasFilters});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              hasFilters ? Icons.filter_list_off : Icons.work_off_outlined,
              size: 64,
              color: AppTheme.neutral400,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              hasFilters ? 'No jobs match your filters' : 'No jobs available',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              hasFilters
                  ? 'Try adjusting your filters'
                  : 'Check back later for new opportunities',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.neutral500,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      itemCount: 5,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 20,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppTheme.neutral200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AppTheme.spacingMd),
                Container(
                  height: 14,
                  width: 150,
                  decoration: BoxDecoration(
                    color: AppTheme.neutral200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: AppTheme.spacingMd),
                Row(
                  children: List.generate(
                    3,
                    (i) => Container(
                      margin: const EdgeInsets.only(right: AppTheme.spacingSm),
                      height: 24,
                      width: 60,
                      decoration: BoxDecoration(
                        color: AppTheme.neutral200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: AppTheme.errorColor,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              'Something went wrong',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.neutral500,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingLg),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

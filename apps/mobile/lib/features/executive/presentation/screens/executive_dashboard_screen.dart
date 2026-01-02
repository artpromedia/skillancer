import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../data/repositories/executive_repository.dart';
import '../../domain/models/engagement.dart';
import '../../domain/models/executive_profile.dart';
import '../../domain/providers/executive_providers.dart';
import '../widgets/engagement_card.dart';
import '../widgets/stats_card.dart';
import '../widgets/vetting_status_banner.dart';

/// Executive dashboard screen - main hub for fractional executives
class ExecutiveDashboardScreen extends ConsumerWidget {
  const ExecutiveDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(executiveProfileNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Executive Suite'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/executive/profile'),
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _buildErrorState(context, error, ref),
        data: (profile) {
          if (profile == null) {
            return _buildOnboardingPrompt(context);
          }
          return _buildDashboard(context, ref, profile);
        },
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, Object error, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load profile',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              error.toString(),
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () {
                ref.read(executiveProfileNotifierProvider.notifier).loadProfile();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOnboardingPrompt(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.business_center,
                size: 64,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Become a Fractional Executive',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Join our network of vetted C-suite executives and connect with companies seeking fractional leadership.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () => context.push('/executive/onboarding'),
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Create Executive Profile'),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.push('/executive/browse'),
              child: const Text('Browse Executives'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(BuildContext context, WidgetRef ref, ExecutiveProfile profile) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.read(executiveProfileNotifierProvider.notifier).loadProfile();
        ref.invalidate(executiveStatsProvider(profile.id));
        ref.invalidate(activeEngagementsProvider(profile.id));
      },
      child: CustomScrollView(
        slivers: [
          // Vetting status banner (if not approved)
          if (!profile.isApproved)
            SliverToBoxAdapter(
              child: VettingStatusBanner(
                status: profile.vettingStatus,
                referencesProvided: profile.referencesProvided,
                referencesVerified: profile.referencesVerified,
              ),
            ),

          // Header with greeting
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome back',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          profile.executiveType.displayName,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (profile.isVerified)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.green.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified, size: 16, color: Colors.green),
                              SizedBox(width: 4),
                              Text(
                                'Verified',
                                style: TextStyle(
                                  color: Colors.green,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Quick stats
          SliverToBoxAdapter(
            child: _buildQuickStats(context, ref, profile),
          ),

          // Active engagements section
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Active Engagements',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextButton(
                    onPressed: () => context.push('/executive/engagements'),
                    child: const Text('View All'),
                  ),
                ],
              ),
            ),
          ),

          // Engagements list
          _buildEngagementsList(context, ref, profile.id),

          // Quick actions
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Quick Actions',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildQuickActions(context),
                ],
              ),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }

  Widget _buildQuickStats(BuildContext context, WidgetRef ref, ExecutiveProfile profile) {
    final statsAsync = ref.watch(executiveStatsProvider(profile.id));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: statsAsync.when(
        loading: () => const SizedBox(
          height: 100,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (_, __) => const SizedBox.shrink(),
        data: (stats) => Row(
          children: [
            Expanded(
              child: StatsCard(
                icon: Icons.work_outline,
                label: 'Active',
                value: stats.activeEngagements.toString(),
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatsCard(
                icon: Icons.schedule,
                label: 'Hours This Month',
                value: stats.totalHoursLogged.toStringAsFixed(0),
                color: Theme.of(context).colorScheme.secondary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatsCard(
                icon: Icons.flag_outlined,
                label: 'Milestones',
                value: stats.upcomingMilestones.toString(),
                color: Theme.of(context).colorScheme.tertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEngagementsList(BuildContext context, WidgetRef ref, String profileId) {
    final engagementsAsync = ref.watch(activeEngagementsProvider(profileId));

    return engagementsAsync.when(
      loading: () => const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (error, _) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Error loading engagements: $error'),
        ),
      ),
      data: (engagements) {
        if (engagements.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(
                    Icons.work_off_outlined,
                    size: 48,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No active engagements',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => context.push('/executive/browse'),
                    child: const Text('Find Opportunities'),
                  ),
                ],
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: EngagementCard(
                  engagement: engagements[index],
                  onTap: () => context.push('/executive/engagement/${engagements[index].id}'),
                ),
              ),
              childCount: engagements.length.clamp(0, 3),
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _ActionChip(
          icon: Icons.add_circle_outline,
          label: 'Log Time',
          onTap: () => context.push('/executive/time-entry'),
        ),
        _ActionChip(
          icon: Icons.flag_outlined,
          label: 'Add Milestone',
          onTap: () => context.push('/executive/milestone/new'),
        ),
        _ActionChip(
          icon: Icons.insights,
          label: 'View Reports',
          onTap: () => context.push('/executive/reports'),
        ),
        _ActionChip(
          icon: Icons.settings_outlined,
          label: 'Settings',
          onTap: () => context.push('/executive/settings'),
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }
}

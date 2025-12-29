import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/models/user.dart';

/// Profile screen
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (state) {
        final user = state.user;
        if (user == null) {
          return const Center(child: Text('Not logged in'));
        }

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              // Profile header
              SliverAppBar(
                expandedHeight: 200,
                pinned: true,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => context.push('/profile/edit'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.settings),
                    onPressed: () => context.push('/settings'),
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppTheme.primaryColor,
                          AppTheme.primaryColor.withOpacity(0.8),
                        ],
                      ),
                    ),
                    child: SafeArea(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: Colors.white,
                            child: Text(
                              user.fullName[0].toUpperCase(),
                              style: const TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primaryColor,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppTheme.spacingSm),
                          Text(
                            user.fullName,
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  color: Colors.white,
                                ),
                          ),
                          Text(
                            '@${user.email.split('@').first}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.white70,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Stats
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: Row(
                    children: [
                      Expanded(child: _StatCard(label: 'Jobs', value: '23')),
                      const SizedBox(width: AppTheme.spacingSm),
                      Expanded(child: _StatCard(label: 'Earnings', value: '\$12.5k')),
                      const SizedBox(width: AppTheme.spacingSm),
                      Expanded(child: _StatCard(label: 'Rating', value: '4.9')),
                    ],
                  ),
                ),
              ),

              // Menu sections
              SliverList(
                delegate: SliverChildListDelegate([
                  const _SectionHeader(title: 'Account'),
                  _MenuTile(
                    icon: Icons.person_outline,
                    title: 'Edit Profile',
                    onTap: () => context.push('/profile/edit'),
                  ),
                  _MenuTile(
                    icon: Icons.badge_outlined,
                    title: 'Skills & Portfolio',
                    onTap: () {},
                  ),
                  _MenuTile(
                    icon: Icons.verified_outlined,
                    title: 'Verification',
                    onTap: () {},
                  ),

                  const _SectionHeader(title: 'Billing'),
                  _MenuTile(
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'Payment Methods',
                    onTap: () {},
                  ),
                  _MenuTile(
                    icon: Icons.receipt_long_outlined,
                    title: 'Transaction History',
                    onTap: () {},
                  ),

                  const _SectionHeader(title: 'Settings'),
                  _MenuTile(
                    icon: Icons.notifications_outlined,
                    title: 'Notifications',
                    onTap: () => context.push('/notifications'),
                  ),
                  _MenuTile(
                    icon: Icons.security_outlined,
                    title: 'Security',
                    onTap: () {},
                  ),
                  _MenuTile(
                    icon: Icons.help_outline,
                    title: 'Help & Support',
                    onTap: () {},
                  ),

                  const SizedBox(height: AppTheme.spacingLg),

                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingMd,
                    ),
                    child: OutlinedButton(
                      onPressed: () {
                        ref.read(authStateProvider.notifier).logout();
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.errorColor,
                        side: const BorderSide(color: AppTheme.errorColor),
                      ),
                      child: const Text('Log Out'),
                    ),
                  ),

                  const SizedBox(height: AppTheme.spacing2xl),
                ]),
              ),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(child: Text('Error: $error')),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppTheme.primaryColor,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: AppTheme.spacingMd,
        right: AppTheme.spacingMd,
        top: AppTheme.spacingLg,
        bottom: AppTheme.spacingSm,
      ),
      child: Text(
        title,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppTheme.neutral500,
            ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.neutral600),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.neutral400),
      onTap: onTap,
    );
  }
}

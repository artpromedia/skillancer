import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models/executive_profile.dart';
import '../../domain/providers/executive_providers.dart';

/// Executive profile view/edit screen
class ExecutiveProfileScreen extends ConsumerWidget {
  final String? profileId;

  const ExecutiveProfileScreen({super.key, this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // If no profileId, show current user's profile
    final profileAsync = profileId != null
        ? ref.watch(executiveProfileProvider(profileId!))
        : ref.watch(executiveProfileNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Executive Profile'),
        actions: [
          if (profileId == null)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () => context.push('/executive/profile/edit'),
            ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
        data: (profile) {
          if (profile == null) {
            return const Center(child: Text('Profile not found'));
          }
          return _buildProfileContent(context, profile, isOwn: profileId == null);
        },
      ),
    );
  }

  Widget _buildProfileContent(BuildContext context, ExecutiveProfile profile, {required bool isOwn}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header card
          _buildHeaderCard(context, profile),
          const SizedBox(height: 24),

          // Verification status
          if (isOwn) ...[
            _buildVerificationSection(context, profile),
            const SizedBox(height: 24),
          ],

          // About section
          _buildSection(
            context,
            title: 'About',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.headline,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (profile.executiveSummary != null) ...[
                  const SizedBox(height: 12),
                  Text(profile.executiveSummary!),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Experience
          _buildSection(
            context,
            title: 'Experience',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow(context, 'Years of Experience', '${profile.yearsExecutiveExp}+ years'),
                if (profile.boardExperience)
                  _buildInfoRow(context, 'Board Experience', 'Yes'),
                if (profile.publicCompanyExp)
                  _buildInfoRow(context, 'Public Company Experience', 'Yes'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Industries
          if (profile.industries.isNotEmpty)
            _buildSection(
              context,
              title: 'Industries',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profile.industries
                    .map((i) => Chip(label: Text(i)))
                    .toList(),
              ),
            ),
          if (profile.industries.isNotEmpty) const SizedBox(height: 24),

          // Specializations
          if (profile.specializations.isNotEmpty)
            _buildSection(
              context,
              title: 'Specializations',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profile.specializations
                    .map((s) => Chip(label: Text(s)))
                    .toList(),
              ),
            ),
          if (profile.specializations.isNotEmpty) const SizedBox(height: 24),

          // Company stages
          if (profile.companyStagesExpertise.isNotEmpty)
            _buildSection(
              context,
              title: 'Company Stages',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profile.companyStagesExpertise
                    .map((s) => Chip(label: Text(s)))
                    .toList(),
              ),
            ),
          if (profile.companyStagesExpertise.isNotEmpty) const SizedBox(height: 24),

          // Past roles
          if (profile.pastRoles.isNotEmpty)
            _buildSection(
              context,
              title: 'Past Roles',
              child: Column(
                children: profile.pastRoles
                    .map((role) => _buildPastRoleCard(context, role))
                    .toList(),
              ),
            ),
          if (profile.pastRoles.isNotEmpty) const SizedBox(height: 24),

          // Notable achievements
          if (profile.notableAchievements.isNotEmpty)
            _buildSection(
              context,
              title: 'Notable Achievements',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: profile.notableAchievements
                    .map((a) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.star, size: 16, color: Colors.amber),
                              const SizedBox(width: 8),
                              Expanded(child: Text(a)),
                            ],
                          ),
                        ))
                    .toList(),
              ),
            ),
          if (profile.notableAchievements.isNotEmpty) const SizedBox(height: 24),

          // Availability & Rates
          _buildSection(
            context,
            title: 'Availability & Rates',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow(context, 'Capacity', '${profile.currentClientCount}/${profile.maxClients} clients'),
                _buildInfoRow(context, 'Hours/Week', '${profile.hoursPerWeekAvailable} hours'),
                if (profile.hourlyRateMin != null && profile.hourlyRateMax != null)
                  _buildInfoRow(
                    context,
                    'Hourly Rate',
                    '\$${profile.hourlyRateMin!.toInt()} - \$${profile.hourlyRateMax!.toInt()}',
                  ),
                if (profile.monthlyRetainerMin != null && profile.monthlyRetainerMax != null)
                  _buildInfoRow(
                    context,
                    'Monthly Retainer',
                    '\$${(profile.monthlyRetainerMin! / 1000).toInt()}k - \$${(profile.monthlyRetainerMax! / 1000).toInt()}k',
                  ),
                if (profile.equityOpenTo)
                  _buildInfoRow(context, 'Open to Equity', 'Yes'),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Action buttons
          if (!isOwn && profile.isApproved)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => context.push('/executive/propose/${profile.id}'),
                icon: const Icon(Icons.handshake),
                label: const Text('Propose Engagement'),
              ),
            ),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(BuildContext context, ExecutiveProfile profile) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(
                  profile.executiveType.shortName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        profile.executiveType.displayName,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (profile.isVerified) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.verified, color: Colors.blue, size: 20),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    profile.rateRange,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.visibility_outlined,
                        size: 14,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${profile.profileViews} views',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      if (profile.responseRate != null) ...[
                        const SizedBox(width: 16),
                        Icon(
                          Icons.reply,
                          size: 14,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${profile.responseRate!.toInt()}% response',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerificationSection(BuildContext context, ExecutiveProfile profile) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Verification Status',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            _buildVerificationItem(
              context,
              'LinkedIn',
              profile.linkedinVerified,
              profile.linkedinUrl != null,
            ),
            _buildVerificationItem(
              context,
              'Email Domain',
              profile.emailDomainVerified,
              profile.executiveEmailDomain != null,
            ),
            _buildVerificationItem(
              context,
              'Background Check',
              profile.backgroundCheckStatus == BackgroundCheckStatus.passed,
              profile.backgroundCheckStatus != BackgroundCheckStatus.notStarted,
            ),
            _buildVerificationItem(
              context,
              'References',
              profile.referencesVerified >= 2,
              profile.referencesProvided > 0,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerificationItem(BuildContext context, String label, bool verified, bool started) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            verified
                ? Icons.check_circle
                : (started ? Icons.pending : Icons.radio_button_unchecked),
            size: 20,
            color: verified
                ? Colors.green
                : (started ? Colors.orange : Colors.grey),
          ),
          const SizedBox(width: 12),
          Text(label),
          const Spacer(),
          Text(
            verified ? 'Verified' : (started ? 'Pending' : 'Not Started'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: verified
                  ? Colors.green
                  : (started ? Colors.orange : Colors.grey),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(BuildContext context, {required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        child,
      ],
    );
  }

  Widget _buildInfoRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPastRoleCard(BuildContext context, PastRole role) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              role.title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              role.company,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            Text(
              role.duration,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (role.achievements.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...role.achievements.map((a) => Padding(
                    padding: const EdgeInsets.only(left: 8, top: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('• '),
                        Expanded(child: Text(a, style: Theme.of(context).textTheme.bodySmall)),
                      ],
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

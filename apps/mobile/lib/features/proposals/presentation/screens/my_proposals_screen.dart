import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/proposal.dart';

/// My proposals list screen with tabs
class MyProposalsScreen extends ConsumerWidget {
  const MyProposalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My Proposals'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Active'),
              Tab(text: 'Pending'),
              Tab(text: 'Archived'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _ProposalsList(filter: _ProposalFilter.active),
            _ProposalsList(filter: _ProposalFilter.pending),
            _ProposalsList(filter: _ProposalFilter.archived),
          ],
        ),
      ),
    );
  }
}

enum _ProposalFilter { active, pending, archived }

class _ProposalsList extends ConsumerWidget {
  final _ProposalFilter filter;

  const _ProposalsList({required this.filter});

  List<Proposal> _filterProposals(List<Proposal> proposals) {
    switch (filter) {
      case _ProposalFilter.active:
        return proposals.where((p) => p.status.isActive).toList();
      case _ProposalFilter.pending:
        return proposals.where((p) => p.status == ProposalStatus.pending).toList();
      case _ProposalFilter.archived:
        return proposals
            .where((p) =>
                p.status == ProposalStatus.accepted ||
                p.status == ProposalStatus.rejected ||
                p.status == ProposalStatus.withdrawn)
            .toList();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final proposalsAsync = ref.watch(myProposalsProvider);

    return proposalsAsync.when(
      data: (proposals) {
        final filtered = _filterProposals(proposals);

        if (filtered.isEmpty) {
          return _EmptyState(filter: filter);
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(myProposalsProvider);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            itemCount: filtered.length,
            itemBuilder: (context, index) {
              return _ProposalCard(proposal: filtered[index]);
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppTheme.errorColor),
            const SizedBox(height: AppTheme.spacingMd),
            Text('Failed to load proposals'),
            TextButton(
              onPressed: () => ref.invalidate(myProposalsProvider),
              child: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProposalCard extends StatelessWidget {
  final Proposal proposal;

  const _ProposalCard({required this.proposal});

  Color _getStatusColor() {
    switch (proposal.status) {
      case ProposalStatus.accepted:
        return AppTheme.successColor;
      case ProposalStatus.rejected:
        return AppTheme.errorColor;
      case ProposalStatus.shortlisted:
        return AppTheme.accentColor;
      case ProposalStatus.viewed:
        return AppTheme.infoColor;
      default:
        return AppTheme.neutral500;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: InkWell(
        onTap: () => context.push('/proposals/${proposal.id}'),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status badge and time
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingSm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Text(
                      proposal.status.displayName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(),
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    timeago.format(proposal.submittedAt),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Job title
              Text(
                proposal.jobTitle,
                style: Theme.of(context).textTheme.titleMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Client and bid
              Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.neutral200,
                    child: Text(
                      proposal.clientName[0].toUpperCase(),
                      style: const TextStyle(fontSize: 10),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    proposal.clientName,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  Text(
                    '\$${proposal.bidAmount.toStringAsFixed(0)}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppTheme.primaryColor,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final _ProposalFilter filter;

  const _EmptyState({required this.filter});

  String get _message {
    switch (filter) {
      case _ProposalFilter.active:
        return 'No active proposals';
      case _ProposalFilter.pending:
        return 'No pending proposals';
      case _ProposalFilter.archived:
        return 'No archived proposals';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.description_outlined,
            size: 64,
            color: AppTheme.neutral400,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          Text(_message, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

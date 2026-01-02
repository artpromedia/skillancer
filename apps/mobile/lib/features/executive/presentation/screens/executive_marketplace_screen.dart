import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/executive_repository.dart';
import '../../domain/models/executive_profile.dart';
import '../../domain/providers/executive_providers.dart';

/// Marketplace screen for browsing and finding fractional executives
class ExecutiveMarketplaceScreen extends ConsumerStatefulWidget {
  const ExecutiveMarketplaceScreen({super.key});

  @override
  ConsumerState<ExecutiveMarketplaceScreen> createState() => _ExecutiveMarketplaceScreenState();
}

class _ExecutiveMarketplaceScreenState extends ConsumerState<ExecutiveMarketplaceScreen> {
  ExecutiveType? _selectedType;
  final List<String> _selectedIndustries = [];
  bool _availableNow = false;
  bool _hasBackgroundCheck = false;
  int _page = 1;

  ExecutiveSearchFilters get _filters => ExecutiveSearchFilters(
        executiveType: _selectedType,
        industries: _selectedIndustries.isNotEmpty ? _selectedIndustries : null,
        availableNow: _availableNow ? true : null,
        hasBackgroundCheck: _hasBackgroundCheck ? true : null,
        page: _page,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Executives'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilters,
          ),
        ],
      ),
      body: Column(
        children: [
          // Featured executives carousel
          _buildFeaturedSection(),

          // Active filters
          if (_hasActiveFilters) _buildActiveFilters(),

          // Executive type tabs
          _buildTypeSelector(),

          // Results list
          Expanded(child: _buildResultsList()),
        ],
      ),
    );
  }

  bool get _hasActiveFilters =>
      _selectedType != null ||
      _selectedIndustries.isNotEmpty ||
      _availableNow ||
      _hasBackgroundCheck;

  Widget _buildFeaturedSection() {
    final featuredAsync = ref.watch(featuredExecutivesProvider);

    return featuredAsync.when(
      loading: () => const SizedBox(height: 180),
      error: (_, __) => const SizedBox.shrink(),
      data: (executives) {
        if (executives.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                'Featured Executives',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            SizedBox(
              height: 180,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: executives.length,
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: _buildFeaturedCard(executives[index]),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFeaturedCard(ExecutiveProfile executive) {
    return SizedBox(
      width: 200,
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        ),
        child: InkWell(
          onTap: () => context.push('/executive/view/${executive.id}'),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          executive.executiveType.shortName,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (executive.isVerified)
                      const Icon(Icons.verified, color: Colors.blue, size: 20),
                  ],
                ),
                const Spacer(),
                Text(
                  executive.executiveType.displayName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  executive.headline,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Text(
                  executive.rateRange,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActiveFilters() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (_selectedType != null)
            Chip(
              label: Text(_selectedType!.displayName),
              onDeleted: () => setState(() => _selectedType = null),
            ),
          ..._selectedIndustries.map((industry) => Chip(
                label: Text(industry),
                onDeleted: () => setState(() => _selectedIndustries.remove(industry)),
              )),
          if (_availableNow)
            Chip(
              label: const Text('Available Now'),
              onDeleted: () => setState(() => _availableNow = false),
            ),
          if (_hasBackgroundCheck)
            Chip(
              label: const Text('Background Check'),
              onDeleted: () => setState(() => _hasBackgroundCheck = false),
            ),
          ActionChip(
            label: const Text('Clear All'),
            onPressed: _clearFilters,
          ),
        ],
      ),
    );
  }

  void _clearFilters() {
    setState(() {
      _selectedType = null;
      _selectedIndustries.clear();
      _availableNow = false;
      _hasBackgroundCheck = false;
      _page = 1;
    });
  }

  Widget _buildTypeSelector() {
    return SizedBox(
      height: 48,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: ExecutiveType.values.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: const Text('All'),
                selected: _selectedType == null,
                onSelected: (_) => setState(() => _selectedType = null),
              ),
            );
          }
          final type = ExecutiveType.values[index - 1];
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: ChoiceChip(
              label: Text(type.shortName),
              selected: _selectedType == type,
              onSelected: (_) => setState(() => _selectedType = type),
            ),
          );
        },
      ),
    );
  }

  Widget _buildResultsList() {
    final searchAsync = ref.watch(executiveSearchProvider(_filters));

    return searchAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
      data: (results) {
        if (results.executives.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.search_off,
                  size: 64,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: 16),
                Text(
                  'No executives found',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _clearFilters,
                  child: const Text('Clear filters'),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: results.executives.length + (results.hasMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == results.executives.length) {
              return Center(
                child: TextButton(
                  onPressed: () => setState(() => _page++),
                  child: const Text('Load More'),
                ),
              );
            }
            return _buildExecutiveListItem(results.executives[index]);
          },
        );
      },
    );
  }

  Widget _buildExecutiveListItem(ExecutiveProfile executive) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: () => context.push('/executive/view/${executive.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        executive.executiveType.shortName,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              executive.executiveType.displayName,
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (executive.isVerified) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, color: Colors.blue, size: 18),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${executive.yearsExecutiveExp}+ years experience',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        executive.rateRange,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (executive.hasCapacity)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Available',
                            style: TextStyle(
                              color: Colors.green,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                executive.headline,
                style: Theme.of(context).textTheme.bodyMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (executive.industries.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: executive.industries.take(3).map((i) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceVariant,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          i,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      )).toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showFilters() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Filters',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      _clearFilters();
                      Navigator.pop(context);
                    },
                    child: const Text('Clear All'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _buildFilterSection(
                    'Executive Type',
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: ExecutiveType.values.map((type) => FilterChip(
                            label: Text(type.displayName),
                            selected: _selectedType == type,
                            onSelected: (selected) {
                              setState(() => _selectedType = selected ? type : null);
                            },
                          )).toList(),
                    ),
                  ),
                  _buildFilterSection(
                    'Availability',
                    Column(
                      children: [
                        CheckboxListTile(
                          title: const Text('Available Now'),
                          value: _availableNow,
                          onChanged: (v) => setState(() => _availableNow = v ?? false),
                        ),
                        CheckboxListTile(
                          title: const Text('Has Background Check'),
                          value: _hasBackgroundCheck,
                          onChanged: (v) => setState(() => _hasBackgroundCheck = v ?? false),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 80),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Apply Filters'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterSection(String title, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        child,
        const SizedBox(height: 24),
      ],
    );
  }
}

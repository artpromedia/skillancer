import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/job.dart';
import '../../domain/models/job_filter.dart';

/// Job filters bottom sheet
class JobFiltersScreen extends ConsumerStatefulWidget {
  const JobFiltersScreen({super.key});

  @override
  ConsumerState<JobFiltersScreen> createState() => _JobFiltersScreenState();
}

class _JobFiltersScreenState extends ConsumerState<JobFiltersScreen> {
  late JobFilter _filter;
  RangeValues _budgetRange = const RangeValues(0, 10000);

  final _categories = [
    'Web Development',
    'Mobile Development',
    'Design',
    'Writing',
    'Marketing',
    'Data Science',
    'DevOps',
    'Other',
  ];

  final _skills = [
    'Flutter',
    'React',
    'Node.js',
    'Python',
    'TypeScript',
    'Figma',
    'AWS',
    'Docker',
  ];

  @override
  void initState() {
    super.initState();
    _filter = ref.read(jobsFilterProvider);
    _budgetRange = RangeValues(
      _filter.minBudget ?? 0,
      _filter.maxBudget ?? 10000,
    );
  }

  void _applyFilters() {
    ref.read(jobsFilterProvider.notifier).state = _filter.copyWith(
      minBudget: _budgetRange.start > 0 ? _budgetRange.start : null,
      maxBudget: _budgetRange.end < 10000 ? _budgetRange.end : null,
    );
    context.pop();
  }

  void _clearFilters() {
    setState(() {
      _filter = const JobFilter();
      _budgetRange = const RangeValues(0, 10000);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusXl),
        ),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.symmetric(vertical: AppTheme.spacingMd),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.neutral300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Filters',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                TextButton(
                  onPressed: _clearFilters,
                  child: const Text('Clear All'),
                ),
              ],
            ),
          ),

          const Divider(),

          // Filters
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              children: [
                // Category
                _SectionTitle(title: 'Category'),
                Wrap(
                  spacing: AppTheme.spacingSm,
                  runSpacing: AppTheme.spacingSm,
                  children: _categories.map((category) {
                    final isSelected = _filter.category == category;
                    return FilterChip(
                      label: Text(category),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          _filter = _filter.copyWith(
                            category: selected ? category : null,
                          );
                        });
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Budget range
                _SectionTitle(
                  title: 'Budget Range',
                  trailing: Text(
                    '\$${_budgetRange.start.toInt()} - \$${_budgetRange.end.toInt()}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                RangeSlider(
                  values: _budgetRange,
                  min: 0,
                  max: 10000,
                  divisions: 100,
                  labels: RangeLabels(
                    '\$${_budgetRange.start.toInt()}',
                    '\$${_budgetRange.end.toInt()}',
                  ),
                  onChanged: (values) {
                    setState(() => _budgetRange = values);
                  },
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Budget type
                _SectionTitle(title: 'Payment Type'),
                Row(
                  children: [
                    Expanded(
                      child: _OptionButton(
                        label: 'Fixed Price',
                        isSelected: _filter.budgetType == BudgetType.fixed,
                        onTap: () {
                          setState(() {
                            _filter = _filter.copyWith(
                              budgetType: _filter.budgetType == BudgetType.fixed
                                  ? null
                                  : BudgetType.fixed,
                            );
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: AppTheme.spacingSm),
                    Expanded(
                      child: _OptionButton(
                        label: 'Hourly',
                        isSelected: _filter.budgetType == BudgetType.hourly,
                        onTap: () {
                          setState(() {
                            _filter = _filter.copyWith(
                              budgetType:
                                  _filter.budgetType == BudgetType.hourly
                                      ? null
                                      : BudgetType.hourly,
                            );
                          });
                        },
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Experience level
                _SectionTitle(title: 'Experience Level'),
                Row(
                  children: ExperienceLevel.values.map((level) {
                    final isSelected = _filter.experienceLevel == level;
                    return Expanded(
                      child: Padding(
                        padding:
                            const EdgeInsets.only(right: AppTheme.spacingSm),
                        child: _OptionButton(
                          label: level.displayName,
                          isSelected: isSelected,
                          onTap: () {
                            setState(() {
                              _filter = _filter.copyWith(
                                experienceLevel: isSelected ? null : level,
                              );
                            });
                          },
                        ),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Project duration
                _SectionTitle(title: 'Project Duration'),
                Wrap(
                  spacing: AppTheme.spacingSm,
                  runSpacing: AppTheme.spacingSm,
                  children: ProjectDuration.values.map((duration) {
                    final isSelected = _filter.projectDuration == duration;
                    return FilterChip(
                      label: Text(duration.displayName),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          _filter = _filter.copyWith(
                            projectDuration: selected ? duration : null,
                          );
                        });
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Skills
                _SectionTitle(title: 'Skills'),
                Wrap(
                  spacing: AppTheme.spacingSm,
                  runSpacing: AppTheme.spacingSm,
                  children: _skills.map((skill) {
                    final isSelected = _filter.skills.contains(skill);
                    return FilterChip(
                      label: Text(skill),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          final skills = List<String>.from(_filter.skills);
                          if (selected) {
                            skills.add(skill);
                          } else {
                            skills.remove(skill);
                          }
                          _filter = _filter.copyWith(skills: skills);
                        });
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: AppTheme.spacingLg),

                // Remote toggle
                SwitchListTile(
                  title: const Text('Remote Only'),
                  value: _filter.isRemote == true,
                  onChanged: (value) {
                    setState(() {
                      _filter = _filter.copyWith(isRemote: value ? true : null);
                    });
                  },
                ),

                const SizedBox(height: AppTheme.spacing2xl),
              ],
            ),
          ),

          // Apply button
          Container(
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
                onPressed: _applyFilters,
                child: Text(
                  'Show Results (${_filter.activeFilterCount} filters)',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const _SectionTitle({required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class _OptionButton extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _OptionButton({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryColor.withOpacity(0.1)
              : Colors.transparent,
          border: Border.all(
            color: isSelected ? AppTheme.primaryColor : AppTheme.neutral300,
          ),
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? AppTheme.primaryColor : null,
          ),
        ),
      ),
    );
  }
}

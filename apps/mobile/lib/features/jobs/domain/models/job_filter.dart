import 'package:equatable/equatable.dart';

import 'job.dart';

/// Job filter model
class JobFilter extends Equatable {
  final String? query;
  final String? category;
  final double? minBudget;
  final double? maxBudget;
  final BudgetType? budgetType;
  final ExperienceLevel? experienceLevel;
  final ProjectDuration? projectDuration;
  final List<String> skills;
  final bool? isRemote;
  final JobSortBy sortBy;

  const JobFilter({
    this.query,
    this.category,
    this.minBudget,
    this.maxBudget,
    this.budgetType,
    this.experienceLevel,
    this.projectDuration,
    this.skills = const [],
    this.isRemote,
    this.sortBy = JobSortBy.relevance,
  });

  bool get hasFilters =>
      query != null ||
      category != null ||
      minBudget != null ||
      maxBudget != null ||
      budgetType != null ||
      experienceLevel != null ||
      projectDuration != null ||
      skills.isNotEmpty ||
      isRemote != null;

  int get activeFilterCount {
    int count = 0;
    if (category != null) count++;
    if (minBudget != null || maxBudget != null) count++;
    if (budgetType != null) count++;
    if (experienceLevel != null) count++;
    if (projectDuration != null) count++;
    if (skills.isNotEmpty) count++;
    if (isRemote != null) count++;
    return count;
  }

  JobFilter copyWith({
    String? query,
    String? category,
    double? minBudget,
    double? maxBudget,
    BudgetType? budgetType,
    ExperienceLevel? experienceLevel,
    ProjectDuration? projectDuration,
    List<String>? skills,
    bool? isRemote,
    JobSortBy? sortBy,
  }) {
    return JobFilter(
      query: query ?? this.query,
      category: category ?? this.category,
      minBudget: minBudget ?? this.minBudget,
      maxBudget: maxBudget ?? this.maxBudget,
      budgetType: budgetType ?? this.budgetType,
      experienceLevel: experienceLevel ?? this.experienceLevel,
      projectDuration: projectDuration ?? this.projectDuration,
      skills: skills ?? this.skills,
      isRemote: isRemote ?? this.isRemote,
      sortBy: sortBy ?? this.sortBy,
    );
  }

  JobFilter clear() => const JobFilter();

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (query != null) params['q'] = query;
    if (category != null) params['category'] = category;
    if (minBudget != null) params['minBudget'] = minBudget;
    if (maxBudget != null) params['maxBudget'] = maxBudget;
    if (budgetType != null) params['budgetType'] = budgetType!.name;
    if (experienceLevel != null) params['level'] = experienceLevel!.name;
    if (projectDuration != null) params['duration'] = projectDuration!.name;
    if (skills.isNotEmpty) params['skills'] = skills.join(',');
    if (isRemote != null) params['remote'] = isRemote;
    params['sort'] = sortBy.name;
    return params;
  }

  @override
  List<Object?> get props => [
        query,
        category,
        minBudget,
        maxBudget,
        budgetType,
        experienceLevel,
        projectDuration,
        skills,
        isRemote,
        sortBy,
      ];
}

enum JobSortBy {
  relevance,
  newest,
  budgetHigh,
  budgetLow,
  proposalsLow;

  String get displayName => switch (this) {
        JobSortBy.relevance => 'Best Match',
        JobSortBy.newest => 'Newest',
        JobSortBy.budgetHigh => 'Budget: High to Low',
        JobSortBy.budgetLow => 'Budget: Low to High',
        JobSortBy.proposalsLow => 'Fewest Proposals',
      };
}

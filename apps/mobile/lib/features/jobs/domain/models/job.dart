import 'package:equatable/equatable.dart';

/// Budget type enum
enum BudgetType {
  fixed,
  hourly;

  String get displayName => switch (this) {
        BudgetType.fixed => 'Fixed Price',
        BudgetType.hourly => 'Hourly',
      };
}

/// Experience level enum
enum ExperienceLevel {
  entry,
  intermediate,
  expert;

  String get displayName => switch (this) {
        ExperienceLevel.entry => 'Entry Level',
        ExperienceLevel.intermediate => 'Intermediate',
        ExperienceLevel.expert => 'Expert',
      };
}

/// Project duration enum
enum ProjectDuration {
  lessThanOneMonth,
  oneToThreeMonths,
  threeToSixMonths,
  moreThanSixMonths;

  String get displayName => switch (this) {
        ProjectDuration.lessThanOneMonth => 'Less than 1 month',
        ProjectDuration.oneToThreeMonths => '1-3 months',
        ProjectDuration.threeToSixMonths => '3-6 months',
        ProjectDuration.moreThanSixMonths => 'More than 6 months',
      };
}

/// Job model
class Job extends Equatable {
  final String id;
  final String title;
  final String description;
  final String clientName;
  final String? clientAvatarUrl;
  final double budget;
  final BudgetType budgetType;
  final List<String> skills;
  final DateTime postedAt;
  final int proposalCount;
  final ExperienceLevel experienceLevel;
  final ProjectDuration projectDuration;
  final bool isRemote;
  final String? location;
  final int? smartMatchScore;
  final String? category;

  const Job({
    required this.id,
    required this.title,
    required this.description,
    required this.clientName,
    this.clientAvatarUrl,
    required this.budget,
    required this.budgetType,
    required this.skills,
    required this.postedAt,
    required this.proposalCount,
    required this.experienceLevel,
    required this.projectDuration,
    required this.isRemote,
    this.location,
    this.smartMatchScore,
    this.category,
  });

  String get budgetDisplay {
    if (budgetType == BudgetType.hourly) {
      return '\$${budget.toStringAsFixed(0)}/hr';
    }
    return '\$${budget.toStringAsFixed(0)}';
  }

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      clientName: json['clientName'] as String,
      clientAvatarUrl: json['clientAvatarUrl'] as String?,
      budget: (json['budget'] as num).toDouble(),
      budgetType: BudgetType.values.firstWhere(
        (b) => b.name == json['budgetType'],
        orElse: () => BudgetType.fixed,
      ),
      skills: List<String>.from(json['skills'] as List),
      postedAt: DateTime.parse(json['postedAt'] as String),
      proposalCount: json['proposalCount'] as int? ?? 0,
      experienceLevel: ExperienceLevel.values.firstWhere(
        (e) => e.name == json['experienceLevel'],
        orElse: () => ExperienceLevel.intermediate,
      ),
      projectDuration: ProjectDuration.values.firstWhere(
        (d) => d.name == json['projectDuration'],
        orElse: () => ProjectDuration.oneToThreeMonths,
      ),
      isRemote: json['isRemote'] as bool? ?? true,
      location: json['location'] as String?,
      smartMatchScore: json['smartMatchScore'] as int?,
      category: json['category'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'clientName': clientName,
      'clientAvatarUrl': clientAvatarUrl,
      'budget': budget,
      'budgetType': budgetType.name,
      'skills': skills,
      'postedAt': postedAt.toIso8601String(),
      'proposalCount': proposalCount,
      'experienceLevel': experienceLevel.name,
      'projectDuration': projectDuration.name,
      'isRemote': isRemote,
      'location': location,
      'smartMatchScore': smartMatchScore,
      'category': category,
    };
  }

  @override
  List<Object?> get props => [id, title, budget, postedAt];
}

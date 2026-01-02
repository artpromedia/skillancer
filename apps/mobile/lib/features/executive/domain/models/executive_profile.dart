import 'package:equatable/equatable.dart';

/// Executive type enum for different C-suite roles
enum ExecutiveType {
  fractionalCto,
  fractionalCfo,
  fractionalCmo,
  fractionalCiso,
  fractionalCoo,
  fractionalChro,
  fractionalCpo,
  fractionalCro,
  boardAdvisor,
  interimExecutive;

  String get displayName => switch (this) {
        ExecutiveType.fractionalCto => 'Fractional CTO',
        ExecutiveType.fractionalCfo => 'Fractional CFO',
        ExecutiveType.fractionalCmo => 'Fractional CMO',
        ExecutiveType.fractionalCiso => 'Fractional CISO',
        ExecutiveType.fractionalCoo => 'Fractional COO',
        ExecutiveType.fractionalChro => 'Fractional CHRO',
        ExecutiveType.fractionalCpo => 'Fractional CPO',
        ExecutiveType.fractionalCro => 'Fractional CRO',
        ExecutiveType.boardAdvisor => 'Board Advisor',
        ExecutiveType.interimExecutive => 'Interim Executive',
      };

  String get shortName => switch (this) {
        ExecutiveType.fractionalCto => 'CTO',
        ExecutiveType.fractionalCfo => 'CFO',
        ExecutiveType.fractionalCmo => 'CMO',
        ExecutiveType.fractionalCiso => 'CISO',
        ExecutiveType.fractionalCoo => 'COO',
        ExecutiveType.fractionalChro => 'CHRO',
        ExecutiveType.fractionalCpo => 'CPO',
        ExecutiveType.fractionalCro => 'CRO',
        ExecutiveType.boardAdvisor => 'Advisor',
        ExecutiveType.interimExecutive => 'Interim',
      };

  String get apiValue => switch (this) {
        ExecutiveType.fractionalCto => 'FRACTIONAL_CTO',
        ExecutiveType.fractionalCfo => 'FRACTIONAL_CFO',
        ExecutiveType.fractionalCmo => 'FRACTIONAL_CMO',
        ExecutiveType.fractionalCiso => 'FRACTIONAL_CISO',
        ExecutiveType.fractionalCoo => 'FRACTIONAL_COO',
        ExecutiveType.fractionalChro => 'FRACTIONAL_CHRO',
        ExecutiveType.fractionalCpo => 'FRACTIONAL_CPO',
        ExecutiveType.fractionalCro => 'FRACTIONAL_CRO',
        ExecutiveType.boardAdvisor => 'BOARD_ADVISOR',
        ExecutiveType.interimExecutive => 'INTERIM_EXECUTIVE',
      };

  static ExecutiveType fromApiValue(String value) {
    return ExecutiveType.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => ExecutiveType.fractionalCto,
    );
  }
}

/// Vetting status for executive approval pipeline
enum VettingStatus {
  pending,
  applicationReview,
  interviewScheduled,
  interviewCompleted,
  referenceCheck,
  approved,
  rejected,
  suspended;

  String get displayName => switch (this) {
        VettingStatus.pending => 'Pending',
        VettingStatus.applicationReview => 'Application Review',
        VettingStatus.interviewScheduled => 'Interview Scheduled',
        VettingStatus.interviewCompleted => 'Interview Completed',
        VettingStatus.referenceCheck => 'Reference Check',
        VettingStatus.approved => 'Approved',
        VettingStatus.rejected => 'Rejected',
        VettingStatus.suspended => 'Suspended',
      };

  bool get isApproved => this == VettingStatus.approved;
  bool get isPending => this != VettingStatus.approved &&
                        this != VettingStatus.rejected &&
                        this != VettingStatus.suspended;

  String get apiValue => switch (this) {
        VettingStatus.pending => 'PENDING',
        VettingStatus.applicationReview => 'APPLICATION_REVIEW',
        VettingStatus.interviewScheduled => 'INTERVIEW_SCHEDULED',
        VettingStatus.interviewCompleted => 'INTERVIEW_COMPLETED',
        VettingStatus.referenceCheck => 'REFERENCE_CHECK',
        VettingStatus.approved => 'APPROVED',
        VettingStatus.rejected => 'REJECTED',
        VettingStatus.suspended => 'SUSPENDED',
      };

  static VettingStatus fromApiValue(String value) {
    return VettingStatus.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => VettingStatus.pending,
    );
  }
}

/// Background check status
enum BackgroundCheckStatus {
  notStarted,
  inProgress,
  passed,
  failed,
  expired;

  String get displayName => switch (this) {
        BackgroundCheckStatus.notStarted => 'Not Started',
        BackgroundCheckStatus.inProgress => 'In Progress',
        BackgroundCheckStatus.passed => 'Passed',
        BackgroundCheckStatus.failed => 'Failed',
        BackgroundCheckStatus.expired => 'Expired',
      };

  String get apiValue => switch (this) {
        BackgroundCheckStatus.notStarted => 'NOT_STARTED',
        BackgroundCheckStatus.inProgress => 'IN_PROGRESS',
        BackgroundCheckStatus.passed => 'PASSED',
        BackgroundCheckStatus.failed => 'FAILED',
        BackgroundCheckStatus.expired => 'EXPIRED',
      };

  static BackgroundCheckStatus fromApiValue(String value) {
    return BackgroundCheckStatus.values.firstWhere(
      (e) => e.apiValue == value,
      orElse: () => BackgroundCheckStatus.notStarted,
    );
  }
}

/// Past executive role
class PastRole extends Equatable {
  final String title;
  final String company;
  final String duration;
  final List<String> achievements;

  const PastRole({
    required this.title,
    required this.company,
    required this.duration,
    this.achievements = const [],
  });

  factory PastRole.fromJson(Map<String, dynamic> json) {
    return PastRole(
      title: json['title'] as String? ?? '',
      company: json['company'] as String? ?? '',
      duration: json['duration'] as String? ?? '',
      achievements: (json['achievements'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'company': company,
        'duration': duration,
        'achievements': achievements,
      };

  @override
  List<Object?> get props => [title, company, duration, achievements];
}

/// Executive profile model
class ExecutiveProfile extends Equatable {
  final String id;
  final String userId;
  final ExecutiveType executiveType;
  final String headline;
  final String? executiveSummary;
  final int yearsExecutiveExp;
  final List<String> industries;
  final List<String> specializations;
  final List<String> companyStagesExpertise;
  final List<PastRole> pastRoles;
  final List<String> notableAchievements;
  final bool boardExperience;
  final bool publicCompanyExp;

  // Vetting
  final VettingStatus vettingStatus;
  final DateTime? vettingStartedAt;
  final DateTime? vettingCompletedAt;
  final int? interviewScore;
  final BackgroundCheckStatus backgroundCheckStatus;
  final DateTime? backgroundCheckDate;
  final DateTime? backgroundCheckExpiry;
  final int referencesProvided;
  final int referencesVerified;
  final double? referenceScore;

  // Capacity
  final int maxClients;
  final int currentClientCount;
  final int hoursPerWeekAvailable;
  final DateTime? availableFrom;

  // Pricing
  final double? monthlyRetainerMin;
  final double? monthlyRetainerMax;
  final double? hourlyRateMin;
  final double? hourlyRateMax;
  final bool equityOpenTo;

  // Verification
  final String? linkedinUrl;
  final bool linkedinVerified;
  final String? executiveEmailDomain;
  final bool emailDomainVerified;

  // Platform status
  final bool featuredExecutive;
  final bool searchable;
  final int profileViews;
  final double? responseRate;
  final int? avgResponseTime;

  final DateTime createdAt;
  final DateTime updatedAt;

  const ExecutiveProfile({
    required this.id,
    required this.userId,
    required this.executiveType,
    required this.headline,
    this.executiveSummary,
    this.yearsExecutiveExp = 0,
    this.industries = const [],
    this.specializations = const [],
    this.companyStagesExpertise = const [],
    this.pastRoles = const [],
    this.notableAchievements = const [],
    this.boardExperience = false,
    this.publicCompanyExp = false,
    this.vettingStatus = VettingStatus.pending,
    this.vettingStartedAt,
    this.vettingCompletedAt,
    this.interviewScore,
    this.backgroundCheckStatus = BackgroundCheckStatus.notStarted,
    this.backgroundCheckDate,
    this.backgroundCheckExpiry,
    this.referencesProvided = 0,
    this.referencesVerified = 0,
    this.referenceScore,
    this.maxClients = 5,
    this.currentClientCount = 0,
    this.hoursPerWeekAvailable = 20,
    this.availableFrom,
    this.monthlyRetainerMin,
    this.monthlyRetainerMax,
    this.hourlyRateMin,
    this.hourlyRateMax,
    this.equityOpenTo = false,
    this.linkedinUrl,
    this.linkedinVerified = false,
    this.executiveEmailDomain,
    this.emailDomainVerified = false,
    this.featuredExecutive = false,
    this.searchable = true,
    this.profileViews = 0,
    this.responseRate,
    this.avgResponseTime,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isAvailable => currentClientCount < maxClients;
  bool get isVerified => linkedinVerified || emailDomainVerified;
  bool get isApproved => vettingStatus == VettingStatus.approved;
  bool get hasCapacity => currentClientCount < maxClients;

  String get rateRange {
    if (hourlyRateMin != null && hourlyRateMax != null) {
      return '\$${hourlyRateMin!.toInt()}-\$${hourlyRateMax!.toInt()}/hr';
    } else if (monthlyRetainerMin != null && monthlyRetainerMax != null) {
      return '\$${(monthlyRetainerMin! / 1000).toInt()}k-\$${(monthlyRetainerMax! / 1000).toInt()}k/mo';
    }
    return 'Contact for rates';
  }

  factory ExecutiveProfile.fromJson(Map<String, dynamic> json) {
    return ExecutiveProfile(
      id: json['id'] as String,
      userId: json['userId'] as String,
      executiveType: ExecutiveType.fromApiValue(json['executiveType'] as String),
      headline: json['headline'] as String? ?? '',
      executiveSummary: json['executiveSummary'] as String?,
      yearsExecutiveExp: json['yearsExecutiveExp'] as int? ?? 0,
      industries: List<String>.from(json['industries'] ?? []),
      specializations: List<String>.from(json['specializations'] ?? []),
      companyStagesExpertise: List<String>.from(json['companyStagesExpertise'] ?? []),
      pastRoles: (json['pastRoles'] as List<dynamic>?)
              ?.map((e) => PastRole.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      notableAchievements: List<String>.from(json['notableAchievements'] ?? []),
      boardExperience: json['boardExperience'] as bool? ?? false,
      publicCompanyExp: json['publicCompanyExp'] as bool? ?? false,
      vettingStatus: VettingStatus.fromApiValue(json['vettingStatus'] as String? ?? 'PENDING'),
      vettingStartedAt: json['vettingStartedAt'] != null
          ? DateTime.parse(json['vettingStartedAt'] as String)
          : null,
      vettingCompletedAt: json['vettingCompletedAt'] != null
          ? DateTime.parse(json['vettingCompletedAt'] as String)
          : null,
      interviewScore: json['interviewScore'] as int?,
      backgroundCheckStatus: BackgroundCheckStatus.fromApiValue(
          json['backgroundCheckStatus'] as String? ?? 'NOT_STARTED'),
      backgroundCheckDate: json['backgroundCheckDate'] != null
          ? DateTime.parse(json['backgroundCheckDate'] as String)
          : null,
      backgroundCheckExpiry: json['backgroundCheckExpiry'] != null
          ? DateTime.parse(json['backgroundCheckExpiry'] as String)
          : null,
      referencesProvided: json['referencesProvided'] as int? ?? 0,
      referencesVerified: json['referencesVerified'] as int? ?? 0,
      referenceScore: (json['referenceScore'] as num?)?.toDouble(),
      maxClients: json['maxClients'] as int? ?? 5,
      currentClientCount: json['currentClientCount'] as int? ?? 0,
      hoursPerWeekAvailable: json['hoursPerWeekAvailable'] as int? ?? 20,
      availableFrom: json['availableFrom'] != null
          ? DateTime.parse(json['availableFrom'] as String)
          : null,
      monthlyRetainerMin: (json['monthlyRetainerMin'] as num?)?.toDouble(),
      monthlyRetainerMax: (json['monthlyRetainerMax'] as num?)?.toDouble(),
      hourlyRateMin: (json['hourlyRateMin'] as num?)?.toDouble(),
      hourlyRateMax: (json['hourlyRateMax'] as num?)?.toDouble(),
      equityOpenTo: json['equityOpenTo'] as bool? ?? false,
      linkedinUrl: json['linkedinUrl'] as String?,
      linkedinVerified: json['linkedinVerified'] as bool? ?? false,
      executiveEmailDomain: json['executiveEmailDomain'] as String?,
      emailDomainVerified: json['emailDomainVerified'] as bool? ?? false,
      featuredExecutive: json['featuredExecutive'] as bool? ?? false,
      searchable: json['searchable'] as bool? ?? true,
      profileViews: json['profileViews'] as int? ?? 0,
      responseRate: (json['responseRate'] as num?)?.toDouble(),
      avgResponseTime: json['avgResponseTime'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'executiveType': executiveType.apiValue,
        'headline': headline,
        'executiveSummary': executiveSummary,
        'yearsExecutiveExp': yearsExecutiveExp,
        'industries': industries,
        'specializations': specializations,
        'companyStagesExpertise': companyStagesExpertise,
        'pastRoles': pastRoles.map((e) => e.toJson()).toList(),
        'notableAchievements': notableAchievements,
        'boardExperience': boardExperience,
        'publicCompanyExp': publicCompanyExp,
        'vettingStatus': vettingStatus.apiValue,
        'maxClients': maxClients,
        'currentClientCount': currentClientCount,
        'hoursPerWeekAvailable': hoursPerWeekAvailable,
        'availableFrom': availableFrom?.toIso8601String(),
        'monthlyRetainerMin': monthlyRetainerMin,
        'monthlyRetainerMax': monthlyRetainerMax,
        'hourlyRateMin': hourlyRateMin,
        'hourlyRateMax': hourlyRateMax,
        'equityOpenTo': equityOpenTo,
        'linkedinUrl': linkedinUrl,
        'searchable': searchable,
      };

  ExecutiveProfile copyWith({
    String? id,
    String? userId,
    ExecutiveType? executiveType,
    String? headline,
    String? executiveSummary,
    int? yearsExecutiveExp,
    List<String>? industries,
    List<String>? specializations,
    List<String>? companyStagesExpertise,
    List<PastRole>? pastRoles,
    List<String>? notableAchievements,
    bool? boardExperience,
    bool? publicCompanyExp,
    VettingStatus? vettingStatus,
    int? maxClients,
    int? currentClientCount,
    int? hoursPerWeekAvailable,
    DateTime? availableFrom,
    double? monthlyRetainerMin,
    double? monthlyRetainerMax,
    double? hourlyRateMin,
    double? hourlyRateMax,
    bool? equityOpenTo,
    String? linkedinUrl,
    bool? searchable,
  }) {
    return ExecutiveProfile(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      executiveType: executiveType ?? this.executiveType,
      headline: headline ?? this.headline,
      executiveSummary: executiveSummary ?? this.executiveSummary,
      yearsExecutiveExp: yearsExecutiveExp ?? this.yearsExecutiveExp,
      industries: industries ?? this.industries,
      specializations: specializations ?? this.specializations,
      companyStagesExpertise: companyStagesExpertise ?? this.companyStagesExpertise,
      pastRoles: pastRoles ?? this.pastRoles,
      notableAchievements: notableAchievements ?? this.notableAchievements,
      boardExperience: boardExperience ?? this.boardExperience,
      publicCompanyExp: publicCompanyExp ?? this.publicCompanyExp,
      vettingStatus: vettingStatus ?? this.vettingStatus,
      vettingStartedAt: this.vettingStartedAt,
      vettingCompletedAt: this.vettingCompletedAt,
      interviewScore: this.interviewScore,
      backgroundCheckStatus: this.backgroundCheckStatus,
      backgroundCheckDate: this.backgroundCheckDate,
      backgroundCheckExpiry: this.backgroundCheckExpiry,
      referencesProvided: this.referencesProvided,
      referencesVerified: this.referencesVerified,
      referenceScore: this.referenceScore,
      maxClients: maxClients ?? this.maxClients,
      currentClientCount: currentClientCount ?? this.currentClientCount,
      hoursPerWeekAvailable: hoursPerWeekAvailable ?? this.hoursPerWeekAvailable,
      availableFrom: availableFrom ?? this.availableFrom,
      monthlyRetainerMin: monthlyRetainerMin ?? this.monthlyRetainerMin,
      monthlyRetainerMax: monthlyRetainerMax ?? this.monthlyRetainerMax,
      hourlyRateMin: hourlyRateMin ?? this.hourlyRateMin,
      hourlyRateMax: hourlyRateMax ?? this.hourlyRateMax,
      equityOpenTo: equityOpenTo ?? this.equityOpenTo,
      linkedinUrl: linkedinUrl ?? this.linkedinUrl,
      linkedinVerified: this.linkedinVerified,
      executiveEmailDomain: this.executiveEmailDomain,
      emailDomainVerified: this.emailDomainVerified,
      featuredExecutive: this.featuredExecutive,
      searchable: searchable ?? this.searchable,
      profileViews: this.profileViews,
      responseRate: this.responseRate,
      avgResponseTime: this.avgResponseTime,
      createdAt: this.createdAt,
      updatedAt: DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [id, userId, executiveType, vettingStatus];
}

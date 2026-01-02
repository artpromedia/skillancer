/// Finances Domain Models
/// Sprint M5: Freelancer Financial Services
library;

/// Treasury account balance model
class TreasuryBalance {
  final double available;
  final double pending;
  final double reserved;
  final double taxVault;
  final String currency;
  final DateTime updatedAt;

  const TreasuryBalance({
    required this.available,
    required this.pending,
    required this.reserved,
    required this.taxVault,
    this.currency = 'USD',
    required this.updatedAt,
  });

  double get total => available + pending;
  double get payableBalance => available - reserved - taxVault;

  factory TreasuryBalance.fromJson(Map<String, dynamic> json) {
    return TreasuryBalance(
      available: (json['available'] as num).toDouble(),
      pending: (json['pending'] as num).toDouble(),
      reserved: (json['reserved'] as num).toDouble(),
      taxVault: (json['taxVault'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'available': available,
        'pending': pending,
        'reserved': reserved,
        'taxVault': taxVault,
        'currency': currency,
        'updatedAt': updatedAt.toIso8601String(),
      };
}

/// Payout destination types
enum PayoutDestination {
  skillancerCard,
  externalDebit,
  bankAccount,
}

/// Payout speed options
enum PayoutSpeed {
  instant,
  standard,
}

/// Payout status
enum PayoutStatus {
  pending,
  processing,
  completed,
  failed,
  cancelled,
}

/// Payout model
class Payout {
  final String id;
  final double amount;
  final double fee;
  final PayoutSpeed speed;
  final PayoutDestination destination;
  final String destinationLast4;
  final PayoutStatus status;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? failureReason;

  const Payout({
    required this.id,
    required this.amount,
    required this.fee,
    required this.speed,
    required this.destination,
    required this.destinationLast4,
    required this.status,
    required this.createdAt,
    this.completedAt,
    this.failureReason,
  });

  double get netAmount => amount - fee;

  factory Payout.fromJson(Map<String, dynamic> json) {
    return Payout(
      id: json['id'] as String,
      amount: (json['amount'] as num).toDouble(),
      fee: (json['fee'] as num).toDouble(),
      speed: PayoutSpeed.values.byName(json['speed'] as String),
      destination:
          PayoutDestination.values.byName(json['destination'] as String),
      destinationLast4: json['destinationLast4'] as String,
      status: PayoutStatus.values.byName(json['status'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      failureReason: json['failureReason'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'amount': amount,
        'fee': fee,
        'speed': speed.name,
        'destination': destination.name,
        'destinationLast4': destinationLast4,
        'status': status.name,
        'createdAt': createdAt.toIso8601String(),
        'completedAt': completedAt?.toIso8601String(),
        'failureReason': failureReason,
      };
}

/// Card type
enum CardType {
  virtual,
  physical,
}

/// Card status
enum CardStatus {
  active,
  frozen,
  cancelled,
}

/// Skillancer Card model
class SkillancerCard {
  final String id;
  final CardType type;
  final String last4;
  final String brand;
  final String expiryMonth;
  final String expiryYear;
  final CardStatus status;
  final SpendingLimits spendingLimits;
  final bool digitalWalletEnabled;
  final DateTime createdAt;

  const SkillancerCard({
    required this.id,
    required this.type,
    required this.last4,
    required this.brand,
    required this.expiryMonth,
    required this.expiryYear,
    required this.status,
    required this.spendingLimits,
    this.digitalWalletEnabled = false,
    required this.createdAt,
  });

  String get expiryFormatted => '$expiryMonth/$expiryYear';
  bool get isActive => status == CardStatus.active;
  bool get isFrozen => status == CardStatus.frozen;

  factory SkillancerCard.fromJson(Map<String, dynamic> json) {
    return SkillancerCard(
      id: json['id'] as String,
      type: CardType.values.byName(json['type'] as String),
      last4: json['last4'] as String,
      brand: json['brand'] as String? ?? 'Visa',
      expiryMonth: json['expiryMonth'] as String,
      expiryYear: json['expiryYear'] as String,
      status: CardStatus.values.byName(json['status'] as String),
      spendingLimits: SpendingLimits.fromJson(
          json['spendingLimits'] as Map<String, dynamic>),
      digitalWalletEnabled: json['digitalWalletEnabled'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'last4': last4,
        'brand': brand,
        'expiryMonth': expiryMonth,
        'expiryYear': expiryYear,
        'status': status.name,
        'spendingLimits': spendingLimits.toJson(),
        'digitalWalletEnabled': digitalWalletEnabled,
        'createdAt': createdAt.toIso8601String(),
      };
}

/// Spending limits for cards
class SpendingLimits {
  final double perTransaction;
  final double daily;
  final double dailyUsed;
  final double weekly;
  final double weeklyUsed;
  final double monthly;
  final double monthlyUsed;

  const SpendingLimits({
    required this.perTransaction,
    required this.daily,
    this.dailyUsed = 0,
    required this.weekly,
    this.weeklyUsed = 0,
    required this.monthly,
    this.monthlyUsed = 0,
  });

  double get dailyRemaining => daily - dailyUsed;
  double get weeklyRemaining => weekly - weeklyUsed;
  double get monthlyRemaining => monthly - monthlyUsed;

  factory SpendingLimits.fromJson(Map<String, dynamic> json) {
    return SpendingLimits(
      perTransaction: (json['perTransaction'] as num).toDouble(),
      daily: (json['daily'] as num).toDouble(),
      dailyUsed: (json['dailyUsed'] as num?)?.toDouble() ?? 0,
      weekly: (json['weekly'] as num).toDouble(),
      weeklyUsed: (json['weeklyUsed'] as num?)?.toDouble() ?? 0,
      monthly: (json['monthly'] as num).toDouble(),
      monthlyUsed: (json['monthlyUsed'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'perTransaction': perTransaction,
        'daily': daily,
        'dailyUsed': dailyUsed,
        'weekly': weekly,
        'weeklyUsed': weeklyUsed,
        'monthly': monthly,
        'monthlyUsed': monthlyUsed,
      };
}

/// Card transaction category
enum TransactionCategory {
  software,
  office,
  travel,
  meals,
  professional,
  advertising,
  utilities,
  equipment,
  education,
  other,
}

/// Card transaction model
class CardTransaction {
  final String id;
  final String cardId;
  final String merchantName;
  final TransactionCategory category;
  final double amount;
  final String currency;
  final String status;
  final DateTime createdAt;
  final String? receiptUrl;

  const CardTransaction({
    required this.id,
    required this.cardId,
    required this.merchantName,
    required this.category,
    required this.amount,
    this.currency = 'USD',
    required this.status,
    required this.createdAt,
    this.receiptUrl,
  });

  factory CardTransaction.fromJson(Map<String, dynamic> json) {
    return CardTransaction(
      id: json['id'] as String,
      cardId: json['cardId'] as String,
      merchantName: json['merchantName'] as String,
      category: TransactionCategory.values.byName(json['category'] as String),
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      receiptUrl: json['receiptUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'cardId': cardId,
        'merchantName': merchantName,
        'category': category.name,
        'amount': amount,
        'currency': currency,
        'status': status,
        'createdAt': createdAt.toIso8601String(),
        'receiptUrl': receiptUrl,
      };
}

/// Tax vault settings
class TaxVaultSettings {
  final double savingsRate;
  final bool autoSaveEnabled;
  final double minBalance;
  final bool notificationsEnabled;

  const TaxVaultSettings({
    this.savingsRate = 25,
    this.autoSaveEnabled = true,
    this.minBalance = 100,
    this.notificationsEnabled = true,
  });

  factory TaxVaultSettings.fromJson(Map<String, dynamic> json) {
    return TaxVaultSettings(
      savingsRate: (json['savingsRate'] as num?)?.toDouble() ?? 25,
      autoSaveEnabled: json['autoSaveEnabled'] as bool? ?? true,
      minBalance: (json['minBalance'] as num?)?.toDouble() ?? 100,
      notificationsEnabled: json['notificationsEnabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'savingsRate': savingsRate,
        'autoSaveEnabled': autoSaveEnabled,
        'minBalance': minBalance,
        'notificationsEnabled': notificationsEnabled,
      };
}

/// Tax vault summary
class TaxVaultSummary {
  final double balance;
  final TaxVaultSettings settings;
  final double totalSavedThisYear;
  final double totalWithdrawnThisYear;
  final double targetQuarterly;
  final QuarterlyPaymentStatus nextQuarter;

  const TaxVaultSummary({
    required this.balance,
    required this.settings,
    required this.totalSavedThisYear,
    required this.totalWithdrawnThisYear,
    required this.targetQuarterly,
    required this.nextQuarter,
  });

  double get progressToTarget =>
      targetQuarterly > 0 ? (balance / targetQuarterly).clamp(0, 1) : 0;

  factory TaxVaultSummary.fromJson(Map<String, dynamic> json) {
    return TaxVaultSummary(
      balance: (json['balance'] as num).toDouble(),
      settings:
          TaxVaultSettings.fromJson(json['settings'] as Map<String, dynamic>),
      totalSavedThisYear: (json['totalSavedThisYear'] as num).toDouble(),
      totalWithdrawnThisYear:
          (json['totalWithdrawnThisYear'] as num).toDouble(),
      targetQuarterly: (json['targetQuarterly'] as num).toDouble(),
      nextQuarter: QuarterlyPaymentStatus.fromJson(
          json['nextQuarter'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'balance': balance,
        'settings': settings.toJson(),
        'totalSavedThisYear': totalSavedThisYear,
        'totalWithdrawnThisYear': totalWithdrawnThisYear,
        'targetQuarterly': targetQuarterly,
        'nextQuarter': nextQuarter.toJson(),
      };
}

/// Quarterly payment status
class QuarterlyPaymentStatus {
  final int quarter;
  final int year;
  final DateTime dueDate;
  final double estimatedAmount;
  final double paidAmount;
  final String status;
  final int daysUntilDue;

  const QuarterlyPaymentStatus({
    required this.quarter,
    required this.year,
    required this.dueDate,
    required this.estimatedAmount,
    this.paidAmount = 0,
    required this.status,
    required this.daysUntilDue,
  });

  bool get isPaid => status == 'paid';
  bool get isOverdue => status == 'overdue';
  bool get isDueSoon => daysUntilDue <= 14 && daysUntilDue > 0;

  factory QuarterlyPaymentStatus.fromJson(Map<String, dynamic> json) {
    return QuarterlyPaymentStatus(
      quarter: json['quarter'] as int,
      year: json['year'] as int,
      dueDate: DateTime.parse(json['dueDate'] as String),
      estimatedAmount: (json['estimatedAmount'] as num).toDouble(),
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String,
      daysUntilDue: json['daysUntilDue'] as int,
    );
  }

  Map<String, dynamic> toJson() => {
        'quarter': quarter,
        'year': year,
        'dueDate': dueDate.toIso8601String(),
        'estimatedAmount': estimatedAmount,
        'paidAmount': paidAmount,
        'status': status,
        'daysUntilDue': daysUntilDue,
      };
}

/// Tax estimate model
class TaxEstimate {
  final int year;
  final double grossIncome;
  final double totalDeductions;
  final double taxableIncome;
  final double federalTax;
  final double selfEmploymentTax;
  final double stateTax;
  final double totalTax;
  final double effectiveRate;
  final double quarterlyPayment;

  const TaxEstimate({
    required this.year,
    required this.grossIncome,
    required this.totalDeductions,
    required this.taxableIncome,
    required this.federalTax,
    required this.selfEmploymentTax,
    required this.stateTax,
    required this.totalTax,
    required this.effectiveRate,
    required this.quarterlyPayment,
  });

  factory TaxEstimate.fromJson(Map<String, dynamic> json) {
    return TaxEstimate(
      year: json['year'] as int,
      grossIncome: (json['grossIncome'] as num).toDouble(),
      totalDeductions: (json['totalDeductions'] as num).toDouble(),
      taxableIncome: (json['taxableIncome'] as num).toDouble(),
      federalTax: (json['federalTax'] as num).toDouble(),
      selfEmploymentTax: (json['selfEmploymentTax'] as num).toDouble(),
      stateTax: (json['stateTax'] as num).toDouble(),
      totalTax: (json['totalTax'] as num).toDouble(),
      effectiveRate: (json['effectiveRate'] as num).toDouble(),
      quarterlyPayment: (json['quarterlyPayment'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'year': year,
        'grossIncome': grossIncome,
        'totalDeductions': totalDeductions,
        'taxableIncome': taxableIncome,
        'federalTax': federalTax,
        'selfEmploymentTax': selfEmploymentTax,
        'stateTax': stateTax,
        'totalTax': totalTax,
        'effectiveRate': effectiveRate,
        'quarterlyPayment': quarterlyPayment,
      };
}

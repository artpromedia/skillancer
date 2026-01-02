import 'package:equatable/equatable.dart';

/// Verification status for references
enum ReferenceVerificationStatus {
  pending,
  contacted,
  verified,
  failed;

  String get displayName => switch (this) {
        ReferenceVerificationStatus.pending => 'Pending',
        ReferenceVerificationStatus.contacted => 'Contacted',
        ReferenceVerificationStatus.verified => 'Verified',
        ReferenceVerificationStatus.failed => 'Failed',
      };

  String get apiValue => name.toUpperCase();

  static ReferenceVerificationStatus fromApiValue(String value) {
    return ReferenceVerificationStatus.values.firstWhere(
      (e) => e.apiValue == value.toUpperCase(),
      orElse: () => ReferenceVerificationStatus.pending,
    );
  }
}

/// Executive reference model
class ExecutiveReference extends Equatable {
  final String id;
  final String executiveProfileId;
  final String referenceName;
  final String referenceTitle;
  final String referenceCompany;
  final String referenceEmail;
  final String? referencePhone;
  final String relationshipType; // direct_report, peer, board_member, client
  final ReferenceVerificationStatus verificationStatus;
  final DateTime? verificationDate;
  final String? verificationNotes;
  final int? rating;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ExecutiveReference({
    required this.id,
    required this.executiveProfileId,
    required this.referenceName,
    required this.referenceTitle,
    required this.referenceCompany,
    required this.referenceEmail,
    this.referencePhone,
    required this.relationshipType,
    this.verificationStatus = ReferenceVerificationStatus.pending,
    this.verificationDate,
    this.verificationNotes,
    this.rating,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isVerified => verificationStatus == ReferenceVerificationStatus.verified;

  String get relationshipDisplayName => switch (relationshipType) {
        'direct_report' => 'Direct Report',
        'peer' => 'Peer',
        'board_member' => 'Board Member',
        'client' => 'Client',
        _ => relationshipType,
      };

  factory ExecutiveReference.fromJson(Map<String, dynamic> json) {
    return ExecutiveReference(
      id: json['id'] as String,
      executiveProfileId: json['executiveProfileId'] as String,
      referenceName: json['referenceName'] as String,
      referenceTitle: json['referenceTitle'] as String,
      referenceCompany: json['referenceCompany'] as String,
      referenceEmail: json['referenceEmail'] as String,
      referencePhone: json['referencePhone'] as String?,
      relationshipType: json['relationshipType'] as String,
      verificationStatus: ReferenceVerificationStatus.fromApiValue(
          json['verificationStatus'] as String? ?? 'PENDING'),
      verificationDate: json['verificationDate'] != null
          ? DateTime.parse(json['verificationDate'] as String)
          : null,
      verificationNotes: json['verificationNotes'] as String?,
      rating: json['rating'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'referenceName': referenceName,
        'referenceTitle': referenceTitle,
        'referenceCompany': referenceCompany,
        'referenceEmail': referenceEmail,
        'referencePhone': referencePhone,
        'relationshipType': relationshipType,
      };

  @override
  List<Object?> get props => [id, executiveProfileId, referenceName, verificationStatus];
}

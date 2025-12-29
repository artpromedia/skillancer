import 'package:equatable/equatable.dart';

/// User role enum
enum UserRole {
  freelancer,
  client,
  admin;

  String get displayName => switch (this) {
        UserRole.freelancer => 'Freelancer',
        UserRole.client => 'Client',
        UserRole.admin => 'Admin',
      };
}

/// User model
class User extends Equatable {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final UserRole role;
  final String? title;
  final String? bio;
  final double? hourlyRate;
  final bool isVerified;
  final bool isAvailable;
  final DateTime? createdAt;

  const User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    required this.role,
    this.title,
    this.bio,
    this.hourlyRate,
    this.isVerified = false,
    this.isAvailable = true,
    this.createdAt,
  });

  String get fullName => '$firstName $lastName';

  String get initials {
    final first = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final last = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$first$last';
  }

  User copyWith({
    String? id,
    String? email,
    String? firstName,
    String? lastName,
    String? avatarUrl,
    UserRole? role,
    String? title,
    String? bio,
    double? hourlyRate,
    bool? isVerified,
    bool? isAvailable,
    DateTime? createdAt,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      role: role ?? this.role,
      title: title ?? this.title,
      bio: bio ?? this.bio,
      hourlyRate: hourlyRate ?? this.hourlyRate,
      isVerified: isVerified ?? this.isVerified,
      isAvailable: isAvailable ?? this.isAvailable,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      role: UserRole.values.firstWhere(
        (r) => r.name == json['role'],
        orElse: () => UserRole.freelancer,
      ),
      title: json['title'] as String?,
      bio: json['bio'] as String?,
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble(),
      isVerified: json['isVerified'] as bool? ?? false,
      isAvailable: json['isAvailable'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'avatarUrl': avatarUrl,
      'role': role.name,
      'title': title,
      'bio': bio,
      'hourlyRate': hourlyRate,
      'isVerified': isVerified,
      'isAvailable': isAvailable,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  @override
  List<Object?> get props => [
        id,
        email,
        firstName,
        lastName,
        avatarUrl,
        role,
        title,
        bio,
        hourlyRate,
        isVerified,
        isAvailable,
        createdAt,
      ];
}

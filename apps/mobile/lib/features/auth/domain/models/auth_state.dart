import 'package:equatable/equatable.dart';

import 'user.dart';

/// Authentication state
sealed class AuthState extends Equatable {
  const AuthState();

  bool get isAuthenticated => this is AuthStateAuthenticated;
  bool get isLoading => this is AuthStateLoading;

  User? get user => switch (this) {
        AuthStateAuthenticated(user: final user) => user,
        _ => null,
      };

  String? get token => switch (this) {
        AuthStateAuthenticated(token: final token) => token,
        _ => null,
      };

  const factory AuthState.initial() = AuthStateInitial;
  const factory AuthState.loading() = AuthStateLoading;
  const factory AuthState.authenticated({
    required User user,
    required String token,
  }) = AuthStateAuthenticated;
  const factory AuthState.error(String message) = AuthStateError;

  @override
  List<Object?> get props => [];
}

class AuthStateInitial extends AuthState {
  const AuthStateInitial();
}

class AuthStateLoading extends AuthState {
  const AuthStateLoading();
}

class AuthStateAuthenticated extends AuthState {
  @override
  final User user;
  @override
  final String token;

  const AuthStateAuthenticated({
    required this.user,
    required this.token,
  });

  @override
  List<Object?> get props => [user, token];
}

class AuthStateError extends AuthState {
  final String message;

  const AuthStateError(this.message);

  @override
  List<Object?> get props => [message];
}

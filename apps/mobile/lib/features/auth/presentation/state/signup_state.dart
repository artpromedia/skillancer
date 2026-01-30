import 'package:equatable/equatable.dart';

/// Signup state for managing the signup flow
sealed class SignupState extends Equatable {
  const SignupState();

  /// Initial state before any action
  const factory SignupState.initial() = SignupStateInitial;

  /// Loading state while signup is in progress
  const factory SignupState.loading() = SignupStateLoading;

  /// Success state after successful signup
  const factory SignupState.success({
    required String email,
    required String message,
    required bool requiresEmailVerification,
  }) = SignupStateSuccess;

  /// Error state when signup fails
  const factory SignupState.error(String message) = SignupStateError;

  @override
  List<Object?> get props => [];
}

class SignupStateInitial extends SignupState {
  const SignupStateInitial();
}

class SignupStateLoading extends SignupState {
  const SignupStateLoading();
}

class SignupStateSuccess extends SignupState {
  final String email;
  final String message;
  final bool requiresEmailVerification;

  const SignupStateSuccess({
    required this.email,
    required this.message,
    required this.requiresEmailVerification,
  });

  @override
  List<Object?> get props => [email, message, requiresEmailVerification];
}

class SignupStateError extends SignupState {
  final String message;

  const SignupStateError(this.message);

  @override
  List<Object?> get props => [message];
}

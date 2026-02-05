import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/navigation/app_router.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Forgot password screen for requesting a password reset email
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  bool _isLoading = false;
  bool _isSuccess = false;
  String? _errorMessage;

  /// Number of reset requests sent in this session
  int _attemptCount = 0;

  /// Cooldown duration between resend attempts
  static const _cooldownDuration = Duration(seconds: 60);

  /// Maximum allowed attempts before showing rate limit message
  static const _maxAttempts = 3;

  /// Remaining cooldown seconds displayed in the UI
  int _cooldownSeconds = 0;
  Timer? _cooldownTimer;

  @override
  void dispose() {
    _emailController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  /// Returns true if a cooldown is currently active
  bool get _isCooldownActive => _cooldownSeconds > 0;

  /// Returns true if the user has exceeded the maximum number of attempts
  bool get _isRateLimited => _attemptCount >= _maxAttempts;

  /// Start the cooldown countdown timer
  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _cooldownSeconds = _cooldownDuration.inSeconds);

    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _cooldownSeconds--;
        if (_cooldownSeconds <= 0) {
          timer.cancel();
        }
      });
    });
  }

  Future<void> _handleRequestReset() async {
    if (!_formKey.currentState!.validate()) return;

    if (_isRateLimited) {
      setState(() {
        _errorMessage =
            'Too many attempts. Please wait a few minutes before trying again.';
      });
      return;
    }

    if (_isCooldownActive) {
      setState(() {
        _errorMessage =
            'Please wait $_cooldownSeconds seconds before requesting another email.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authRepo = ref.read(authRepositoryProvider);
      final success =
          await authRepo.requestPasswordReset(_emailController.text.trim());

      if (!mounted) return;

      if (success) {
        setState(() {
          _isSuccess = true;
          _attemptCount++;
        });
        _startCooldown();
      } else {
        setState(() {
          _errorMessage =
              'Unable to send reset email. Please check your email address and try again.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Something went wrong. Please try again later.';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleResendEmail() async {
    if (_isCooldownActive || _isRateLimited) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authRepo = ref.read(authRepositoryProvider);
      final success =
          await authRepo.requestPasswordReset(_emailController.text.trim());

      if (!mounted) return;

      if (success) {
        setState(() {
          _attemptCount++;
        });
        _startCooldown();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Reset email sent again.'),
              backgroundColor: AppTheme.successColor,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
            ),
          );
        }
      } else {
        setState(() {
          _errorMessage = 'Unable to resend the email. Please try again later.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Something went wrong. Please try again later.';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.spacingLg),
          child: _isSuccess ? _buildSuccessView() : _buildFormView(),
        ),
      ),
    );
  }

  Widget _buildFormView() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppTheme.spacing2xl),

          // Logo and title
          Center(
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.lock_reset_outlined,
                    size: 40,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: AppTheme.spacingMd),
                Text(
                  'Forgot Password',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: AppTheme.spacingSm),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppTheme.spacingLg,
                  ),
                  child: Text(
                    'Enter your email address and we\'ll send you a link to reset your password.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: AppTheme.neutral500,
                        ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacing2xl),

          // Error message
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              decoration: BoxDecoration(
                color: AppTheme.errorColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: AppTheme.errorColor),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: AppTheme.errorColor,
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppTheme.errorColor),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMd),
          ],

          // Rate limit warning
          if (_isRateLimited) ...[
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              decoration: BoxDecoration(
                color: AppTheme.warningColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: AppTheme.warningColor),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.timer_outlined,
                    color: AppTheme.warningColor,
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Expanded(
                    child: Text(
                      'Too many attempts. Please wait a few minutes before trying again.',
                      style: TextStyle(color: AppTheme.warningColor),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMd),
          ],

          // Email field
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleRequestReset(),
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'Enter your email',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your email';
              }
              if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$')
                  .hasMatch(value)) {
                return 'Please enter a valid email';
              }
              return null;
            },
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // Submit button
          ElevatedButton(
            onPressed:
                _isLoading || _isRateLimited ? null : _handleRequestReset,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text('Send Reset Link'),
          ),

          const SizedBox(height: AppTheme.spacing2xl),

          // Back to login link
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Remember your password?',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              TextButton(
                onPressed: () => context.go(AppRoutes.login),
                child: const Text('Log in'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppTheme.spacing2xl),

        // Success icon and message
        Center(
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppTheme.successColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  Icons.mark_email_read_outlined,
                  size: 40,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: AppTheme.spacingMd),
              Text(
                'Check Your Email',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: AppTheme.spacingSm),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingLg,
                ),
                child: Text(
                  'We\'ve sent a password reset link to:',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppTheme.neutral500,
                      ),
                ),
              ),
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                _emailController.text.trim(),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Instructions
        Container(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          decoration: BoxDecoration(
            color: AppTheme.successColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(color: AppTheme.successColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: AppTheme.successColor,
                    size: 20,
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    'What to do next',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppTheme.successColor,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingSm),
              Padding(
                padding: const EdgeInsets.only(left: 28),
                child: Text(
                  '1. Check your inbox (and spam folder)\n'
                  '2. Click the reset link in the email\n'
                  '3. Create a new password',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.neutral600,
                        height: 1.6,
                      ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Error message (for resend failures)
        if (_errorMessage != null) ...[
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: AppTheme.errorColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.errorColor),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  color: AppTheme.errorColor,
                ),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: AppTheme.errorColor),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),
        ],

        // Rate limit warning (on success view)
        if (_isRateLimited) ...[
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: AppTheme.warningColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.warningColor),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.timer_outlined,
                  color: AppTheme.warningColor,
                ),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(
                    'Maximum resend attempts reached. Please wait a few minutes or check your inbox.',
                    style: TextStyle(color: AppTheme.warningColor),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),
        ],

        // Resend email button
        OutlinedButton(
          onPressed: _isLoading || _isCooldownActive || _isRateLimited
              ? null
              : _handleResendEmail,
          child: _isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                  ),
                )
              : Text(
                  _isCooldownActive
                      ? 'Resend email in ${_cooldownSeconds}s'
                      : 'Resend Email',
                ),
        ),

        const SizedBox(height: AppTheme.spacingMd),

        // Back to login button
        ElevatedButton(
          onPressed: () => context.go(AppRoutes.login),
          child: const Text('Back to Log In'),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Try different email
        Center(
          child: TextButton(
            onPressed: () {
              setState(() {
                _isSuccess = false;
                _errorMessage = null;
              });
            },
            child: const Text('Try a different email'),
          ),
        ),
      ],
    );
  }
}

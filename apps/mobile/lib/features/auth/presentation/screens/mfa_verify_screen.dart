import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';

/// MFA verification screen shown when a user logs in and MFA is required.
///
/// Supports:
/// - 6-digit TOTP code entry with individual digit boxes and auto-advance
/// - Automatic submission when all 6 digits are entered
/// - Backup / recovery code fallback
/// - Shake animation on invalid code
/// - Loading and error states
class MfaVerifyScreen extends ConsumerStatefulWidget {
  /// Temporary session token issued by the login endpoint when MFA is required.
  final String? sessionToken;

  const MfaVerifyScreen({super.key, this.sessionToken});

  @override
  ConsumerState<MfaVerifyScreen> createState() => _MfaVerifyScreenState();
}

class _MfaVerifyScreenState extends ConsumerState<MfaVerifyScreen>
    with SingleTickerProviderStateMixin {
  // Six individual controllers / focus nodes for each digit box
  final List<TextEditingController> _digitControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _digitFocusNodes = List.generate(6, (_) => FocusNode());

  // Backup code input
  final _backupCodeController = TextEditingController();
  final _backupCodeFocusNode = FocusNode();

  bool _isVerifying = false;
  bool _useBackupCode = false;
  String? _errorMessage;

  // Shake animation
  late final AnimationController _shakeController;
  late final Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();

    // Shake animation: quick left-right oscillation
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _shakeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _shakeController, curve: Curves.elasticIn),
    );

    // Auto-focus the first digit box after the frame renders
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _digitFocusNodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    for (final c in _digitControllers) {
      c.dispose();
    }
    for (final f in _digitFocusNodes) {
      f.dispose();
    }
    _backupCodeController.dispose();
    _backupCodeFocusNode.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Digit box helpers
  // ---------------------------------------------------------------------------

  /// Assembles the 6-digit code from the individual controllers.
  String get _assembledCode =>
      _digitControllers.map((c) => c.text).join();

  /// Handles value changes in a single digit box.
  void _onDigitChanged(int index, String value) {
    // If the user pastes a full code into the first field, distribute it
    if (value.length > 1 && index == 0) {
      _pasteFullCode(value);
      return;
    }

    // Accept only a single digit; ignore otherwise
    if (value.length > 1) {
      _digitControllers[index].text = value[value.length - 1];
    }

    // Advance focus to the next box
    if (value.isNotEmpty && index < 5) {
      _digitFocusNodes[index + 1].requestFocus();
    }

    // Auto-submit when all 6 digits are filled
    if (_assembledCode.length == 6) {
      _verifyTotpCode();
    }
  }

  /// Handles keyboard backspace on an empty digit box to move focus back.
  void _onDigitKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _digitControllers[index].text.isEmpty &&
        index > 0) {
      _digitControllers[index - 1].clear();
      _digitFocusNodes[index - 1].requestFocus();
    }
  }

  /// Distributes a pasted string across the 6 digit boxes.
  void _pasteFullCode(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    for (var i = 0; i < 6; i++) {
      _digitControllers[i].text = i < digits.length ? digits[i] : '';
    }
    if (digits.length >= 6) {
      _digitFocusNodes[5].requestFocus();
      _verifyTotpCode();
    } else if (digits.isNotEmpty) {
      final nextEmpty = digits.length.clamp(0, 5);
      _digitFocusNodes[nextEmpty].requestFocus();
    }
  }

  /// Clears all digit boxes and focuses the first one.
  void _clearDigits() {
    for (final c in _digitControllers) {
      c.clear();
    }
    if (mounted) {
      _digitFocusNodes[0].requestFocus();
    }
  }

  // ---------------------------------------------------------------------------
  // Verification
  // ---------------------------------------------------------------------------

  Future<void> _verifyTotpCode() async {
    final code = _assembledCode;
    if (code.length != 6) return;

    // Unfocus to dismiss keyboard
    FocusScope.of(context).unfocus();

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post('/mfa/verify/totp', data: {
        'code': code,
        'sessionToken': widget.sessionToken,
      });

      if (!mounted) return;

      // Extract tokens from response and authenticate
      final data = response.data as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String?;
      final refreshToken = data['refreshToken'] as String?;

      if (accessToken != null) {
        final secureStorage = ref.read(secureStorageProvider);
        await secureStorage.saveToken(accessToken);
        if (refreshToken != null) {
          await secureStorage.saveRefreshToken(refreshToken);
        }
        // Trigger auth state refresh which will redirect via GoRouter
        await ref.read(authStateProvider.notifier).checkAuthStatus();
      }
    } catch (e) {
      if (!mounted) return;

      String message = 'Verification failed. Please try again.';
      if (e is DioException) {
        final apiError = e.error;
        if (apiError is ApiError) {
          message = apiError.message;
        }
      }

      setState(() {
        _errorMessage = message;
        _isVerifying = false;
      });

      _triggerShake();
      _clearDigits();
    }
  }

  Future<void> _verifyBackupCode() async {
    final code = _backupCodeController.text.trim();
    if (code.isEmpty) {
      setState(() => _errorMessage = 'Please enter a backup code');
      return;
    }

    FocusScope.of(context).unfocus();

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post('/mfa/verify/totp', data: {
        'code': code,
        'sessionToken': widget.sessionToken,
      });

      if (!mounted) return;

      final data = response.data as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String?;
      final refreshToken = data['refreshToken'] as String?;

      if (accessToken != null) {
        final secureStorage = ref.read(secureStorageProvider);
        await secureStorage.saveToken(accessToken);
        if (refreshToken != null) {
          await secureStorage.saveRefreshToken(refreshToken);
        }
        await ref.read(authStateProvider.notifier).checkAuthStatus();
      }
    } catch (e) {
      if (!mounted) return;

      String message = 'Invalid backup code. Please try again.';
      if (e is DioException) {
        final apiError = e.error;
        if (apiError is ApiError) {
          message = apiError.message;
        }
      }

      setState(() {
        _errorMessage = message;
        _isVerifying = false;
      });

      _triggerShake();
      _backupCodeController.clear();
      _backupCodeFocusNode.requestFocus();
    }
  }

  // ---------------------------------------------------------------------------
  // Shake animation
  // ---------------------------------------------------------------------------

  void _triggerShake() {
    _shakeController.reset();
    _shakeController.forward();
    HapticFeedback.mediumImpact();
  }

  double _shakeOffset(double animationValue) {
    // Produces a quick oscillating offset that decays
    return math.sin(animationValue * math.pi * 4) * 10 * (1 - animationValue);
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Two-Factor Authentication'),
      ),
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _shakeAnimation,
          builder: (context, child) {
            return Transform.translate(
              offset: Offset(
                _shakeOffset(_shakeAnimation.value),
                0,
              ),
              child: child,
            );
          },
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            child: _useBackupCode
                ? _buildBackupCodeInput()
                : _buildTotpInput(),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TOTP code entry
  // ---------------------------------------------------------------------------

  Widget _buildTotpInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppTheme.spacingXl),

        // Lock icon
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_outline,
              size: 36,
              color: AppTheme.primaryColor,
            ),
          ),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Title
        Text(
          'Enter Verification Code',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: AppTheme.spacingSm),

        // Subtitle
        Text(
          'Enter the 6-digit code from your authenticator app',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.neutral500,
              ),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: AppTheme.spacingXl),

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
                  size: 20,
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
          const SizedBox(height: AppTheme.spacingLg),
        ],

        // 6 digit boxes
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (index) {
            return Padding(
              padding: EdgeInsets.only(
                left: index == 0 ? 0 : AppTheme.spacingSm,
                // Add extra gap in the middle (after 3rd digit) for readability
                right: index == 2 ? AppTheme.spacingSm : 0,
              ),
              child: SizedBox(
                width: 48,
                height: 56,
                child: KeyboardListener(
                  focusNode: FocusNode(), // separate listener node
                  onKeyEvent: (event) => _onDigitKeyEvent(index, event),
                  child: TextFormField(
                    controller: _digitControllers[index],
                    focusNode: _digitFocusNodes[index],
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 1,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                    decoration: InputDecoration(
                      counterText: '',
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: AppTheme.spacingMd,
                      ),
                      filled: true,
                      fillColor: _digitControllers[index].text.isNotEmpty
                          ? AppTheme.primaryColor.withOpacity(0.05)
                          : AppTheme.neutral100,
                      enabledBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusMd),
                        borderSide: BorderSide(
                          color: _digitControllers[index].text.isNotEmpty
                              ? AppTheme.primaryColor
                              : AppTheme.neutral200,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusMd),
                        borderSide: const BorderSide(
                          color: AppTheme.primaryColor,
                          width: 2,
                        ),
                      ),
                    ),
                    onChanged: (value) => _onDigitChanged(index, value),
                  ),
                ),
              ),
            );
          }),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Verify button
        ElevatedButton(
          onPressed: _isVerifying ? null : _verifyTotpCode,
          child: _isVerifying
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : const Text('Verify'),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Divider
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Text(
                'or',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),

        const SizedBox(height: AppTheme.spacingMd),

        // Use backup code link
        Center(
          child: TextButton.icon(
            onPressed: () {
              setState(() {
                _useBackupCode = true;
                _errorMessage = null;
              });
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  _backupCodeFocusNode.requestFocus();
                }
              });
            },
            icon: const Icon(Icons.vpn_key_outlined, size: 18),
            label: const Text('Use a backup code'),
          ),
        ),

        const SizedBox(height: AppTheme.spacingSm),

        // Help link
        Center(
          child: TextButton(
            onPressed: _showHelpDialog,
            child: Text(
              'Lost your authenticator?',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.neutral500,
                    decoration: TextDecoration.underline,
                  ),
            ),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Backup code entry
  // ---------------------------------------------------------------------------

  Widget _buildBackupCodeInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppTheme.spacingXl),

        // Icon
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.vpn_key_outlined,
              size: 36,
              color: AppTheme.primaryColor,
            ),
          ),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Title
        Text(
          'Enter Backup Code',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: AppTheme.spacingSm),

        Text(
          'Enter one of the backup codes you saved when setting up '
          'two-factor authentication.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.neutral500,
              ),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: AppTheme.spacingXl),

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
                  size: 20,
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

        // Backup code field
        TextFormField(
          controller: _backupCodeController,
          focusNode: _backupCodeFocusNode,
          textAlign: TextAlign.center,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _verifyBackupCode(),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'monospace',
                letterSpacing: 2,
              ),
          decoration: const InputDecoration(
            hintText: 'XXXX-XXXX-XXXX',
          ),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Verify button
        ElevatedButton(
          onPressed: _isVerifying ? null : _verifyBackupCode,
          child: _isVerifying
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : const Text('Verify Backup Code'),
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Switch back to TOTP
        Center(
          child: TextButton.icon(
            onPressed: () {
              setState(() {
                _useBackupCode = false;
                _errorMessage = null;
              });
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  _clearDigits();
                }
              });
            },
            icon: const Icon(Icons.dialpad, size: 18),
            label: const Text('Use authenticator code instead'),
          ),
        ),

        const SizedBox(height: AppTheme.spacingSm),

        // Help link
        Center(
          child: TextButton(
            onPressed: _showHelpDialog,
            child: Text(
              'Lost your authenticator?',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.neutral500,
                    decoration: TextDecoration.underline,
                  ),
            ),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Help dialog
  // ---------------------------------------------------------------------------

  void _showHelpDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Need Help?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'If you have lost access to your authenticator app, you can:',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            _buildHelpItem(
              icon: Icons.vpn_key_outlined,
              text: 'Use a backup code you saved during MFA setup',
            ),
            const SizedBox(height: AppTheme.spacingSm),
            _buildHelpItem(
              icon: Icons.email_outlined,
              text: 'Contact support at support@skillancer.com for account recovery',
            ),
            const SizedBox(height: AppTheme.spacingSm),
            _buildHelpItem(
              icon: Icons.refresh,
              text: 'If you have another device with the same authenticator, use that device',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got It'),
          ),
        ],
      ),
    );
  }

  Widget _buildHelpItem({required IconData icon, required String text}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AppTheme.primaryColor),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}

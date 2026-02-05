import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/navigation/app_router.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';

/// MFA setup screen for enrolling TOTP-based two-factor authentication.
///
/// Guides the user through:
/// 1. Scanning a QR code or manually entering a secret key
/// 2. Verifying setup with a 6-digit code from their authenticator app
/// 3. Saving backup recovery codes
class MfaSetupScreen extends ConsumerStatefulWidget {
  const MfaSetupScreen({super.key});

  @override
  ConsumerState<MfaSetupScreen> createState() => _MfaSetupScreenState();
}

class _MfaSetupScreenState extends ConsumerState<MfaSetupScreen> {
  final _codeController = TextEditingController();
  final _codeFocusNode = FocusNode();

  bool _isLoadingSetup = true;
  bool _isVerifying = false;
  String? _errorMessage;

  // Data returned from POST /mfa/setup/totp
  String? _secret;
  String? _qrCodeUrl;
  List<String> _backupCodes = [];

  // Tracks which phase of the flow the user is in
  _MfaSetupPhase _phase = _MfaSetupPhase.loading;

  @override
  void initState() {
    super.initState();
    _initiateMfaSetup();
  }

  @override
  void dispose() {
    _codeController.dispose();
    _codeFocusNode.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // API interactions
  // ---------------------------------------------------------------------------

  /// Calls POST /mfa/setup/totp to generate a new TOTP secret and QR code.
  Future<void> _initiateMfaSetup() async {
    setState(() {
      _isLoadingSetup = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post('/mfa/setup/totp');
      final data = response.data as Map<String, dynamic>;

      setState(() {
        _secret = data['secret'] as String?;
        _qrCodeUrl = data['qrCodeUrl'] as String?;
        _backupCodes = (data['backupCodes'] as List<dynamic>?)
                ?.map((code) => code.toString())
                .toList() ??
            [];
        _phase = _MfaSetupPhase.scanAndVerify;
        _isLoadingSetup = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to initialise MFA setup. Please try again.';
        _phase = _MfaSetupPhase.error;
        _isLoadingSetup = false;
      });
    }
  }

  /// Calls POST /mfa/verify/totp with the 6-digit code to confirm setup.
  Future<void> _verifyCode() async {
    final code = _codeController.text.trim();

    if (code.length != 6) {
      setState(() => _errorMessage = 'Please enter a 6-digit code');
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.post('/mfa/verify/totp', data: {
        'code': code,
      });

      setState(() {
        _phase = _MfaSetupPhase.backupCodes;
        _isVerifying = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Invalid code. Please check and try again.';
        _isVerifying = false;
      });
      _codeController.clear();
      _codeFocusNode.requestFocus();
    }
  }

  /// Copies the secret key to the clipboard.
  void _copySecret() {
    if (_secret == null) return;
    Clipboard.setData(ClipboardData(text: _secret!));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Secret key copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  /// Copies all backup codes to the clipboard.
  void _copyAllBackupCodes() {
    if (_backupCodes.isEmpty) return;
    Clipboard.setData(ClipboardData(text: _backupCodes.join('\n')));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Backup codes copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  /// Confirms the user has saved their backup codes and exits the flow.
  void _confirmSavedCodes() {
    context.pop(true); // return true to indicate successful setup
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Set Up Two-Factor Auth'),
      ),
      body: SafeArea(
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _MfaSetupPhase.loading:
        return _buildLoadingState();
      case _MfaSetupPhase.error:
        return _buildErrorState();
      case _MfaSetupPhase.scanAndVerify:
        return _buildScanAndVerifyPhase();
      case _MfaSetupPhase.backupCodes:
        return _buildBackupCodesPhase();
    }
  }

  // ---------------------------------------------------------------------------
  // Phase: Loading
  // ---------------------------------------------------------------------------

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: AppTheme.spacingMd),
          Text('Preparing MFA setup...'),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Phase: Error (initial setup failure)
  // ---------------------------------------------------------------------------

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: AppTheme.errorColor,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              _errorMessage ?? 'Something went wrong',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppTheme.spacingLg),
            ElevatedButton(
              onPressed: _initiateMfaSetup,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Phase: Scan QR / enter key + verify
  // ---------------------------------------------------------------------------

  Widget _buildScanAndVerifyPhase() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacingLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Step indicator
          _buildStepIndicator(currentStep: 1),

          const SizedBox(height: AppTheme.spacingLg),

          // Instructions
          Text(
            'Scan QR Code',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'Open your authenticator app (e.g. Google Authenticator, Authy) '
            'and scan the QR code below. If you cannot scan, enter the key manually.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.neutral500,
                ),
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // QR code area
          Center(
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                border: Border.all(color: AppTheme.neutral200),
              ),
              child: _qrCodeUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                      child: Image.network(
                        _qrCodeUrl!,
                        fit: BoxFit.contain,
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return const Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          );
                        },
                        errorBuilder: (context, error, stackTrace) {
                          return const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.broken_image_outlined,
                                    size: 48, color: AppTheme.neutral400),
                                SizedBox(height: AppTheme.spacingSm),
                                Text(
                                  'Could not load QR code.\nUse the key below.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.neutral500,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    )
                  : const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.qr_code_2,
                              size: 64, color: AppTheme.neutral300),
                          SizedBox(height: AppTheme.spacingSm),
                          Text(
                            'QR code unavailable.\nUse the key below.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.neutral500,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // Manual key display
          Text(
            'Or enter this key manually:',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
              vertical: AppTheme.spacingSm,
            ),
            decoration: BoxDecoration(
              color: AppTheme.neutral100,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.neutral200),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    _secret ?? '',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2,
                        ),
                  ),
                ),
                IconButton(
                  onPressed: _copySecret,
                  icon: const Icon(Icons.copy, size: 20),
                  tooltip: 'Copy key',
                  color: AppTheme.primaryColor,
                ),
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacing2xl),

          // Verification input
          Text(
            'Verify Setup',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'Enter the 6-digit code from your authenticator app to confirm setup.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.neutral500,
                ),
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // Error message
          if (_errorMessage != null && _phase == _MfaSetupPhase.scanAndVerify)
            ...[
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

          // 6-digit code field
          TextFormField(
            controller: _codeController,
            focusNode: _codeFocusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  letterSpacing: 12,
                  fontWeight: FontWeight.w600,
                ),
            decoration: const InputDecoration(
              hintText: '000000',
              counterText: '',
            ),
            onChanged: (value) {
              if (value.length == 6) {
                _verifyCode();
              }
            },
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // Verify button
          ElevatedButton(
            onPressed: _isVerifying ? null : _verifyCode,
            child: _isVerifying
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text('Verify & Activate'),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Phase: Backup codes
  // ---------------------------------------------------------------------------

  Widget _buildBackupCodesPhase() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacingLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Step indicator
          _buildStepIndicator(currentStep: 2),

          const SizedBox(height: AppTheme.spacingLg),

          // Success banner
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: AppTheme.successColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: AppTheme.successColor),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle, color: AppTheme.successColor),
                SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(
                    'Two-factor authentication is now enabled!',
                    style: TextStyle(
                      color: AppTheme.successColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // Backup codes heading
          Text(
            'Save Your Backup Codes',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'If you lose access to your authenticator app, you can use one of '
            'these backup codes to sign in. Each code can only be used once.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.neutral500,
                ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // Warning callout
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: AppTheme.warningColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(
                color: AppTheme.warningColor.withOpacity(0.4),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppTheme.warningColor,
                  size: 20,
                ),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(
                    'Store these codes in a safe place. You will not be able '
                    'to see them again.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.warningColor,
                        ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacingLg),

          // Backup codes grid
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: AppTheme.neutral100,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.neutral200),
            ),
            child: Wrap(
              spacing: AppTheme.spacingSm,
              runSpacing: AppTheme.spacingSm,
              children: _backupCodes.map((code) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppTheme.spacingMd,
                    vertical: AppTheme.spacingSm,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: AppTheme.neutral200),
                  ),
                  child: Text(
                    code,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // Copy all codes button
          OutlinedButton.icon(
            onPressed: _copyAllBackupCodes,
            icon: const Icon(Icons.copy, size: 18),
            label: const Text('Copy All Codes'),
          ),

          const SizedBox(height: AppTheme.spacing2xl),

          // Confirmation button
          ElevatedButton(
            onPressed: _confirmSavedCodes,
            child: const Text("I've Saved My Codes"),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Shared widgets
  // ---------------------------------------------------------------------------

  /// Renders a simple two-step progress indicator.
  Widget _buildStepIndicator({required int currentStep}) {
    return Row(
      children: [
        _buildStepDot(
          stepNumber: 1,
          label: 'Set Up',
          isActive: currentStep == 1,
          isCompleted: currentStep > 1,
        ),
        Expanded(
          child: Container(
            height: 2,
            color: currentStep > 1 ? AppTheme.primaryColor : AppTheme.neutral200,
          ),
        ),
        _buildStepDot(
          stepNumber: 2,
          label: 'Backup',
          isActive: currentStep == 2,
          isCompleted: false,
        ),
      ],
    );
  }

  Widget _buildStepDot({
    required int stepNumber,
    required String label,
    required bool isActive,
    required bool isCompleted,
  }) {
    final Color circleColor;
    final Widget circleChild;

    if (isCompleted) {
      circleColor = AppTheme.primaryColor;
      circleChild = const Icon(Icons.check, size: 16, color: Colors.white);
    } else if (isActive) {
      circleColor = AppTheme.primaryColor;
      circleChild = Text(
        '$stepNumber',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      );
    } else {
      circleColor = AppTheme.neutral300;
      circleChild = Text(
        '$stepNumber',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      );
    }

    return Column(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: circleColor,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: circleChild,
        ),
        const SizedBox(height: AppTheme.spacingXs),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isActive || isCompleted ? FontWeight.w600 : FontWeight.w400,
            color: isActive || isCompleted
                ? AppTheme.primaryColor
                : AppTheme.neutral400,
          ),
        ),
      ],
    );
  }
}

/// Tracks which phase of the MFA setup flow is currently displayed.
enum _MfaSetupPhase {
  loading,
  error,
  scanAndVerify,
  backupCodes,
}

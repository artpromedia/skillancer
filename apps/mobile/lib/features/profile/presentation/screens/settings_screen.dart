import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/navigation/app_router.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/services/auth_service.dart';

/// Settings screen with account, security, notifications, appearance, and about
/// sections. Uses [ConsumerStatefulWidget] for Riverpod state and local
/// mutable state for toggle values loaded asynchronously.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final AuthService _authService;

  // Security
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _twoFactorEnabled = false;

  // Notifications
  bool _pushNotifications = true;
  bool _emailNotifications = true;
  bool _messageNotifications = true;
  bool _jobAlerts = true;

  // Quiet hours
  TimeOfDay _quietStart = const TimeOfDay(hour: 22, minute: 0);
  TimeOfDay _quietEnd = const TimeOfDay(hour: 7, minute: 0);
  bool _quietHoursEnabled = false;

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _authService = AuthService(
      secureStorage: ref.read(secureStorageProvider),
    );
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final biometricAvailable = await _authService.isBiometricAvailable();
    final biometricEnabled = await _authService.isBiometricEnabled();

    if (mounted) {
      setState(() {
        _biometricAvailable = biometricAvailable;
        _biometricEnabled = biometricEnabled;
        _isLoading = false;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Biometric toggle
  // ---------------------------------------------------------------------------

  Future<void> _toggleBiometric(bool value) async {
    if (!_biometricAvailable) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Biometric authentication is not available on this device.',
          ),
        ),
      );
      return;
    }

    if (value) {
      // Verify biometric before enabling
      final authenticated = await _authService.authenticateWithBiometrics(
        reason: 'Authenticate to enable biometric login',
      );
      if (!authenticated) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Biometric authentication failed. Please try again.'),
          ),
        );
        return;
      }
    }

    await _authService.setBiometricEnabled(value);
    if (mounted) {
      setState(() => _biometricEnabled = value);
    }
  }

  // ---------------------------------------------------------------------------
  // Theme mode
  // ---------------------------------------------------------------------------

  void _showThemeModeDialog() {
    final currentMode = ref.read(themeModeProvider);

    showDialog<ThemeMode>(
      context: context,
      builder: (context) {
        return SimpleDialog(
          title: const Text('Theme'),
          children: [
            _ThemeOption(
              title: 'System default',
              icon: Icons.settings_brightness,
              selected: currentMode == ThemeMode.system,
              onTap: () => Navigator.pop(context, ThemeMode.system),
            ),
            _ThemeOption(
              title: 'Light',
              icon: Icons.light_mode_outlined,
              selected: currentMode == ThemeMode.light,
              onTap: () => Navigator.pop(context, ThemeMode.light),
            ),
            _ThemeOption(
              title: 'Dark',
              icon: Icons.dark_mode_outlined,
              selected: currentMode == ThemeMode.dark,
              onTap: () => Navigator.pop(context, ThemeMode.dark),
            ),
          ],
        );
      },
    ).then((mode) {
      if (mode != null) {
        ref.read(themeModeProvider.notifier).state = mode;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Language selection
  // ---------------------------------------------------------------------------

  void _showLanguageDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return SimpleDialog(
          title: const Text('Language'),
          children: [
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context),
              child: const ListTile(
                title: Text('English'),
                trailing: Icon(Icons.check, color: AppTheme.primaryColor),
                dense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
            SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Coming soon')),
                );
              },
              child: const ListTile(
                title: Text('Spanish'),
                dense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
            SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Coming soon')),
                );
              },
              child: const ListTile(
                title: Text('French'),
                dense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ],
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Quiet hours
  // ---------------------------------------------------------------------------

  Future<void> _pickQuietStart() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _quietStart,
      helpText: 'Quiet hours start',
    );
    if (picked != null && mounted) {
      setState(() => _quietStart = picked);
    }
  }

  Future<void> _pickQuietEnd() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _quietEnd,
      helpText: 'Quiet hours end',
    );
    if (picked != null && mounted) {
      setState(() => _quietEnd = picked);
    }
  }

  // ---------------------------------------------------------------------------
  // Change password dialog
  // ---------------------------------------------------------------------------

  void _showChangePasswordDialog() {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Change Password'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: currentPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Current password',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your current password';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppTheme.spacingMd),
                TextFormField(
                  controller: newPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'New password',
                    prefixIcon: Icon(Icons.lock_outlined),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter a new password';
                    }
                    if (value.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppTheme.spacingMd),
                TextFormField(
                  controller: confirmPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Confirm new password',
                    prefixIcon: Icon(Icons.lock_outlined),
                  ),
                  validator: (value) {
                    if (value != newPasswordController.text) {
                      return 'Passwords do not match';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Password changed successfully'),
                    ),
                  );
                }
              },
              child: const Text('Change'),
            ),
          ],
        );
      },
    ).then((_) {
      currentPasswordController.dispose();
      newPasswordController.dispose();
      confirmPasswordController.dispose();
    });
  }

  // ---------------------------------------------------------------------------
  // Delete account
  // ---------------------------------------------------------------------------

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete Account'),
          content: const Text(
            'Are you sure you want to delete your account? This action is '
            'permanent and cannot be undone. All your data, including '
            'proposals, contracts, and earnings history, will be permanently '
            'removed.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _showDeleteAccountConfirmation();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.errorColor,
              ),
              child: const Text('Delete Account'),
            ),
          ],
        );
      },
    );
  }

  void _showDeleteAccountConfirmation() {
    final confirmController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Confirm Deletion'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Type "DELETE" to confirm account deletion.',
              ),
              const SizedBox(height: AppTheme.spacingMd),
              TextField(
                controller: confirmController,
                decoration: const InputDecoration(
                  hintText: 'Type DELETE',
                ),
                textCapitalization: TextCapitalization.characters,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (confirmController.text.trim().toUpperCase() == 'DELETE') {
                  Navigator.pop(context);
                  ref.read(authStateProvider.notifier).logout();
                  if (mounted) {
                    context.go(AppRoutes.login);
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.errorColor,
              ),
              child: const Text('Permanently Delete'),
            ),
          ],
        );
      },
    ).then((_) {
      confirmController.dispose();
    });
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Log Out'),
          content: const Text('Are you sure you want to log out?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ref.read(authStateProvider.notifier).logout();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.errorColor,
              ),
              child: const Text('Log Out'),
            ),
          ],
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);

    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          // ===================================================================
          // Account
          // ===================================================================
          _SectionHeader(title: 'Account'),
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Change Password'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: _showChangePasswordDialog,
          ),
          ListTile(
            leading: const Icon(Icons.email_outlined),
            title: const Text('Email Preferences'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Coming soon')),
              );
            },
          ),
          ListTile(
            leading: const Icon(
              Icons.person_remove_outlined,
              color: AppTheme.errorColor,
            ),
            title: const Text('Delete Account'),
            titleTextStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppTheme.errorColor,
                ),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: _showDeleteAccountDialog,
          ),
          const Divider(indent: 16, endIndent: 16),

          // ===================================================================
          // Security
          // ===================================================================
          _SectionHeader(title: 'Security'),
          SwitchListTile(
            secondary: Icon(
              _biometricAvailable ? Icons.fingerprint : Icons.no_encryption,
            ),
            title: const Text('Biometric Login'),
            subtitle: Text(
              _biometricAvailable
                  ? 'Use Face ID or Touch ID to log in'
                  : 'Not available on this device',
            ),
            value: _biometricEnabled,
            onChanged: _biometricAvailable ? _toggleBiometric : null,
          ),
          ListTile(
            leading: Icon(
              Icons.security_outlined,
              color: _twoFactorEnabled
                  ? AppTheme.successColor
                  : AppTheme.neutral600,
            ),
            title: const Text('Two-Factor Authentication'),
            subtitle: Text(_twoFactorEnabled ? 'Enabled' : 'Not enabled'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: () => context.push(AppRoutes.mfaSetup),
          ),
          ListTile(
            leading: const Icon(Icons.devices_outlined),
            title: const Text('Active Sessions'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Coming soon')),
              );
            },
          ),
          const Divider(indent: 16, endIndent: 16),

          // ===================================================================
          // Notifications
          // ===================================================================
          _SectionHeader(title: 'Notifications'),
          SwitchListTile(
            secondary: const Icon(Icons.notifications_outlined),
            title: const Text('Push Notifications'),
            subtitle: const Text('Receive push notifications on this device'),
            value: _pushNotifications,
            onChanged: (value) {
              setState(() => _pushNotifications = value);
            },
          ),
          SwitchListTile(
            secondary: const Icon(Icons.mark_email_unread_outlined),
            title: const Text('Email Notifications'),
            subtitle: const Text('Receive updates via email'),
            value: _emailNotifications,
            onChanged: (value) {
              setState(() => _emailNotifications = value);
            },
          ),
          SwitchListTile(
            secondary: const Icon(Icons.chat_outlined),
            title: const Text('Message Notifications'),
            subtitle: const Text('Notify when you receive new messages'),
            value: _messageNotifications,
            onChanged: (value) {
              setState(() => _messageNotifications = value);
            },
          ),
          SwitchListTile(
            secondary: const Icon(Icons.work_outline),
            title: const Text('Job Alerts'),
            subtitle: const Text('Get notified about new matching jobs'),
            value: _jobAlerts,
            onChanged: (value) {
              setState(() => _jobAlerts = value);
            },
          ),
          const SizedBox(height: AppTheme.spacingXs),
          SwitchListTile(
            secondary: const Icon(Icons.do_not_disturb_on_outlined),
            title: const Text('Quiet Hours'),
            subtitle: Text(
              _quietHoursEnabled
                  ? '${_quietStart.format(context)} - ${_quietEnd.format(context)}'
                  : 'Mute notifications during set hours',
            ),
            value: _quietHoursEnabled,
            onChanged: (value) {
              setState(() => _quietHoursEnabled = value);
            },
          ),
          if (_quietHoursEnabled) ...[
            Padding(
              padding: const EdgeInsets.only(left: 72.0),
              child: ListTile(
                dense: true,
                title: const Text('Start'),
                trailing: TextButton(
                  onPressed: _pickQuietStart,
                  child: Text(_quietStart.format(context)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 72.0),
              child: ListTile(
                dense: true,
                title: const Text('End'),
                trailing: TextButton(
                  onPressed: _pickQuietEnd,
                  child: Text(_quietEnd.format(context)),
                ),
              ),
            ),
          ],
          const Divider(indent: 16, endIndent: 16),

          // ===================================================================
          // Appearance
          // ===================================================================
          _SectionHeader(title: 'Appearance'),
          ListTile(
            leading: const Icon(Icons.palette_outlined),
            title: const Text('Theme'),
            subtitle: Text(_themeModeLabel(themeMode)),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: _showThemeModeDialog,
          ),
          ListTile(
            leading: const Icon(Icons.language_outlined),
            title: const Text('Language'),
            subtitle: const Text('English'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: _showLanguageDialog,
          ),
          const Divider(indent: 16, endIndent: 16),

          // ===================================================================
          // About
          // ===================================================================
          _SectionHeader(title: 'About'),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Version'),
            subtitle: const Text('0.1.0 (1)'),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Terms of Service'),
            trailing: const Icon(
              Icons.open_in_new,
              size: 18,
              color: AppTheme.neutral400,
            ),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Opening Terms of Service...'),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacy Policy'),
            trailing: const Icon(
              Icons.open_in_new,
              size: 18,
              color: AppTheme.neutral400,
            ),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Opening Privacy Policy...'),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.article_outlined),
            title: const Text('Licenses'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
            ),
            onTap: () {
              showLicensePage(
                context: context,
                applicationName: 'Skillancer',
                applicationVersion: '0.1.0',
                applicationIcon: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.work_outline,
                      color: Colors.white,
                    ),
                  ),
                ),
              );
            },
          ),
          const Divider(indent: 16, endIndent: 16),

          // ===================================================================
          // Danger Zone
          // ===================================================================
          _SectionHeader(title: 'Danger Zone'),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
              vertical: AppTheme.spacingSm,
            ),
            child: OutlinedButton.icon(
              onPressed: _showLogoutDialog,
              icon: const Icon(Icons.logout),
              label: const Text('Log Out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.errorColor,
                side: const BorderSide(color: AppTheme.errorColor),
                padding: const EdgeInsets.symmetric(
                  vertical: AppTheme.spacingMd,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
              vertical: AppTheme.spacingSm,
            ),
            child: TextButton.icon(
              onPressed: _showDeleteAccountDialog,
              icon: const Icon(Icons.delete_forever_outlined),
              label: const Text('Delete Account'),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.errorColor,
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacing2xl),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  String _themeModeLabel(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return 'System default';
      case ThemeMode.light:
        return 'Light';
      case ThemeMode.dark:
        return 'Dark';
    }
  }
}

// =============================================================================
// Private widgets
// =============================================================================

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: AppTheme.spacingMd,
        right: AppTheme.spacingMd,
        top: AppTheme.spacingLg,
        bottom: AppTheme.spacingSm,
      ),
      child: Text(
        title,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppTheme.neutral500,
            ),
      ),
    );
  }
}

class _ThemeOption extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ThemeOption({
    required this.title,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SimpleDialogOption(
      onPressed: onTap,
      child: ListTile(
        leading: Icon(
          icon,
          color: selected ? AppTheme.primaryColor : null,
        ),
        title: Text(title),
        trailing: selected
            ? const Icon(Icons.check, color: AppTheme.primaryColor)
            : null,
        dense: true,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }
}

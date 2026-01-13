import 'dart:async';

import 'package:local_auth/local_auth.dart';

import '../../../../core/storage/secure_storage.dart';
import '../models/user.dart';

/// Auth service for managing authentication state
class AuthService {
  final SecureStorage _secureStorage;
  final LocalAuthentication _localAuth = LocalAuthentication();

  final StreamController<User?> _userController =
      StreamController<User?>.broadcast();

  User? _currentUser;
  Timer? _tokenRefreshTimer;

  AuthService({SecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? SecureStorage();

  /// Current user stream
  Stream<User?> get userStream => _userController.stream;

  /// Current user
  User? get currentUser => _currentUser;

  /// Check if user is authenticated
  bool get isAuthenticated => _currentUser != null;

  /// Initialize auth service - check for existing session
  Future<void> initialize() async {
    final token = await _secureStorage.getToken();
    if (token != null) {
      // TODO: Validate token and fetch user
      // For now, we'll just check if token exists
      await _loadUserFromToken(token);
    }
  }

  Future<void> _loadUserFromToken(String token) async {
    // TODO: Decode JWT or fetch user from API
    // This is a placeholder
  }

  /// Set the current user
  void setUser(User user) {
    _currentUser = user;
    _userController.add(user);
  }

  /// Clear current user
  void clearUser() {
    _currentUser = null;
    _userController.add(null);
  }

  /// Save auth token
  Future<void> saveToken(String token, {String? refreshToken}) async {
    await _secureStorage.saveToken(token);
    if (refreshToken != null) {
      await _secureStorage.saveRefreshToken(refreshToken);
    }
    _scheduleTokenRefresh();
  }

  /// Get auth token
  Future<String?> getToken() async {
    return _secureStorage.getToken();
  }

  /// Clear all auth data
  Future<void> clearAuth() async {
    _tokenRefreshTimer?.cancel();
    await _secureStorage.deleteToken();
    await _secureStorage.deleteRefreshToken();
    clearUser();
  }

  /// Schedule token refresh before expiry
  void _scheduleTokenRefresh() {
    _tokenRefreshTimer?.cancel();
    // Refresh token 5 minutes before expiry
    // Assuming 1 hour token validity
    _tokenRefreshTimer = Timer(
      const Duration(minutes: 55),
      _refreshTokenIfNeeded,
    );
  }

  Future<void> _refreshTokenIfNeeded() async {
    // TODO: Implement token refresh
  }

  // ===========================================================================
  // Biometric Authentication
  // ===========================================================================

  /// Check if biometric auth is available
  Future<bool> isBiometricAvailable() async {
    try {
      final isAvailable = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return isAvailable && isDeviceSupported;
    } catch (e) {
      return false;
    }
  }

  /// Get available biometrics
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  /// Authenticate with biometrics
  Future<bool> authenticateWithBiometrics({
    String reason = 'Authenticate to access Skillancer',
  }) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }

  /// Check if biometric login is enabled
  Future<bool> isBiometricEnabled() async {
    return _secureStorage.isBiometricEnabled();
  }

  /// Enable/disable biometric login
  Future<void> setBiometricEnabled(bool enabled) async {
    await _secureStorage.setBiometricEnabled(enabled);
  }

  /// Dispose resources
  void dispose() {
    _tokenRefreshTimer?.cancel();
    _userController.close();
  }
}

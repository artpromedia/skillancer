import 'dart:async';
import 'dart:convert';

import 'package:local_auth/local_auth.dart';

import '../../../../core/storage/secure_storage.dart';
import '../models/user.dart';

/// Callback type for refreshing tokens via the API layer.
///
/// Takes a refresh token string and returns a map with 'token' and
/// optionally 'refreshToken' keys, or null on failure.
typedef RefreshCallback = Future<Map<String, dynamic>?> Function(
    String refreshToken);

/// Auth service for managing authentication state
class AuthService {
  final SecureStorage _secureStorage;
  final LocalAuthentication _localAuth = LocalAuthentication();
  final RefreshCallback? _refreshCallback;

  final StreamController<User?> _userController =
      StreamController<User?>.broadcast();

  User? _currentUser;
  Timer? _tokenRefreshTimer;

  AuthService({
    SecureStorage? secureStorage,
    RefreshCallback? refreshCallback,
  })  : _secureStorage = secureStorage ?? SecureStorage(),
        _refreshCallback = refreshCallback;

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
      final valid = await hasValidToken();
      if (valid) {
        await _loadUserFromToken(token);
        _scheduleTokenRefresh(token);
      } else {
        // Token is expired, try to refresh
        await _refreshTokenIfNeeded();
      }
    }
  }

  /// Decode a JWT payload from the token string.
  ///
  /// Returns the decoded payload as a Map, or null if decoding fails.
  Map<String, dynamic>? _decodeJwtPayload(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;

      // JWT payload is base64url-encoded; normalize for standard base64
      String payload = parts[1];
      // Add padding if necessary
      switch (payload.length % 4) {
        case 0:
          break;
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
        default:
          return null;
      }

      final decoded = utf8.decode(base64Url.decode(payload));
      return jsonDecode(decoded) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// Load user information from a JWT token.
  ///
  /// Decodes the JWT payload to extract user details. Falls back to creating
  /// a minimal user from the user ID stored in secure storage.
  Future<void> _loadUserFromToken(String token) async {
    final payload = _decodeJwtPayload(token);

    if (payload != null &&
        payload.containsKey('sub') &&
        payload.containsKey('email')) {
      final roleStr = payload['role'] as String? ?? 'freelancer';
      final role = UserRole.values.firstWhere(
        (r) => r.name == roleStr,
        orElse: () => UserRole.freelancer,
      );

      final user = User(
        id: payload['sub'] as String,
        email: payload['email'] as String,
        firstName: payload['firstName'] as String? ?? '',
        lastName: payload['lastName'] as String? ?? '',
        role: role,
      );

      // Persist user ID for fallback scenarios
      await _secureStorage.saveUserId(user.id);
      setUser(user);
    } else {
      // Fallback: try to build a minimal user from stored user ID
      final userId = await _secureStorage.getUserId();
      if (userId != null) {
        final user = User(
          id: userId,
          email: '',
          firstName: '',
          lastName: '',
          role: UserRole.freelancer,
        );
        setUser(user);
      }
    }
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
    _scheduleTokenRefresh(token);
  }

  /// Get auth token
  Future<String?> getToken() async {
    return _secureStorage.getToken();
  }

  /// Check if the stored token exists and has not expired.
  Future<bool> hasValidToken() async {
    final token = await _secureStorage.getToken();
    if (token == null) return false;

    final payload = _decodeJwtPayload(token);
    if (payload == null) return false;

    final exp = payload['exp'];
    if (exp == null) return false;

    final expiryTime =
        DateTime.fromMillisecondsSinceEpoch((exp as int) * 1000);
    return DateTime.now().isBefore(expiryTime);
  }

  /// Clear all auth data
  Future<void> clearAuth() async {
    _tokenRefreshTimer?.cancel();
    await _secureStorage.deleteToken();
    await _secureStorage.deleteRefreshToken();
    clearUser();
  }

  /// Schedule token refresh before expiry.
  ///
  /// Uses the actual expiry time from the JWT when available. Schedules
  /// the refresh 5 minutes before the token expires. Falls back to
  /// 55 minutes if the expiry cannot be determined.
  void _scheduleTokenRefresh([String? token]) {
    _tokenRefreshTimer?.cancel();

    Duration refreshIn = const Duration(minutes: 55);

    if (token != null) {
      final payload = _decodeJwtPayload(token);
      if (payload != null && payload.containsKey('exp')) {
        final exp = payload['exp'] as int;
        final expiryTime =
            DateTime.fromMillisecondsSinceEpoch(exp * 1000);
        final timeUntilExpiry = expiryTime.difference(DateTime.now());
        // Refresh 5 minutes before expiry, but at least 30 seconds from now
        final buffer = const Duration(minutes: 5);
        if (timeUntilExpiry > buffer) {
          refreshIn = timeUntilExpiry - buffer;
        } else if (timeUntilExpiry > Duration.zero) {
          refreshIn = const Duration(seconds: 30);
        } else {
          // Token already expired, refresh immediately
          _refreshTokenIfNeeded();
          return;
        }
      }
    }

    _tokenRefreshTimer = Timer(refreshIn, _refreshTokenIfNeeded);
  }

  /// Attempt to refresh the auth token using the stored refresh token.
  ///
  /// On success, saves the new tokens, reloads the user, and schedules
  /// the next refresh. On failure, clears all auth data.
  Future<void> _refreshTokenIfNeeded() async {
    if (_refreshCallback == null) return;

    final refreshToken = await _secureStorage.getRefreshToken();
    if (refreshToken == null) {
      await clearAuth();
      return;
    }

    try {
      final result = await _refreshCallback!(refreshToken);
      if (result != null && result.containsKey('token')) {
        final newToken = result['token'] as String;
        final newRefreshToken = result['refreshToken'] as String?;

        await _secureStorage.saveToken(newToken);
        if (newRefreshToken != null) {
          await _secureStorage.saveRefreshToken(newRefreshToken);
        }

        await _loadUserFromToken(newToken);
        _scheduleTokenRefresh(newToken);
      } else {
        await clearAuth();
      }
    } catch (_) {
      await clearAuth();
    }
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

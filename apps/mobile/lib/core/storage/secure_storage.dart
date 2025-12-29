import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage for sensitive data like tokens
class SecureStorage {
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userIdKey = 'user_id';
  static const String _biometricEnabledKey = 'biometric_enabled';

  final FlutterSecureStorage _storage;

  SecureStorage()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock_this_device,
          ),
        );

  // Token management
  Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }

  // Refresh token management
  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }

  Future<void> deleteRefreshToken() async {
    await _storage.delete(key: _refreshTokenKey);
  }

  // User ID
  Future<void> saveUserId(String userId) async {
    await _storage.write(key: _userIdKey, value: userId);
  }

  Future<String?> getUserId() async {
    return await _storage.read(key: _userIdKey);
  }

  // Biometric settings
  Future<void> setBiometricEnabled(bool enabled) async {
    await _storage.write(
      key: _biometricEnabledKey,
      value: enabled.toString(),
    );
  }

  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _biometricEnabledKey);
    return value == 'true';
  }

  // Clear all
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  // Write arbitrary data
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  // Read arbitrary data
  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  // Delete arbitrary data
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  // Check if key exists
  Future<bool> containsKey(String key) async {
    return await _storage.containsKey(key: key);
  }
}

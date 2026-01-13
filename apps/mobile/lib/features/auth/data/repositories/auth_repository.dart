import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../domain/models/user.dart';

/// Auth repository for handling authentication API calls
class AuthRepository {
  final ApiClient _apiClient;
  final SecureStorage _secureStorage;

  AuthRepository({
    ApiClient? apiClient,
    SecureStorage? secureStorage,
  })  : _apiClient = apiClient ?? ApiClient(),
        _secureStorage = secureStorage ?? SecureStorage();

  /// Login with email and password
  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String?;

      // Save tokens
      await _secureStorage.saveToken(token);
      if (refreshToken != null) {
        await _secureStorage.saveRefreshToken(refreshToken);
      }
      await _secureStorage.saveUserId(user.id);

      return AuthResult.success(user: user, token: token);
    } on ApiError catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('An unexpected error occurred');
    }
  }

  /// Sign up with email and password
  Future<AuthResult> signup({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required UserRole role,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/signup',
        data: {
          'email': email,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          'role': role.name,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['accessToken'] as String;
      final refreshToken = data['refreshToken'] as String?;

      // Save tokens
      await _secureStorage.saveToken(token);
      if (refreshToken != null) {
        await _secureStorage.saveRefreshToken(refreshToken);
      }
      await _secureStorage.saveUserId(user.id);

      return AuthResult.success(user: user, token: token);
    } on ApiError catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('An unexpected error occurred');
    }
  }

  /// Logout
  Future<void> logout() async {
    try {
      await _apiClient.post('/auth/logout');
    } catch (_) {
      // Ignore errors on logout
    } finally {
      await _secureStorage.clearAll();
    }
  }

  /// Request password reset
  Future<bool> requestPasswordReset(String email) async {
    try {
      await _apiClient.post(
        '/auth/forgot-password',
        data: {'email': email},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Reset password with token
  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      await _apiClient.post(
        '/auth/reset-password',
        data: {
          'token': token,
          'password': newPassword,
        },
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Refresh auth token
  Future<String?> refreshToken() async {
    try {
      final refreshToken = await _secureStorage.getRefreshToken();
      if (refreshToken == null) return null;

      final response = await _apiClient.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final data = response.data as Map<String, dynamic>;
      final newToken = data['accessToken'] as String;
      final newRefreshToken = data['refreshToken'] as String?;

      await _secureStorage.saveToken(newToken);
      if (newRefreshToken != null) {
        await _secureStorage.saveRefreshToken(newRefreshToken);
      }

      return newToken;
    } catch (_) {
      return null;
    }
  }

  /// Get current user
  Future<User?> getCurrentUser() async {
    try {
      final response = await _apiClient.get('/auth/me');
      final data = response.data as Map<String, dynamic>;
      return User.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  /// Login with Google
  Future<AuthResult> loginWithGoogle(String idToken) async {
    try {
      final response = await _apiClient.post(
        '/auth/google',
        data: {'idToken': idToken},
      );

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['accessToken'] as String;

      await _secureStorage.saveToken(token);
      await _secureStorage.saveUserId(user.id);

      return AuthResult.success(user: user, token: token);
    } on ApiError catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('Google login failed');
    }
  }

  /// Login with LinkedIn
  Future<AuthResult> loginWithLinkedIn(String authCode) async {
    try {
      final response = await _apiClient.post(
        '/auth/linkedin',
        data: {'code': authCode},
      );

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['accessToken'] as String;

      await _secureStorage.saveToken(token);
      await _secureStorage.saveUserId(user.id);

      return AuthResult.success(user: user, token: token);
    } on ApiError catch (e) {
      return AuthResult.failure(e.message);
    } catch (e) {
      return AuthResult.failure('LinkedIn login failed');
    }
  }
}

/// Auth result wrapper
sealed class AuthResult {
  const AuthResult();

  factory AuthResult.success({required User user, required String token}) =
      AuthResultSuccess;
  factory AuthResult.failure(String message) = AuthResultFailure;
}

class AuthResultSuccess extends AuthResult {
  final User user;
  final String token;

  const AuthResultSuccess({required this.user, required this.token});
}

class AuthResultFailure extends AuthResult {
  final String message;

  const AuthResultFailure(this.message);
}

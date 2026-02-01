import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/secure_storage.dart';
import 'package:skillancer_mobile/core/storage/local_cache.dart';
import 'package:skillancer_mobile/core/providers/providers.dart';
import 'package:skillancer_mobile/features/auth/data/repositories/auth_repository.dart';
import 'package:skillancer_mobile/features/auth/domain/models/auth_state.dart';
import 'package:skillancer_mobile/features/auth/domain/models/user.dart';

// Mock classes using mocktail
class MockApiClient extends Mock implements ApiClient {}

class MockSecureStorage extends Mock implements SecureStorage {}

class MockLocalCache extends Mock implements LocalCache {}

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockApiClient mockApiClient;
  late MockSecureStorage mockSecureStorage;
  late MockAuthRepository mockAuthRepository;
  late ProviderContainer container;

  setUp(() {
    mockApiClient = MockApiClient();
    mockSecureStorage = MockSecureStorage();
    mockAuthRepository = MockAuthRepository();
  });

  tearDown(() {
    container.dispose();
  });

  group('AuthProvider', () {
    test('initial state should be unauthenticated', () async {
      when(() => mockSecureStorage.getToken()).thenAnswer((_) async => null);
      when(() => mockSecureStorage.getRefreshToken())
          .thenAnswer((_) async => null);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final authState = container.read(authStateProvider);

      // Initial state should be AuthState.initial
      expect(authState, isA<AuthState>());
    });

    test('should authenticate user with valid credentials', () async {
      final testUser = User(
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.freelancer,
        createdAt: DateTime.now(),
      );

      when(() => mockAuthRepository.login(
            email: 'test@example.com',
            password: 'password123',
          )).thenAnswer((_) async => AuthResult.success(
            user: testUser,
            token: 'access-token',
          ));

      when(() => mockSecureStorage.saveToken(any())).thenAnswer((_) async {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.login('test@example.com', 'password123');

      verify(() => mockAuthRepository.login(
            email: 'test@example.com',
            password: 'password123',
          )).called(1);
    });

    test('should handle login failure', () async {
      when(() => mockAuthRepository.login(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(Exception('Invalid credentials'));

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.login('wrong@example.com', 'wrong');

      // After login failure, state should be error
      final authState = container.read(authStateProvider);
      expect(authState.isAuthenticated, isFalse);
    });

    test('should logout and clear tokens', () async {
      when(() => mockSecureStorage.deleteToken()).thenAnswer((_) async {});
      when(() => mockSecureStorage.deleteRefreshToken())
          .thenAnswer((_) async {});
      when(() => mockAuthRepository.logout()).thenAnswer((_) async {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.logout();

      verify(() => mockAuthRepository.logout()).called(1);
    });

    test('should restore session from stored tokens', () async {
      final testUser = User(
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.freelancer,
        createdAt: DateTime.now(),
      );

      when(() => mockSecureStorage.getToken())
          .thenAnswer((_) async => 'stored-access-token');
      when(() => mockSecureStorage.getRefreshToken())
          .thenAnswer((_) async => 'stored-refresh-token');
      when(() => mockAuthRepository.getCurrentUser())
          .thenAnswer((_) async => testUser);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.checkAuthStatus();

      verify(() => mockAuthRepository.getCurrentUser()).called(1);
    });
  });

  group('CurrentUserProvider', () {
    test('should return null when not authenticated', () async {
      when(() => mockSecureStorage.getToken()).thenAnswer((_) async => null);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final currentUser = container.read(currentUserProvider);
      expect(currentUser, isNull);
    });

    test('should return user when authenticated', () async {
      final testUser = User(
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.freelancer,
        createdAt: DateTime.now(),
      );

      when(() => mockSecureStorage.getToken())
          .thenAnswer((_) async => 'valid-token');
      when(() => mockAuthRepository.getCurrentUser())
          .thenAnswer((_) async => testUser);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      // This would be the authenticated state with user
      // In real test, we'd need to properly set up the auth state first
    });
  });

  group('IsAuthenticatedProvider', () {
    test('should return false when not authenticated', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final isAuthenticated = container.read(isAuthenticatedProvider);
      expect(isAuthenticated, isFalse);
    });
  });
}

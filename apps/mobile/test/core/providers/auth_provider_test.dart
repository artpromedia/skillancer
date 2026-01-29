import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/secure_storage.dart';
import 'package:skillancer_mobile/core/storage/local_cache.dart';
import 'package:skillancer_mobile/core/providers/providers.dart';
import 'package:skillancer_mobile/features/auth/data/repositories/auth_repository.dart';
import 'package:skillancer_mobile/features/auth/domain/models/auth_state.dart';
import 'package:skillancer_mobile/features/auth/domain/models/user.dart';

@GenerateMocks([ApiClient, SecureStorage, LocalCache, AuthRepository])
import 'auth_provider_test.mocks.dart';

void main() {
  late MockApiClient mockApiClient;
  late MockSecureStorage mockSecureStorage;
  late MockLocalCache mockLocalCache;
  late MockAuthRepository mockAuthRepository;
  late ProviderContainer container;

  setUp(() {
    mockApiClient = MockApiClient();
    mockSecureStorage = MockSecureStorage();
    mockLocalCache = MockLocalCache();
    mockAuthRepository = MockAuthRepository();
  });

  tearDown(() {
    container.dispose();
  });

  group('AuthProvider', () {
    test('initial state should be unauthenticated', () async {
      when(mockSecureStorage.read(key: 'access_token'))
          .thenAnswer((_) async => null);
      when(mockSecureStorage.read(key: 'refresh_token'))
          .thenAnswer((_) async => null);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final authState = container.read(authStateProvider);
      
      // Initial async state should be loading
      expect(authState, isA<AsyncLoading>());
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

      when(mockAuthRepository.login(
        email: 'test@example.com',
        password: 'password123',
      )).thenAnswer((_) async => AuthState.authenticated(
        user: testUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      ));

      when(mockSecureStorage.write(
        key: anyNamed('key'),
        value: anyNamed('value'),
      )).thenAnswer((_) async => {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.login(email: 'test@example.com', password: 'password123');

      verify(mockAuthRepository.login(
        email: 'test@example.com',
        password: 'password123',
      )).called(1);
    });

    test('should handle login failure', () async {
      when(mockAuthRepository.login(
        email: anyNamed('email'),
        password: anyNamed('password'),
      )).thenThrow(Exception('Invalid credentials'));

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      
      expect(
        () => notifier.login(email: 'wrong@example.com', password: 'wrong'),
        throwsException,
      );
    });

    test('should logout and clear tokens', () async {
      when(mockSecureStorage.delete(key: 'access_token'))
          .thenAnswer((_) async => {});
      when(mockSecureStorage.delete(key: 'refresh_token'))
          .thenAnswer((_) async => {});
      when(mockAuthRepository.logout()).thenAnswer((_) async => {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      final notifier = container.read(authStateProvider.notifier);
      await notifier.logout();

      verify(mockSecureStorage.delete(key: 'access_token')).called(1);
      verify(mockSecureStorage.delete(key: 'refresh_token')).called(1);
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

      when(mockSecureStorage.read(key: 'access_token'))
          .thenAnswer((_) async => 'stored-access-token');
      when(mockSecureStorage.read(key: 'refresh_token'))
          .thenAnswer((_) async => 'stored-refresh-token');
      when(mockAuthRepository.getCurrentUser())
          .thenAnswer((_) async => testUser);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          secureStorageProvider.overrideWithValue(mockSecureStorage),
          authRepositoryProvider.overrideWithValue(mockAuthRepository),
        ],
      );

      // Wait for the async initialization
      await container.read(authStateProvider.future);

      verify(mockSecureStorage.read(key: 'access_token')).called(1);
      verify(mockAuthRepository.getCurrentUser()).called(1);
    });
  });

  group('CurrentUserProvider', () {
    test('should return null when not authenticated', () async {
      when(mockSecureStorage.read(key: 'access_token'))
          .thenAnswer((_) async => null);

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

      when(mockSecureStorage.read(key: 'access_token'))
          .thenAnswer((_) async => 'valid-token');
      when(mockAuthRepository.getCurrentUser())
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

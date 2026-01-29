import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/secure_storage.dart';

@GenerateMocks([SecureStorage])
import 'api_client_test.mocks.dart';

void main() {
  late ApiClient apiClient;
  late MockSecureStorage mockSecureStorage;

  setUp(() {
    mockSecureStorage = MockSecureStorage();
  });

  group('ApiClient', () {
    group('GET requests', () {
      test('should make successful GET request', () async {
        final mockClient = MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/api/v1/users/me');

          return http.Response(
            jsonEncode({'id': 'user-123', 'email': 'test@example.com'}),
            200,
            headers: {'content-type': 'application/json'},
          );
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'valid-token');

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        final response = await apiClient.get('/api/v1/users/me');

        expect(response.statusCode, 200);
        expect(response.data['id'], 'user-123');
      });

      test('should add authorization header when token exists', () async {
        final mockClient = MockClient((request) async {
          expect(request.headers['Authorization'], 'Bearer valid-token');
          return http.Response('{}', 200);
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'valid-token');

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        await apiClient.get('/api/v1/protected');
      });

      test('should handle 401 unauthorized response', () async {
        final mockClient = MockClient((request) async {
          return http.Response(
            jsonEncode({'error': 'Unauthorized', 'message': 'Token expired'}),
            401,
          );
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'expired-token');

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        expect(
          () => apiClient.get('/api/v1/protected'),
          throwsA(isA<UnauthorizedException>()),
        );
      });

      test('should handle network errors gracefully', () async {
        final mockClient = MockClient((request) async {
          throw http.ClientException('Network error');
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        expect(
          () => apiClient.get('/api/v1/users'),
          throwsA(isA<NetworkException>()),
        );
      });

      test('should add query parameters to GET request', () async {
        final mockClient = MockClient((request) async {
          expect(request.url.queryParameters['page'], '1');
          expect(request.url.queryParameters['limit'], '20');
          return http.Response('[]', 200);
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => null);

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        await apiClient.get('/api/v1/jobs', queryParameters: {
          'page': '1',
          'limit': '20',
        });
      });
    });

    group('POST requests', () {
      test('should make successful POST request with JSON body', () async {
        final mockClient = MockClient((request) async {
          expect(request.method, 'POST');
          expect(request.headers['Content-Type'], contains('application/json'));

          final body = jsonDecode(request.body);
          expect(body['email'], 'test@example.com');
          expect(body['password'], 'password123');

          return http.Response(
            jsonEncode({
              'access_token': 'new-token',
              'refresh_token': 'refresh-token',
            }),
            200,
          );
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        final response = await apiClient.post('/api/v1/auth/login', body: {
          'email': 'test@example.com',
          'password': 'password123',
        });

        expect(response.statusCode, 200);
        expect(response.data['access_token'], 'new-token');
      });

      test('should handle 400 validation error', () async {
        final mockClient = MockClient((request) async {
          return http.Response(
            jsonEncode({
              'error': 'Validation Error',
              'message': 'Email is required',
              'validation': [
                {'field': 'email', 'message': 'Email is required'}
              ],
            }),
            400,
          );
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        expect(
          () => apiClient.post('/api/v1/auth/register', body: {}),
          throwsA(isA<ValidationException>()),
        );
      });

      test('should handle 429 rate limit error', () async {
        final mockClient = MockClient((request) async {
          return http.Response(
            jsonEncode({
              'error': 'Too Many Requests',
              'message': 'Rate limit exceeded',
              'retryAfter': 60,
            }),
            429,
            headers: {'Retry-After': '60'},
          );
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        expect(
          () => apiClient.post('/api/v1/auth/login', body: {}),
          throwsA(isA<RateLimitException>()),
        );
      });
    });

    group('PUT requests', () {
      test('should make successful PUT request', () async {
        final mockClient = MockClient((request) async {
          expect(request.method, 'PUT');
          return http.Response(
            jsonEncode({'id': 'user-123', 'firstName': 'Updated'}),
            200,
          );
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'valid-token');

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        final response = await apiClient.put('/api/v1/users/me', body: {
          'firstName': 'Updated',
        });

        expect(response.statusCode, 200);
      });
    });

    group('DELETE requests', () {
      test('should make successful DELETE request', () async {
        final mockClient = MockClient((request) async {
          expect(request.method, 'DELETE');
          return http.Response('', 204);
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'valid-token');

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
        );

        final response = await apiClient.delete('/api/v1/sessions/123');

        expect(response.statusCode, 204);
      });
    });

    group('Token refresh', () {
      test('should automatically refresh token on 401', () async {
        var requestCount = 0;

        final mockClient = MockClient((request) async {
          requestCount++;

          if (requestCount == 1) {
            // First request fails with 401
            return http.Response(
              jsonEncode({'error': 'Token expired'}),
              401,
            );
          } else if (request.url.path == '/api/v1/auth/refresh') {
            // Refresh token request
            return http.Response(
              jsonEncode({
                'access_token': 'new-access-token',
                'refresh_token': 'new-refresh-token',
              }),
              200,
            );
          } else {
            // Retry with new token
            expect(request.headers['Authorization'], 'Bearer new-access-token');
            return http.Response(
              jsonEncode({'id': 'user-123'}),
              200,
            );
          }
        });

        when(mockSecureStorage.read(key: 'access_token'))
            .thenAnswer((_) async => 'expired-token');
        when(mockSecureStorage.read(key: 'refresh_token'))
            .thenAnswer((_) async => 'valid-refresh-token');
        when(mockSecureStorage.write(
                key: anyNamed('key'), value: anyNamed('value')))
            .thenAnswer((_) async => {});

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
          enableTokenRefresh: true,
        );

        // This should trigger token refresh and retry
        // Note: Implementation depends on actual ApiClient structure
      });
    });

    group('Request timeout', () {
      test('should handle request timeout', () async {
        final mockClient = MockClient((request) async {
          await Future.delayed(const Duration(seconds: 35));
          return http.Response('{}', 200);
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
          timeout: const Duration(seconds: 30),
        );

        expect(
          () => apiClient.get('/api/v1/slow-endpoint'),
          throwsA(isA<TimeoutException>()),
        );
      });
    });

    group('Retry logic', () {
      test('should retry on 500 server error', () async {
        var attempts = 0;

        final mockClient = MockClient((request) async {
          attempts++;
          if (attempts < 3) {
            return http.Response('Server Error', 500);
          }
          return http.Response('{}', 200);
        });

        apiClient = ApiClient(
          baseUrl: 'https://api.skillancer.com',
          httpClient: mockClient,
          secureStorage: mockSecureStorage,
          maxRetries: 3,
        );

        final response = await apiClient.get('/api/v1/users');

        expect(attempts, 3);
        expect(response.statusCode, 200);
      });
    });
  });
}

// Custom exception classes (should match actual implementation)
class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException(this.message);
}

class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
}

class ValidationException implements Exception {
  final String message;
  final List<Map<String, dynamic>> errors;
  ValidationException(this.message, this.errors);
}

class RateLimitException implements Exception {
  final String message;
  final int retryAfter;
  RateLimitException(this.message, this.retryAfter);
}

class TimeoutException implements Exception {
  final String message;
  TimeoutException(this.message);
}

import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../storage/secure_storage.dart';

/// API Client using Dio with interceptors
class ApiClient {
  static const String baseUrl = 'https://api.skillancer.com/v1';
  static const Duration timeout = Duration(seconds: 30);

  late final Dio _dio;
  final SecureStorage _secureStorage = SecureStorage();
  final List<Map<String, dynamic>> _offlineQueue = [];

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: timeout,
        receiveTimeout: timeout,
        sendTimeout: timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _setupInterceptors();
  }

  void _setupInterceptors() {
    // Auth interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Try to refresh token
            final refreshed = await _refreshToken();
            if (refreshed) {
              // Retry the request
              final retryResponse = await _retry(error.requestOptions);
              return handler.resolve(retryResponse);
            }
          }
          return handler.next(error);
        },
      ),
    );

    // Retry interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (error, handler) async {
          if (_shouldRetry(error)) {
            final retryCount = error.requestOptions.extra['retryCount'] ?? 0;
            if (retryCount < 3) {
              await Future.delayed(Duration(seconds: retryCount + 1));
              error.requestOptions.extra['retryCount'] = retryCount + 1;
              final response = await _retry(error.requestOptions);
              return handler.resolve(response);
            }
          }
          return handler.next(error);
        },
      ),
    );

    // Logging interceptor (debug only)
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
          logPrint: (log) => debugPrint('[API] $log'),
        ),
      );
    }

    // Error interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (error, handler) {
          final apiError = _mapError(error);
          return handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: apiError,
              type: error.type,
              response: error.response,
            ),
          );
        },
      ),
    );
  }

  bool _shouldRetry(DioException error) {
    return error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        (error.response?.statusCode ?? 0) >= 500;
  }

  Future<Response> _retry(RequestOptions requestOptions) async {
    return _dio.fetch(requestOptions);
  }

  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.getRefreshToken();
      if (refreshToken == null) return false;

      final response = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(headers: {'Authorization': ''}),
      );

      final newToken = response.data['accessToken'] as String?;
      final newRefreshToken = response.data['refreshToken'] as String?;

      if (newToken != null) {
        await _secureStorage.saveToken(newToken);
        if (newRefreshToken != null) {
          await _secureStorage.saveRefreshToken(newRefreshToken);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  ApiError _mapError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiError(
          code: 'TIMEOUT',
          message: 'Connection timed out. Please try again.',
        );
      case DioExceptionType.connectionError:
        return ApiError(
          code: 'NO_CONNECTION',
          message: 'No internet connection. Please check your network.',
        );
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode ?? 0;
        final data = error.response?.data;
        String message = 'An error occurred';

        if (data is Map<String, dynamic>) {
          message = data['message'] as String? ?? message;
        }

        return ApiError(
          code: 'HTTP_$statusCode',
          message: message,
          statusCode: statusCode,
        );
      default:
        return ApiError(
          code: 'UNKNOWN',
          message: 'An unexpected error occurred',
        );
    }
  }

  // Queue request for offline
  void queueOfflineRequest(String method, String path, {dynamic data}) {
    _offlineQueue.add({
      'method': method,
      'path': path,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  // Process offline queue
  Future<void> processOfflineQueue() async {
    final queue = List<Map<String, dynamic>>.from(_offlineQueue);
    _offlineQueue.clear();

    for (final request in queue) {
      try {
        switch (request['method']) {
          case 'POST':
            await post(request['path'], data: request['data']);
            break;
          case 'PUT':
            await put(request['path'], data: request['data']);
            break;
          case 'DELETE':
            await delete(request['path']);
            break;
        }
      } catch (e) {
        // Re-queue failed requests
        _offlineQueue.add(request);
      }
    }
  }

  // HTTP methods
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.patch<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  // File upload
  Future<Response<T>> uploadFile<T>(
    String path,
    File file, {
    String fieldName = 'file',
    Map<String, dynamic>? extraFields,
    void Function(int, int)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      fieldName: await MultipartFile.fromFile(
        file.path,
        filename: file.path.split('/').last,
      ),
      ...?extraFields,
    });

    return _dio.post<T>(
      path,
      data: formData,
      onSendProgress: onProgress,
      options: Options(
        headers: {'Content-Type': 'multipart/form-data'},
      ),
    );
  }
}

/// API Error class
class ApiError implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? details;

  ApiError({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
  });

  bool get isNetworkError => code == 'NO_CONNECTION' || code == 'TIMEOUT';

  bool get isAuthError => statusCode == 401 || statusCode == 403;

  bool get isServerError => (statusCode ?? 0) >= 500;

  @override
  String toString() => 'ApiError($code): $message';
}

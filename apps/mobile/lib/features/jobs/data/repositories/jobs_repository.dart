import '../../../core/network/api_client.dart';
import '../../../core/storage/local_cache.dart';
import '../domain/models/job.dart';
import '../domain/models/job_filter.dart';

/// Jobs repository for fetching and caching jobs
class JobsRepository {
  final ApiClient _apiClient;
  final LocalCache _localCache;

  JobsRepository({ApiClient? apiClient, LocalCache? localCache})
      : _apiClient = apiClient ?? ApiClient(),
        _localCache = localCache ?? LocalCache();

  /// Fetch jobs with optional filters
  Future<JobsResult> getJobs({
    JobFilter? filter,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = {
        'page': page,
        'limit': limit,
        ...?filter?.toQueryParams(),
      };

      final response = await _apiClient.get(
        '/jobs',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final jobsList = (data['jobs'] as List)
          .map((j) => Job.fromJson(j as Map<String, dynamic>))
          .toList();

      // Cache the jobs
      await _localCache.cacheJobs(jobsList);

      return JobsResult(
        jobs: jobsList,
        total: data['total'] as int? ?? jobsList.length,
        hasMore: data['hasMore'] as bool? ?? false,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch jobs');
    }
  }

  /// Get job details by ID
  Future<Job> getJobById(String jobId) async {
    try {
      final response = await _apiClient.get('/jobs/$jobId');
      final job = Job.fromJson(response.data as Map<String, dynamic>);
      await _localCache.cacheJob(job);
      return job;
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch job');
    }
  }

  /// Get cached jobs (for offline mode)
  List<Job> getCachedJobs() {
    return _localCache.getCachedJobs();
  }

  /// Get cached job by ID
  Job? getCachedJob(String jobId) {
    return _localCache.getCachedJob(jobId);
  }

  /// Save a job
  Future<void> saveJob(String jobId) async {
    try {
      await _apiClient.post('/jobs/$jobId/save');
    } on ApiError {
      rethrow;
    }
  }

  /// Unsave a job
  Future<void> unsaveJob(String jobId) async {
    try {
      await _apiClient.delete('/jobs/$jobId/save');
    } on ApiError {
      rethrow;
    }
  }

  /// Get saved jobs
  Future<List<Job>> getSavedJobs() async {
    try {
      final response = await _apiClient.get('/jobs/saved');
      final data = response.data as Map<String, dynamic>;
      return (data['jobs'] as List)
          .map((j) => Job.fromJson(j as Map<String, dynamic>))
          .toList();
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch saved jobs');
    }
  }

  /// Search jobs
  Future<List<Job>> searchJobs(String query) async {
    try {
      final response = await _apiClient.get(
        '/jobs/search',
        queryParameters: {'q': query},
      );
      final data = response.data as Map<String, dynamic>;
      return (data['jobs'] as List)
          .map((j) => Job.fromJson(j as Map<String, dynamic>))
          .toList();
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'SEARCH_ERROR', message: 'Search failed');
    }
  }

  /// Get similar jobs
  Future<List<Job>> getSimilarJobs(String jobId) async {
    try {
      final response = await _apiClient.get('/jobs/$jobId/similar');
      final data = response.data as Map<String, dynamic>;
      return (data['jobs'] as List)
          .map((j) => Job.fromJson(j as Map<String, dynamic>))
          .toList();
    } on ApiError {
      rethrow;
    } catch (e) {
      return [];
    }
  }
}

/// Result wrapper for paginated jobs
class JobsResult {
  final List<Job> jobs;
  final int total;
  final bool hasMore;

  const JobsResult({
    required this.jobs,
    required this.total,
    required this.hasMore,
  });
}

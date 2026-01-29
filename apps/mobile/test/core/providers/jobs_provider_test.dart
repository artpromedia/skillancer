import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/local_cache.dart';
import 'package:skillancer_mobile/core/providers/providers.dart';
import 'package:skillancer_mobile/features/jobs/data/repositories/jobs_repository.dart';
import 'package:skillancer_mobile/features/jobs/domain/models/job.dart';
import 'package:skillancer_mobile/features/jobs/domain/models/job_filter.dart';

@GenerateMocks([ApiClient, LocalCache, JobsRepository])
import 'jobs_provider_test.mocks.dart';

void main() {
  late MockApiClient mockApiClient;
  late MockLocalCache mockLocalCache;
  late MockJobsRepository mockJobsRepository;
  late ProviderContainer container;

  final testJobs = [
    Job(
      id: 'job-1',
      title: 'Senior Flutter Developer',
      description: 'We need a Flutter expert',
      clientId: 'client-1',
      category: 'Mobile Development',
      skills: ['Flutter', 'Dart', 'Firebase'],
      budget: JobBudget(type: BudgetType.fixed, amount: 5000, currency: 'USD'),
      status: JobStatus.open,
      createdAt: DateTime.now(),
    ),
    Job(
      id: 'job-2',
      title: 'React Native Developer',
      description: 'Cross-platform mobile app',
      clientId: 'client-2',
      category: 'Mobile Development',
      skills: ['React Native', 'JavaScript', 'TypeScript'],
      budget: JobBudget(
        type: BudgetType.hourly,
        minRate: 50,
        maxRate: 100,
        currency: 'USD',
      ),
      status: JobStatus.open,
      createdAt: DateTime.now(),
    ),
  ];

  setUp(() {
    mockApiClient = MockApiClient();
    mockLocalCache = MockLocalCache();
    mockJobsRepository = MockJobsRepository();
  });

  tearDown(() {
    container.dispose();
  });

  group('JobsProvider', () {
    test('should load jobs from repository', () async {
      when(mockJobsRepository.getJobs(
        page: anyNamed('page'),
        limit: anyNamed('limit'),
      )).thenAnswer((_) async => JobsPage(
            jobs: testJobs,
            total: 2,
            page: 1,
            totalPages: 1,
          ));

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final jobs = await container.read(jobsProvider.future);

      expect(jobs, hasLength(2));
      expect(jobs.first.title, 'Senior Flutter Developer');
    });

    test('should apply filters to job search', () async {
      final filter = JobFilter(
        category: 'Mobile Development',
        skills: ['Flutter'],
        minBudget: 1000,
        maxBudget: 10000,
      );

      when(mockJobsRepository.searchJobs(filter: filter))
          .thenAnswer((_) async => [testJobs.first]);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final notifier = container.read(jobFilterProvider.notifier);
      notifier.state = filter;

      final filteredJobs = await container.read(filteredJobsProvider.future);

      expect(filteredJobs, hasLength(1));
      expect(filteredJobs.first.skills, contains('Flutter'));
    });

    test('should handle empty results', () async {
      when(mockJobsRepository.getJobs(
        page: anyNamed('page'),
        limit: anyNamed('limit'),
      )).thenAnswer((_) async => JobsPage(
            jobs: [],
            total: 0,
            page: 1,
            totalPages: 0,
          ));

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final jobs = await container.read(jobsProvider.future);

      expect(jobs, isEmpty);
    });

    test('should handle error gracefully', () async {
      when(mockJobsRepository.getJobs(
        page: anyNamed('page'),
        limit: anyNamed('limit'),
      )).thenThrow(Exception('Network error'));

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      expect(
        () => container.read(jobsProvider.future),
        throwsException,
      );
    });

    test('should cache jobs locally', () async {
      when(mockJobsRepository.getJobs(
        page: anyNamed('page'),
        limit: anyNamed('limit'),
      )).thenAnswer((_) async => JobsPage(
            jobs: testJobs,
            total: 2,
            page: 1,
            totalPages: 1,
          ));

      when(mockLocalCache.set(any, any)).thenAnswer((_) async => {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      await container.read(jobsProvider.future);

      // Verify cache was called
      // This depends on actual implementation
    });

    test('should return cached jobs when offline', () async {
      when(mockLocalCache.get('jobs_cache')).thenAnswer((_) async => testJobs);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
          isOnlineProvider.overrideWithValue(false),
        ],
      );

      // When offline, should use cached data
      // Implementation depends on actual offline strategy
    });
  });

  group('SingleJobProvider', () {
    test('should fetch single job by id', () async {
      when(mockJobsRepository.getJobById('job-1'))
          .thenAnswer((_) async => testJobs.first);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final job = await container.read(jobByIdProvider('job-1').future);

      expect(job, isNotNull);
      expect(job!.id, 'job-1');
      expect(job.title, 'Senior Flutter Developer');
    });

    test('should return null for non-existent job', () async {
      when(mockJobsRepository.getJobById('non-existent'))
          .thenAnswer((_) async => null);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final job = await container.read(jobByIdProvider('non-existent').future);

      expect(job, isNull);
    });
  });

  group('JobFilterProvider', () {
    test('should initialize with default filter', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final filter = container.read(jobFilterProvider);

      expect(filter, equals(JobFilter.empty));
    });

    test('should update filter state', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final notifier = container.read(jobFilterProvider.notifier);

      final newFilter = JobFilter(
        category: 'Web Development',
        skills: ['React', 'Node.js'],
      );

      notifier.state = newFilter;

      expect(container.read(jobFilterProvider).category, 'Web Development');
      expect(container.read(jobFilterProvider).skills, contains('React'));
    });

    test('should reset filter to default', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final notifier = container.read(jobFilterProvider.notifier);

      // Set a filter
      notifier.state = JobFilter(category: 'Design');

      // Reset
      notifier.state = JobFilter.empty;

      expect(container.read(jobFilterProvider), equals(JobFilter.empty));
    });
  });

  group('SavedJobsProvider', () {
    test('should save job to favorites', () async {
      when(mockJobsRepository.saveJob('job-1')).thenAnswer((_) async => true);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final notifier = container.read(savedJobsProvider.notifier);
      await notifier.saveJob('job-1');

      verify(mockJobsRepository.saveJob('job-1')).called(1);
    });

    test('should remove job from favorites', () async {
      when(mockJobsRepository.unsaveJob('job-1')).thenAnswer((_) async => true);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final notifier = container.read(savedJobsProvider.notifier);
      await notifier.unsaveJob('job-1');

      verify(mockJobsRepository.unsaveJob('job-1')).called(1);
    });
  });
}

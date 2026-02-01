import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/local_cache.dart';
import 'package:skillancer_mobile/core/providers/providers.dart';
import 'package:skillancer_mobile/features/jobs/data/repositories/jobs_repository.dart';
import 'package:skillancer_mobile/features/jobs/domain/models/job.dart';
import 'package:skillancer_mobile/features/jobs/domain/models/job_filter.dart';

// Mock classes using mocktail
class MockApiClient extends Mock implements ApiClient {}

class MockLocalCache extends Mock implements LocalCache {}

class MockJobsRepository extends Mock implements JobsRepository {}

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
      clientName: 'Test Client',
      budget: 5000,
      budgetType: BudgetType.fixed,
      skills: ['Flutter', 'Dart', 'Firebase'],
      postedAt: DateTime.now(),
      proposalCount: 5,
      experienceLevel: ExperienceLevel.expert,
      projectDuration: ProjectDuration.oneToThreeMonths,
      isRemote: true,
      category: 'Mobile Development',
    ),
    Job(
      id: 'job-2',
      title: 'React Native Developer',
      description: 'Cross-platform mobile app',
      clientName: 'Another Client',
      budget: 75,
      budgetType: BudgetType.hourly,
      skills: ['React Native', 'JavaScript', 'TypeScript'],
      postedAt: DateTime.now(),
      proposalCount: 10,
      experienceLevel: ExperienceLevel.intermediate,
      projectDuration: ProjectDuration.threeToSixMonths,
      isRemote: true,
      category: 'Mobile Development',
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
      when(() => mockJobsRepository.getJobs(
            filter: any(named: 'filter'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => JobsResult(
            jobs: testJobs,
            total: 2,
            hasMore: false,
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

    test('should handle empty results', () async {
      when(() => mockJobsRepository.getJobs(
            filter: any(named: 'filter'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => JobsResult(
            jobs: [],
            total: 0,
            hasMore: false,
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
      when(() => mockJobsRepository.getJobs(
            filter: any(named: 'filter'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
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
  });

  group('JobDetailProvider', () {
    test('should fetch single job by id', () async {
      when(() => mockJobsRepository.getJobById('job-1'))
          .thenAnswer((_) async => testJobs.first);

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final job = await container.read(jobDetailProvider('job-1').future);

      expect(job, isNotNull);
      expect(job!.id, 'job-1');
      expect(job.title, 'Senior Flutter Developer');
    });
  });

  group('JobsFilterProvider', () {
    test('should initialize with default filter', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final filter = container.read(jobsFilterProvider);

      expect(filter, isA<JobFilter>());
    });

    test('should update filter state', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final notifier = container.read(jobsFilterProvider.notifier);

      const newFilter = JobFilter(
        category: 'Web Development',
        skills: ['React', 'Node.js'],
      );

      notifier.state = newFilter;

      expect(container.read(jobsFilterProvider).category, 'Web Development');
      expect(container.read(jobsFilterProvider).skills, contains('React'));
    });

    test('should reset filter to default', () {
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
        ],
      );

      final notifier = container.read(jobsFilterProvider.notifier);

      // Set a filter
      notifier.state = const JobFilter(category: 'Design');

      // Reset
      notifier.state = const JobFilter();

      expect(container.read(jobsFilterProvider), isA<JobFilter>());
    });
  });

  group('SavedJobsProvider', () {
    test('should toggle job to save it', () async {
      when(() => mockJobsRepository.saveJob('job-1')).thenAnswer((_) async {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final notifier = container.read(savedJobsProvider.notifier);
      await notifier.toggle('job-1');

      expect(notifier.isSaved('job-1'), isTrue);
      verify(() => mockJobsRepository.saveJob('job-1')).called(1);
    });

    test('should toggle job to unsave it', () async {
      when(() => mockJobsRepository.saveJob('job-1')).thenAnswer((_) async {});
      when(() => mockJobsRepository.unsaveJob('job-1'))
          .thenAnswer((_) async {});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localCacheProvider.overrideWithValue(mockLocalCache),
          jobsRepositoryProvider.overrideWithValue(mockJobsRepository),
        ],
      );

      final notifier = container.read(savedJobsProvider.notifier);

      // First toggle saves
      await notifier.toggle('job-1');
      expect(notifier.isSaved('job-1'), isTrue);

      // Second toggle unsaves
      await notifier.toggle('job-1');
      expect(notifier.isSaved('job-1'), isFalse);

      verify(() => mockJobsRepository.unsaveJob('job-1')).called(1);
    });
  });
}

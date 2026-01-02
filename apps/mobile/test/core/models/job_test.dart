import 'package:flutter_test/flutter_test.dart';
import 'package:skillancer_mobile/features/jobs/domain/models/job.dart';

void main() {
  group('Job', () {
    final testJob = Job(
      id: 'job-123',
      title: 'Flutter Developer Needed',
      description: 'We need an experienced Flutter developer for our mobile app.',
      clientName: 'Tech Startup Inc.',
      clientAvatarUrl: 'https://example.com/avatar.png',
      budget: 5000.0,
      budgetType: BudgetType.fixed,
      skills: ['Flutter', 'Dart', 'Firebase'],
      postedAt: DateTime.parse('2024-01-15T10:00:00Z'),
      proposalCount: 15,
      experienceLevel: ExperienceLevel.intermediate,
      projectDuration: ProjectDuration.oneToThreeMonths,
      isRemote: true,
      location: 'San Francisco, CA',
      smartMatchScore: 85,
      category: 'Mobile Development',
    );

    group('budgetDisplay', () {
      test('shows hourly rate format for hourly jobs', () {
        final hourlyJob = Job(
          id: 'hourly-job',
          title: 'Hourly Contract',
          description: 'Hourly work',
          clientName: 'Client',
          budget: 75.0,
          budgetType: BudgetType.hourly,
          skills: ['Dart'],
          postedAt: DateTime.now(),
          proposalCount: 0,
          experienceLevel: ExperienceLevel.expert,
          projectDuration: ProjectDuration.moreThanSixMonths,
          isRemote: true,
        );

        expect(hourlyJob.budgetDisplay, equals('\$75/hr'));
      });

      test('shows fixed price format for fixed jobs', () {
        expect(testJob.budgetDisplay, equals('\$5000'));
      });
    });

    group('fromJson', () {
      test('parses JSON correctly', () {
        final json = {
          'id': 'job-123',
          'title': 'Flutter Developer Needed',
          'description': 'We need an experienced Flutter developer.',
          'clientName': 'Tech Startup Inc.',
          'clientAvatarUrl': 'https://example.com/avatar.png',
          'budget': 5000.0,
          'budgetType': 'fixed',
          'skills': ['Flutter', 'Dart', 'Firebase'],
          'postedAt': '2024-01-15T10:00:00.000Z',
          'proposalCount': 15,
          'experienceLevel': 'intermediate',
          'projectDuration': 'oneToThreeMonths',
          'isRemote': true,
          'location': 'San Francisco, CA',
          'smartMatchScore': 85,
          'category': 'Mobile Development',
        };

        final job = Job.fromJson(json);

        expect(job.id, equals('job-123'));
        expect(job.title, equals('Flutter Developer Needed'));
        expect(job.budget, equals(5000.0));
        expect(job.budgetType, equals(BudgetType.fixed));
        expect(job.skills, equals(['Flutter', 'Dart', 'Firebase']));
        expect(job.experienceLevel, equals(ExperienceLevel.intermediate));
        expect(job.projectDuration, equals(ProjectDuration.oneToThreeMonths));
        expect(job.isRemote, isTrue);
        expect(job.smartMatchScore, equals(85));
      });

      test('uses default values for missing optional fields', () {
        final json = {
          'id': 'job-minimal',
          'title': 'Minimal Job',
          'description': 'Description',
          'clientName': 'Client',
          'budget': 1000,
          'budgetType': 'fixed',
          'skills': ['Skill'],
          'postedAt': '2024-01-01T00:00:00.000Z',
          'experienceLevel': 'entry',
          'projectDuration': 'lessThanOneMonth',
        };

        final job = Job.fromJson(json);

        expect(job.proposalCount, equals(0));
        expect(job.isRemote, isTrue);
        expect(job.location, isNull);
        expect(job.smartMatchScore, isNull);
        expect(job.clientAvatarUrl, isNull);
      });

      test('defaults to intermediate for unknown experience level', () {
        final json = {
          'id': 'job',
          'title': 'Job',
          'description': 'Description',
          'clientName': 'Client',
          'budget': 1000,
          'budgetType': 'fixed',
          'skills': ['Skill'],
          'postedAt': '2024-01-01T00:00:00.000Z',
          'experienceLevel': 'unknown_level',
          'projectDuration': 'oneToThreeMonths',
        };

        final job = Job.fromJson(json);

        expect(job.experienceLevel, equals(ExperienceLevel.intermediate));
      });
    });

    group('toJson', () {
      test('serializes to JSON correctly', () {
        final json = testJob.toJson();

        expect(json['id'], equals('job-123'));
        expect(json['title'], equals('Flutter Developer Needed'));
        expect(json['budget'], equals(5000.0));
        expect(json['budgetType'], equals('fixed'));
        expect(json['skills'], equals(['Flutter', 'Dart', 'Firebase']));
        expect(json['experienceLevel'], equals('intermediate'));
        expect(json['projectDuration'], equals('oneToThreeMonths'));
        expect(json['isRemote'], isTrue);
      });

      test('roundtrip JSON parsing preserves data', () {
        final json = testJob.toJson();
        final parsedJob = Job.fromJson(json);

        expect(parsedJob.id, equals(testJob.id));
        expect(parsedJob.title, equals(testJob.title));
        expect(parsedJob.budget, equals(testJob.budget));
        expect(parsedJob.skills, equals(testJob.skills));
      });
    });

    group('BudgetType', () {
      test('displayName returns correct values', () {
        expect(BudgetType.fixed.displayName, equals('Fixed Price'));
        expect(BudgetType.hourly.displayName, equals('Hourly'));
      });
    });

    group('ExperienceLevel', () {
      test('displayName returns correct values', () {
        expect(ExperienceLevel.entry.displayName, equals('Entry Level'));
        expect(ExperienceLevel.intermediate.displayName, equals('Intermediate'));
        expect(ExperienceLevel.expert.displayName, equals('Expert'));
      });
    });

    group('ProjectDuration', () {
      test('displayName returns correct values', () {
        expect(
          ProjectDuration.lessThanOneMonth.displayName,
          equals('Less than 1 month'),
        );
        expect(
          ProjectDuration.oneToThreeMonths.displayName,
          equals('1-3 months'),
        );
        expect(
          ProjectDuration.threeToSixMonths.displayName,
          equals('3-6 months'),
        );
        expect(
          ProjectDuration.moreThanSixMonths.displayName,
          equals('More than 6 months'),
        );
      });
    });
  });
}

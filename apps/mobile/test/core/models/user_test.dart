import 'package:flutter_test/flutter_test.dart';
import 'package:skillancer_mobile/features/auth/domain/models/user.dart';

void main() {
  group('User', () {
    const testUser = User(
      id: 'test-id-123',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.freelancer,
      title: 'Full Stack Developer',
      bio: 'Experienced developer',
      hourlyRate: 75.0,
      isVerified: true,
      isAvailable: true,
    );

    group('fullName', () {
      test('returns combined first and last name', () {
        expect(testUser.fullName, equals('John Doe'));
      });
    });

    group('initials', () {
      test('returns uppercase initials from first and last name', () {
        expect(testUser.initials, equals('JD'));
      });

      test('handles single character names', () {
        const singleCharUser = User(
          id: '1',
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          role: UserRole.client,
        );
        expect(singleCharUser.initials, equals('AB'));
      });

      test('handles empty names gracefully', () {
        const emptyNameUser = User(
          id: '1',
          email: 'a@b.com',
          firstName: '',
          lastName: '',
          role: UserRole.client,
        );
        expect(emptyNameUser.initials, equals(''));
      });
    });

    group('copyWith', () {
      test('creates a copy with modified fields', () {
        final updatedUser = testUser.copyWith(
          firstName: 'Jane',
          hourlyRate: 100.0,
        );

        expect(updatedUser.firstName, equals('Jane'));
        expect(updatedUser.hourlyRate, equals(100.0));
        expect(updatedUser.lastName, equals('Doe'));
        expect(updatedUser.email, equals('john.doe@example.com'));
      });

      test('returns identical copy when no params provided', () {
        final copy = testUser.copyWith();
        expect(copy, equals(testUser));
      });
    });

    group('fromJson', () {
      test('parses JSON correctly', () {
        final json = {
          'id': 'test-id-123',
          'email': 'john.doe@example.com',
          'firstName': 'John',
          'lastName': 'Doe',
          'role': 'freelancer',
          'title': 'Full Stack Developer',
          'bio': 'Experienced developer',
          'hourlyRate': 75.0,
          'isVerified': true,
          'isAvailable': true,
          'createdAt': '2024-01-01T00:00:00.000Z',
        };

        final user = User.fromJson(json);

        expect(user.id, equals('test-id-123'));
        expect(user.email, equals('john.doe@example.com'));
        expect(user.firstName, equals('John'));
        expect(user.lastName, equals('Doe'));
        expect(user.role, equals(UserRole.freelancer));
        expect(user.hourlyRate, equals(75.0));
        expect(user.isVerified, isTrue);
      });

      test('uses default values for missing optional fields', () {
        final json = {
          'id': 'test-id',
          'email': 'test@example.com',
          'firstName': 'Test',
          'lastName': 'User',
          'role': 'client',
        };

        final user = User.fromJson(json);

        expect(user.isVerified, isFalse);
        expect(user.isAvailable, isTrue);
        expect(user.avatarUrl, isNull);
      });

      test('defaults to freelancer for unknown role', () {
        final json = {
          'id': 'test-id',
          'email': 'test@example.com',
          'firstName': 'Test',
          'lastName': 'User',
          'role': 'unknown_role',
        };

        final user = User.fromJson(json);

        expect(user.role, equals(UserRole.freelancer));
      });
    });

    group('toJson', () {
      test('serializes to JSON correctly', () {
        final json = testUser.toJson();

        expect(json['id'], equals('test-id-123'));
        expect(json['email'], equals('john.doe@example.com'));
        expect(json['firstName'], equals('John'));
        expect(json['lastName'], equals('Doe'));
        expect(json['role'], equals('freelancer'));
        expect(json['hourlyRate'], equals(75.0));
      });

      test('roundtrip JSON parsing', () {
        final json = testUser.toJson();
        final parsedUser = User.fromJson(json);

        expect(parsedUser.id, equals(testUser.id));
        expect(parsedUser.email, equals(testUser.email));
        expect(parsedUser.firstName, equals(testUser.firstName));
        expect(parsedUser.lastName, equals(testUser.lastName));
        expect(parsedUser.role, equals(testUser.role));
      });
    });

    group('UserRole', () {
      test('displayName returns correct values', () {
        expect(UserRole.freelancer.displayName, equals('Freelancer'));
        expect(UserRole.client.displayName, equals('Client'));
        expect(UserRole.admin.displayName, equals('Admin'));
      });
    });

    group('Equatable', () {
      test('two users with same props are equal', () {
        const user1 = User(
          id: 'same-id',
          email: 'same@email.com',
          firstName: 'Same',
          lastName: 'Name',
          role: UserRole.freelancer,
        );
        const user2 = User(
          id: 'same-id',
          email: 'same@email.com',
          firstName: 'Same',
          lastName: 'Name',
          role: UserRole.freelancer,
        );

        expect(user1, equals(user2));
      });

      test('two users with different props are not equal', () {
        const user1 = User(
          id: 'id-1',
          email: 'user1@email.com',
          firstName: 'User',
          lastName: 'One',
          role: UserRole.freelancer,
        );
        const user2 = User(
          id: 'id-2',
          email: 'user2@email.com',
          firstName: 'User',
          lastName: 'Two',
          role: UserRole.client,
        );

        expect(user1, isNot(equals(user2)));
      });
    });
  });
}

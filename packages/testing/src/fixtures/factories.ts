/**
 * Test Data Factories
 *
 * Factory functions for creating test data with @faker-js/faker.
 * Uses the Factory pattern for flexible, type-safe test data creation.
 */

import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface UserData {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN' | 'INSTRUCTOR' | 'FREELANCER' | 'CLIENT';
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructorId: string;
  categoryId: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  price: number;
  currency: string;
  thumbnailUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface JobData {
  id: string;
  title: string;
  description: string;
  clientId: string;
  categoryId: string;
  budget: number;
  budgetType: 'FIXED' | 'HOURLY';
  duration: 'SHORT' | 'MEDIUM' | 'LONG' | 'ONGOING';
  experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  skills: string[];
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractData {
  id: string;
  jobId: string;
  freelancerId: string;
  clientId: string;
  amount: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Base Factory ====================

export abstract class Factory<T> {
  protected _overrides: Partial<T> = {};
  protected _traits: string[] = [];

  /**
   * Apply overrides to the generated data
   */
  with(overrides: Partial<T>): this {
    this._overrides = { ...this._overrides, ...overrides };
    return this;
  }

  /**
   * Apply a named trait
   */
  trait(...traits: string[]): this {
    this._traits.push(...traits);
    return this;
  }

  /**
   * Build a single instance
   */
  abstract build(): T;

  /**
   * Build multiple instances
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }

  /**
   * Reset overrides and traits
   */
  reset(): this {
    this._overrides = {};
    this._traits = [];
    return this;
  }
}

// ==================== User Factory ====================

export class UserFactory extends Factory<UserData> {
  private static readonly traits: Record<string, Partial<UserData>> = {
    admin: { role: 'ADMIN' },
    instructor: { role: 'INSTRUCTOR' },
    freelancer: { role: 'FREELANCER' },
    client: { role: 'CLIENT' },
    verified: { isVerified: true },
    unverified: { isVerified: false },
  };

  build(): UserData {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    let data: UserData = {
      id: uuidv4(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: bcrypt.hashSync('Password123!', 10),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      avatarUrl: faker.helpers.maybe(() => faker.image.avatar()) ?? null,
      role: 'USER',
      isVerified: false,
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: new Date(),
    };

    // Apply traits
    for (const trait of this._traits) {
      if (UserFactory.traits[trait]) {
        data = { ...data, ...UserFactory.traits[trait] };
      }
    }

    // Apply overrides
    data = { ...data, ...this._overrides };

    // Reset for next build
    this.reset();

    return data;
  }

  /**
   * Build with plain text password (for login tests)
   */
  withPlainPassword(password: string): this {
    this._overrides.password = bcrypt.hashSync(password, 10);
    (this as any)._plainPassword = password;
    return this;
  }
}

// ==================== Course Factory ====================

export class CourseFactory extends Factory<CourseData> {
  private static readonly traits: Record<string, Partial<CourseData>> = {
    published: { status: 'PUBLISHED' },
    draft: { status: 'DRAFT' },
    archived: { status: 'ARCHIVED' },
    beginner: { level: 'BEGINNER' },
    intermediate: { level: 'INTERMEDIATE' },
    advanced: { level: 'ADVANCED' },
    free: { price: 0 },
    premium: { price: 99.99 },
  };

  build(): CourseData {
    const title = faker.company.catchPhrase();

    let data: CourseData = {
      id: uuidv4(),
      title,
      slug: faker.helpers.slugify(title).toLowerCase(),
      description: faker.lorem.paragraphs(3),
      shortDescription: faker.lorem.sentence(),
      instructorId: uuidv4(),
      categoryId: uuidv4(),
      level: faker.helpers.arrayElement(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
      price: parseFloat(faker.commerce.price({ min: 9.99, max: 199.99 })),
      currency: 'USD',
      thumbnailUrl: faker.helpers.maybe(() => faker.image.url()) ?? null,
      status: 'DRAFT',
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: new Date(),
    };

    // Apply traits
    for (const trait of this._traits) {
      if (CourseFactory.traits[trait]) {
        data = { ...data, ...CourseFactory.traits[trait] };
      }
    }

    // Apply overrides
    data = { ...data, ...this._overrides };

    this.reset();

    return data;
  }
}

// ==================== Job Factory ====================

export class JobFactory extends Factory<JobData> {
  private static readonly traits: Record<string, Partial<JobData>> = {
    open: { status: 'OPEN' },
    inProgress: { status: 'IN_PROGRESS' },
    completed: { status: 'COMPLETED' },
    cancelled: { status: 'CANCELLED' },
    fixed: { budgetType: 'FIXED' },
    hourly: { budgetType: 'HOURLY' },
    entry: { experienceLevel: 'ENTRY' },
    expert: { experienceLevel: 'EXPERT' },
  };

  private static readonly skillSets: Record<string, string[]> = {
    frontend: ['React', 'TypeScript', 'CSS', 'HTML', 'Next.js'],
    backend: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'GraphQL'],
    mobile: ['React Native', 'Flutter', 'iOS', 'Android', 'Kotlin'],
    devops: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD'],
    design: ['Figma', 'UI/UX', 'Adobe XD', 'Photoshop', 'Sketch'],
  };

  build(): JobData {
    let data: JobData = {
      id: uuidv4(),
      title: faker.person.jobTitle(),
      description: faker.lorem.paragraphs(3),
      clientId: uuidv4(),
      categoryId: uuidv4(),
      budget: parseFloat(faker.commerce.price({ min: 100, max: 10000 })),
      budgetType: faker.helpers.arrayElement(['FIXED', 'HOURLY']),
      duration: faker.helpers.arrayElement(['SHORT', 'MEDIUM', 'LONG', 'ONGOING']),
      experienceLevel: faker.helpers.arrayElement(['ENTRY', 'INTERMEDIATE', 'EXPERT']),
      skills: faker.helpers.arrayElements(Object.values(JobFactory.skillSets).flat(), {
        min: 3,
        max: 8,
      }),
      status: 'OPEN',
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: new Date(),
    };

    // Apply traits
    for (const trait of this._traits) {
      if (JobFactory.traits[trait]) {
        data = { ...data, ...JobFactory.traits[trait] };
      }
      // Apply skill set traits
      if (JobFactory.skillSets[trait]) {
        data.skills = JobFactory.skillSets[trait];
      }
    }

    // Apply overrides
    data = { ...data, ...this._overrides };

    this.reset();

    return data;
  }
}

// ==================== Contract Factory ====================

export class ContractFactory extends Factory<ContractData> {
  private static readonly traits: Record<string, Partial<ContractData>> = {
    pending: { status: 'PENDING' },
    active: { status: 'ACTIVE' },
    completed: { status: 'COMPLETED' },
    disputed: { status: 'DISPUTED' },
    cancelled: { status: 'CANCELLED' },
  };

  build(): ContractData {
    const startDate = faker.date.past({ years: 1 });

    let data: ContractData = {
      id: uuidv4(),
      jobId: uuidv4(),
      freelancerId: uuidv4(),
      clientId: uuidv4(),
      amount: parseFloat(faker.commerce.price({ min: 100, max: 10000 })),
      status: 'PENDING',
      startDate,
      endDate:
        faker.helpers.maybe(() => faker.date.between({ from: startDate, to: new Date() })) ?? null,
      createdAt: startDate,
      updatedAt: new Date(),
    };

    // Apply traits
    for (const trait of this._traits) {
      if (ContractFactory.traits[trait]) {
        data = { ...data, ...ContractFactory.traits[trait] };
      }
    }

    // Apply overrides
    data = { ...data, ...this._overrides };

    this.reset();

    return data;
  }
}

// ==================== Factory Shortcuts ====================

/**
 * Create a new user factory
 */
export function userFactory() {
  return new UserFactory();
}

/**
 * Create a new course factory
 */
export function courseFactory() {
  return new CourseFactory();
}

/**
 * Create a new job factory
 */
export function jobFactory() {
  return new JobFactory();
}

/**
 * Create a new contract factory
 */
export function contractFactory() {
  return new ContractFactory();
}

// ==================== Seeder Utilities ====================

/**
 * Create a complete test scenario with related data
 */
export function createTestScenario() {
  const admin = userFactory().trait('admin', 'verified').build();
  const instructor = userFactory().trait('instructor', 'verified').build();
  const freelancer = userFactory().trait('freelancer', 'verified').build();
  const client = userFactory().trait('client', 'verified').build();

  const courses = courseFactory()
    .with({ instructorId: instructor.id })
    .trait('published')
    .buildMany(3);

  const jobs = jobFactory().with({ clientId: client.id }).trait('open').buildMany(5);

  const contracts = jobs.slice(0, 2).map((job) =>
    contractFactory()
      .with({
        jobId: job.id,
        freelancerId: freelancer.id,
        clientId: client.id,
      })
      .trait('active')
      .build()
  );

  return {
    users: { admin, instructor, freelancer, client },
    courses,
    jobs,
    contracts,
  };
}

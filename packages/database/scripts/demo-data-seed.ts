/**
 * Demo Environment Seed Data
 *
 * Seeds sample data for demo/staging environments.
 * DO NOT run in production!
 *
 * Includes:
 * - Sample freelancer profiles
 * - Sample client profiles
 * - Sample jobs
 * - Sample contracts
 * - Sample reviews
 * - Demo credentials
 *
 * @deprecated TODO: This seed file needs updates to match the current schema:
 * - User model uses firstName/lastName not 'name'
 * - Job skills should use relation syntax not string array
 * - JobDuration enum values may have changed
 * - JobStatus enum may have changed
 * - 'proposal' model doesn't exist (use 'bid')
 * - Contract model fields differ
 * - Review model fields differ
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Demo account credentials
const DEMO_ACCOUNTS = {
  freelancer: {
    email: 'demo-freelancer@skillancer.com',
    password: 'DemoFreelancer123!',
  },
  client: {
    email: 'demo-client@skillancer.com',
    password: 'DemoClient123!',
  },
  admin: {
    email: 'demo-admin@skillancer.com',
    password: 'DemoAdmin123!',
  },
};

async function main() {
  console.log('🎭 Starting demo data seed...\n');

  // Verify not production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot run demo seed in production!');
    process.exit(1);
  }

  // Seed demo accounts
  await seedDemoAccounts();

  // Seed sample freelancers
  const freelancerIds = await seedFreelancers(20);

  // Seed sample clients
  const clientIds = await seedClients(10);

  // Seed sample jobs
  const jobIds = await seedJobs(clientIds, 50);

  // Seed sample proposals
  await seedProposals(freelancerIds, jobIds, 100);

  // Seed sample contracts
  const contractIds = await seedContracts(freelancerIds, clientIds, jobIds, 30);

  // Seed sample reviews
  await seedReviews(contractIds);

  console.log('\n✅ Demo data seed completed!');
  console.log('\n📋 Demo Accounts:');
  console.log(`   Freelancer: ${DEMO_ACCOUNTS.freelancer.email}`);
  console.log(`   Client: ${DEMO_ACCOUNTS.client.email}`);
  console.log(`   Admin: ${DEMO_ACCOUNTS.admin.email}`);
  console.log(`   Password: Same as username prefix + "123!"`);
}

async function seedDemoAccounts() {
  console.log('👤 Creating demo accounts...');

  // Demo Freelancer
  const freelancerPassword = await hash(DEMO_ACCOUNTS.freelancer.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.freelancer.email },
    update: {},
    create: {
      id: 'user_demo_freelancer',
      email: DEMO_ACCOUNTS.freelancer.email,
      passwordHash: freelancerPassword,
      name: 'Demo Freelancer',
      role: 'FREELANCER',
      emailVerified: true,
      status: 'ACTIVE',
      profile: {
        create: {
          title: 'Senior Full-Stack Developer',
          bio: 'Experienced developer with 8+ years building web applications. Specialized in React, Node.js, and cloud architecture.',
          hourlyRate: 85,
          skills: ['react', 'nodejs', 'typescript', 'aws'],
          location: 'San Francisco, CA',
          timezone: 'America/Los_Angeles',
          availability: 'FULL_TIME',
          completeness: 100,
        },
      },
    },
  });

  // Demo Client
  const clientPassword = await hash(DEMO_ACCOUNTS.client.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.client.email },
    update: {},
    create: {
      id: 'user_demo_client',
      email: DEMO_ACCOUNTS.client.email,
      passwordHash: clientPassword,
      name: 'Demo Client',
      role: 'CLIENT',
      emailVerified: true,
      status: 'ACTIVE',
      company: {
        create: {
          name: 'Demo Company Inc.',
          description: 'A demo company for testing Skillancer features.',
          website: 'https://democompany.example.com',
          size: '11-50',
          industry: 'Technology',
        },
      },
    },
  });

  // Demo Admin
  const adminPassword = await hash(DEMO_ACCOUNTS.admin.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.admin.email },
    update: {},
    create: {
      id: 'user_demo_admin',
      email: DEMO_ACCOUNTS.admin.email,
      passwordHash: adminPassword,
      name: 'Demo Admin',
      role: 'ADMIN',
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log('   ✓ Created 3 demo accounts');
}

async function seedFreelancers(count: number): Promise<string[]> {
  console.log(`👨‍💻 Creating ${count} sample freelancers...`);

  const skills = [
    ['react', 'typescript', 'nodejs'],
    ['python', 'django', 'postgresql'],
    ['java', 'spring', 'aws'],
    ['flutter', 'dart', 'firebase'],
    ['figma', 'ui-design', 'ux-design'],
    ['go', 'kubernetes', 'docker'],
    ['ruby', 'rails', 'postgresql'],
    ['vue', 'nuxt', 'tailwindcss'],
    ['swift', 'ios', 'objective-c'],
    ['solidity', 'web3', 'ethereum'],
  ];

  const titles = [
    'Senior Frontend Developer',
    'Full-Stack Engineer',
    'Backend Developer',
    'Mobile App Developer',
    'UI/UX Designer',
    'DevOps Engineer',
    'Data Scientist',
    'Cloud Architect',
    'Blockchain Developer',
    'Product Designer',
  ];

  const ids: string[] = [];
  const passwordHash = await hash('Password123!', 12);

  for (let i = 0; i < count; i++) {
    const id = `user_freelancer_${i + 1}`;
    ids.push(id);

    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: faker.internet.email().toLowerCase(),
        passwordHash,
        name: faker.person.fullName(),
        role: 'FREELANCER',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: faker.date.past({ years: 2 }),
        profile: {
          create: {
            title: titles[i % titles.length],
            bio: faker.lorem.paragraphs(2),
            hourlyRate: faker.number.int({ min: 30, max: 200 }),
            skills: skills[i % skills.length],
            location: `${faker.location.city()}, ${faker.location.country()}`,
            timezone: faker.location.timeZone(),
            availability: faker.helpers.arrayElement(['FULL_TIME', 'PART_TIME', 'HOURLY']),
            completeness: faker.number.int({ min: 70, max: 100 }),
            totalEarnings: faker.number.int({ min: 0, max: 500000 }),
            jobSuccessScore: faker.number.int({ min: 80, max: 100 }),
          },
        },
      },
    });
  }

  console.log(`   ✓ Created ${count} freelancers`);
  return ids;
}

async function seedClients(count: number): Promise<string[]> {
  console.log(`🏢 Creating ${count} sample clients...`);

  const ids: string[] = [];
  const passwordHash = await hash('Password123!', 12);

  for (let i = 0; i < count; i++) {
    const id = `user_client_${i + 1}`;
    ids.push(id);

    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: faker.internet.email().toLowerCase(),
        passwordHash,
        name: faker.person.fullName(),
        role: 'CLIENT',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: faker.date.past({ years: 2 }),
        company: {
          create: {
            name: faker.company.name(),
            description: faker.company.catchPhrase(),
            website: faker.internet.url(),
            size: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '500+']),
            industry: faker.helpers.arrayElement([
              'Technology',
              'Finance',
              'Healthcare',
              'E-commerce',
              'Education',
              'Media',
            ]),
            totalSpent: faker.number.int({ min: 0, max: 1000000 }),
            paymentVerified: true,
          },
        },
      },
    });
  }

  console.log(`   ✓ Created ${count} clients`);
  return ids;
}

async function seedJobs(clientIds: string[], count: number): Promise<string[]> {
  console.log(`📋 Creating ${count} sample jobs...`);

  const categories = ['cat_web_dev', 'cat_mobile_dev', 'cat_backend', 'cat_devops', 'cat_design'];

  const jobTitles = [
    'Build a React Dashboard Application',
    'Develop Mobile App with Flutter',
    'Create REST API with Node.js',
    'Design UI/UX for SaaS Product',
    'Set up AWS Infrastructure',
    'Build E-commerce Website',
    'Develop iOS App',
    'Create Data Pipeline',
    'Design Mobile App Interface',
    'Implement Authentication System',
  ];

  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const id = `job_${i + 1}`;
    ids.push(id);

    const isFixed = faker.datatype.boolean();
    const status = faker.helpers.weightedArrayElement([
      { value: 'OPEN', weight: 50 },
      { value: 'IN_PROGRESS', weight: 30 },
      { value: 'COMPLETED', weight: 15 },
      { value: 'CLOSED', weight: 5 },
    ]);

    await prisma.job.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: jobTitles[i % jobTitles.length] + ` #${i + 1}`,
        description: faker.lorem.paragraphs(3),
        clientId: faker.helpers.arrayElement(clientIds),
        categoryId: faker.helpers.arrayElement(categories),
        budget: {
          type: isFixed ? 'FIXED' : 'HOURLY',
          amount: isFixed
            ? faker.number.int({ min: 500, max: 50000 })
            : faker.number.int({ min: 30, max: 150 }),
          currency: 'USD',
        },
        experienceLevel: faker.helpers.arrayElement(['ENTRY', 'INTERMEDIATE', 'EXPERT']),
        duration: faker.helpers.arrayElement([
          'LESS_THAN_WEEK',
          'LESS_THAN_MONTH',
          'ONE_TO_THREE_MONTHS',
          'THREE_TO_SIX_MONTHS',
          'MORE_THAN_SIX_MONTHS',
        ]),
        skills: faker.helpers.arrayElements(
          ['react', 'nodejs', 'python', 'aws', 'figma', 'typescript'],
          { min: 2, max: 5 }
        ),
        status,
        proposalsCount: faker.number.int({ min: 0, max: 50 }),
        createdAt: faker.date.past({ years: 1 }),
      },
    });
  }

  console.log(`   ✓ Created ${count} jobs`);
  return ids;
}

async function seedProposals(
  freelancerIds: string[],
  jobIds: string[],
  count: number
): Promise<void> {
  console.log(`📝 Creating ${count} sample proposals...`);

  for (let i = 0; i < count; i++) {
    const id = `proposal_${i + 1}`;

    await prisma.proposal.upsert({
      where: { id },
      update: {},
      create: {
        id,
        jobId: faker.helpers.arrayElement(jobIds),
        freelancerId: faker.helpers.arrayElement(freelancerIds),
        coverLetter: faker.lorem.paragraphs(2),
        bidAmount: faker.number.int({ min: 500, max: 10000 }),
        estimatedDuration: faker.helpers.arrayElement(['1 week', '2 weeks', '1 month', '2 months']),
        status: faker.helpers.weightedArrayElement([
          { value: 'PENDING', weight: 40 },
          { value: 'SHORTLISTED', weight: 20 },
          { value: 'ACCEPTED', weight: 15 },
          { value: 'REJECTED', weight: 20 },
          { value: 'WITHDRAWN', weight: 5 },
        ]),
        createdAt: faker.date.past({ years: 1 }),
      },
    });
  }

  console.log(`   ✓ Created ${count} proposals`);
}

async function seedContracts(
  freelancerIds: string[],
  clientIds: string[],
  jobIds: string[],
  count: number
): Promise<string[]> {
  console.log(`📄 Creating ${count} sample contracts...`);

  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const id = `contract_${i + 1}`;
    ids.push(id);

    const isFixed = faker.datatype.boolean();
    const totalAmount = faker.number.int({ min: 1000, max: 50000 });

    await prisma.contract.upsert({
      where: { id },
      update: {},
      create: {
        id,
        jobId: faker.helpers.arrayElement(jobIds),
        freelancerId: faker.helpers.arrayElement(freelancerIds),
        clientId: faker.helpers.arrayElement(clientIds),
        title: `Contract #${i + 1}`,
        type: isFixed ? 'FIXED' : 'HOURLY',
        budget: {
          total: totalAmount,
          funded: totalAmount * 0.3,
          released: totalAmount * 0.2,
          currency: 'USD',
        },
        status: faker.helpers.weightedArrayElement([
          { value: 'ACTIVE', weight: 40 },
          { value: 'PAUSED', weight: 10 },
          { value: 'COMPLETED', weight: 40 },
          { value: 'CANCELLED', weight: 10 },
        ]),
        startDate: faker.date.past({ years: 1 }),
        createdAt: faker.date.past({ years: 1 }),
      },
    });
  }

  console.log(`   ✓ Created ${count} contracts`);
  return ids;
}

async function seedReviews(contractIds: string[]): Promise<void> {
  console.log(`⭐ Creating reviews for contracts...`);

  let count = 0;

  for (const contractId of contractIds) {
    if (faker.datatype.boolean(0.7)) {
      // 70% have reviews
      const id = `review_${contractId}`;

      await prisma.review.upsert({
        where: { id },
        update: {},
        create: {
          id,
          contractId,
          rating: faker.number.int({ min: 3, max: 5 }),
          comment: faker.lorem.paragraph(),
          type: faker.helpers.arrayElement(['CLIENT_TO_FREELANCER', 'FREELANCER_TO_CLIENT']),
          createdAt: faker.date.past({ years: 1 }),
        },
      });
      count++;
    }
  }

  console.log(`   ✓ Created ${count} reviews`);
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Demo Environment Seed Data
 *
 * Seeds sample data for demo/staging environments.
 * DO NOT run in production!
 *
 * Includes:
 * - Sample user accounts (freelancers, clients, admin)
 * - Sample jobs
 * - Sample bids
 * - Sample contracts
 * - Sample reviews
 *
 * @module scripts/demo-data-seed
 */

import { PrismaClient, BidStatus, ContractStatus, JobStatus, ReviewType, ReviewStatus, BudgetType, ExperienceLevel, JobDuration } from '@prisma/client';
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
  const demoAccounts = await seedDemoAccounts();

  // Seed sample freelancers
  const freelancerIds = await seedFreelancers(20);
  freelancerIds.push(demoAccounts.freelancerId);

  // Seed sample clients
  const clientIds = await seedClients(10);
  clientIds.push(demoAccounts.clientId);

  // Seed sample jobs
  const jobIds = await seedJobs(clientIds, 50);

  // Seed sample bids
  await seedBids(freelancerIds, jobIds, 100);

  // Seed sample contracts
  const contractIds = await seedContracts(freelancerIds, clientIds, jobIds, 30);

  // Seed sample reviews
  await seedReviews(contractIds, freelancerIds, clientIds);

  console.log('\n✅ Demo data seed completed!');
  console.log('\n📋 Demo Accounts:');
  console.log(`   Freelancer: ${DEMO_ACCOUNTS.freelancer.email}`);
  console.log(`   Client: ${DEMO_ACCOUNTS.client.email}`);
  console.log(`   Admin: ${DEMO_ACCOUNTS.admin.email}`);
  console.log(`   Passwords: ${DEMO_ACCOUNTS.freelancer.password.slice(0, 4)}... (check code)`);
}

async function seedDemoAccounts(): Promise<{ freelancerId: string; clientId: string; adminId: string }> {
  console.log('👤 Creating demo accounts...');

  // Demo Freelancer
  const freelancerPassword = await hash(DEMO_ACCOUNTS.freelancer.password, 12);
  const freelancer = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.freelancer.email },
    update: {},
    create: {
      email: DEMO_ACCOUNTS.freelancer.email,
      passwordHash: freelancerPassword,
      firstName: 'Demo',
      lastName: 'Freelancer',
      displayName: 'Demo Freelancer',
      bio: 'Experienced developer with 8+ years building web applications. Specialized in React, Node.js, and cloud architecture.',
      status: 'ACTIVE',
      verificationLevel: 'EMAIL',
      timezone: 'America/Los_Angeles',
    },
  });

  // Demo Client
  const clientPassword = await hash(DEMO_ACCOUNTS.client.password, 12);
  const client = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.client.email },
    update: {},
    create: {
      email: DEMO_ACCOUNTS.client.email,
      passwordHash: clientPassword,
      firstName: 'Demo',
      lastName: 'Client',
      displayName: 'Demo Client',
      bio: 'Tech entrepreneur looking for talented developers.',
      status: 'ACTIVE',
      verificationLevel: 'EMAIL',
      timezone: 'America/New_York',
    },
  });

  // Demo Admin
  const adminPassword = await hash(DEMO_ACCOUNTS.admin.password, 12);
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.admin.email },
    update: {},
    create: {
      email: DEMO_ACCOUNTS.admin.email,
      passwordHash: adminPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      displayName: 'Demo Administrator',
      status: 'ACTIVE',
      verificationLevel: 'EMAIL',
    },
  });

  console.log('   ✓ Created demo accounts');

  return {
    freelancerId: freelancer.id,
    clientId: client.id,
    adminId: admin.id,
  };
}

async function seedFreelancers(count: number): Promise<string[]> {
  console.log(`👷 Creating ${count} sample freelancers...`);

  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName, provider: 'demo.skillancer.com' }).toLowerCase();
    const hashedPassword = await hash('Password123!', 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        bio: faker.lorem.paragraph(),
        status: 'ACTIVE',
        verificationLevel: 'EMAIL',
        timezone: faker.location.timeZone(),
      },
    });

    ids.push(user.id);
  }

  console.log(`   ✓ Created ${count} freelancers`);
  return ids;
}

async function seedClients(count: number): Promise<string[]> {
  console.log(`💼 Creating ${count} sample clients...`);

  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName, provider: 'democlient.skillancer.com' }).toLowerCase();
    const hashedPassword = await hash('Password123!', 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        bio: faker.company.catchPhrase(),
        status: 'ACTIVE',
        verificationLevel: 'EMAIL',
        timezone: faker.location.timeZone(),
      },
    });

    ids.push(user.id);
  }

  console.log(`   ✓ Created ${count} clients`);
  return ids;
}

async function seedJobs(clientIds: string[], count: number): Promise<string[]> {
  console.log(`📌 Creating ${count} sample jobs...`);

  const ids: string[] = [];
  const jobTitles = [
    'Full-Stack Web Application Development',
    'React Native Mobile App',
    'E-commerce Website Redesign',
    'API Integration Specialist',
    'Data Pipeline Development',
    'Machine Learning Model Development',
    'WordPress Website Development',
    'DevOps Infrastructure Setup',
    'UI/UX Design for SaaS Platform',
    'Node.js Backend Development',
    'Python Script Automation',
    'AWS Cloud Architecture',
    'Database Optimization Expert',
    'Flutter Mobile App Development',
    'Vue.js Frontend Development',
  ];

  const durations: JobDuration[] = [
    'LESS_THAN_WEEK',
    'ONE_TO_TWO_WEEKS',
    'TWO_TO_FOUR_WEEKS',
    'ONE_TO_THREE_MONTHS',
    'THREE_TO_SIX_MONTHS',
  ];

  const experienceLevels: ExperienceLevel[] = ['ENTRY', 'INTERMEDIATE', 'EXPERT'];

  for (let i = 0; i < count; i++) {
    const title = faker.helpers.arrayElement(jobTitles);
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${faker.string.alphanumeric(8)}`;
    const clientId = faker.helpers.arrayElement(clientIds);

    const job = await prisma.job.upsert({
      where: { slug },
      update: {},
      create: {
        clientId,
        title,
        slug,
        description: faker.lorem.paragraphs(3),
        status: faker.helpers.weightedArrayElement([
          { value: JobStatus.PUBLISHED, weight: 50 },
          { value: JobStatus.IN_PROGRESS, weight: 20 },
          { value: JobStatus.COMPLETED, weight: 20 },
          { value: JobStatus.DRAFT, weight: 10 },
        ]),
        budgetType: faker.datatype.boolean() ? BudgetType.FIXED : BudgetType.HOURLY,
        budgetMin: faker.number.int({ min: 500, max: 5000 }),
        budgetMax: faker.number.int({ min: 5000, max: 50000 }),
        currency: 'USD',
        duration: faker.helpers.arrayElement(durations),
        experienceLevel: faker.helpers.arrayElement(experienceLevels),
        isRemote: faker.datatype.boolean(0.8),
        publishedAt: faker.date.past({ years: 1 }),
        createdAt: faker.date.past({ years: 1 }),
      },
    });

    ids.push(job.id);
  }

  console.log(`   ✓ Created ${count} jobs`);
  return ids;
}

async function seedBids(
  freelancerIds: string[],
  jobIds: string[],
  count: number
): Promise<void> {
  console.log(`📝 Creating ${count} sample bids...`);

  const bidStatuses: BidStatus[] = [
    'PENDING',
    'SHORTLISTED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ];

  for (let i = 0; i < count; i++) {
    const jobId = faker.helpers.arrayElement(jobIds);
    const freelancerId = faker.helpers.arrayElement(freelancerIds);

    // Skip if bid already exists for this job/freelancer combo
    const existingBid = await prisma.bid.findFirst({
      where: { jobId, freelancerId },
    });

    if (existingBid) continue;

    await prisma.bid.create({
      data: {
        jobId,
        freelancerId,
        coverLetter: faker.lorem.paragraphs(2),
        proposedRate: faker.number.int({ min: 500, max: 10000 }),
        rateType: faker.datatype.boolean() ? BudgetType.FIXED : BudgetType.HOURLY,
        deliveryDays: faker.number.int({ min: 7, max: 90 }),
        status: faker.helpers.weightedArrayElement([
          { value: BidStatus.PENDING, weight: 40 },
          { value: BidStatus.SHORTLISTED, weight: 20 },
          { value: BidStatus.ACCEPTED, weight: 15 },
          { value: BidStatus.REJECTED, weight: 20 },
          { value: BidStatus.WITHDRAWN, weight: 5 },
        ]),
        qualityScore: faker.number.int({ min: 60, max: 100 }),
        submittedAt: faker.date.past({ years: 1 }),
      },
    });
  }

  console.log(`   ✓ Created bids`);
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
    const jobId = faker.helpers.arrayElement(jobIds);
    const freelancerId = faker.helpers.arrayElement(freelancerIds);
    const clientId = faker.helpers.arrayElement(clientIds);
    const isFixed = faker.datatype.boolean();
    const totalAmount = faker.number.int({ min: 1000, max: 50000 });

    const contract = await prisma.contract.create({
      data: {
        jobId,
        freelancerId,
        clientId,
        title: `Contract #${i + 1} - ${faker.company.catchPhrase()}`,
        description: faker.lorem.paragraphs(2),
        agreedRate: totalAmount,
        rateType: isFixed ? BudgetType.FIXED : BudgetType.HOURLY,
        currency: 'USD',
        totalAmount,
        status: faker.helpers.weightedArrayElement([
          { value: ContractStatus.ACTIVE, weight: 40 },
          { value: ContractStatus.PAUSED, weight: 10 },
          { value: ContractStatus.COMPLETED, weight: 40 },
          { value: ContractStatus.CANCELLED, weight: 10 },
        ]),
        startDate: faker.date.past({ years: 1 }),
        createdAt: faker.date.past({ years: 1 }),
      },
    });

    ids.push(contract.id);
  }

  console.log(`   ✓ Created ${count} contracts`);
  return ids;
}

async function seedReviews(
  contractIds: string[],
  freelancerIds: string[],
  clientIds: string[]
): Promise<void> {
  console.log(`⭐ Creating reviews for contracts...`);

  let count = 0;

  for (const contractId of contractIds) {
    if (faker.datatype.boolean(0.7)) {
      // 70% have reviews
      const reviewerId = faker.helpers.arrayElement(clientIds);
      const revieweeId = faker.helpers.arrayElement(freelancerIds);
      const isClientReview = faker.datatype.boolean();

      await prisma.review.create({
        data: {
          contractId,
          reviewerId: isClientReview ? reviewerId : revieweeId,
          revieweeId: isClientReview ? revieweeId : reviewerId,
          reviewType: isClientReview ? ReviewType.CLIENT_TO_FREELANCER : ReviewType.FREELANCER_TO_CLIENT,
          overallRating: faker.number.int({ min: 3, max: 5 }),
          categoryRatings: isClientReview
            ? {
                quality: faker.number.int({ min: 3, max: 5 }),
                communication: faker.number.int({ min: 3, max: 5 }),
                expertise: faker.number.int({ min: 3, max: 5 }),
                professionalism: faker.number.int({ min: 3, max: 5 }),
                wouldHireAgain: faker.datatype.boolean(0.8),
              }
            : {
                clarity: faker.number.int({ min: 3, max: 5 }),
                responsiveness: faker.number.int({ min: 3, max: 5 }),
                payment: faker.number.int({ min: 3, max: 5 }),
                professionalism: faker.number.int({ min: 3, max: 5 }),
                wouldWorkAgain: faker.datatype.boolean(0.8),
              },
          title: faker.lorem.sentence({ min: 3, max: 8 }),
          content: faker.lorem.paragraph(),
          status: ReviewStatus.REVEALED,
          isPublic: true,
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

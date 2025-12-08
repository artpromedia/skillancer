/**
 * @module @skillancer/database/seed
 * Database seed script for development and testing
 *
 * Run with: pnpm db:seed
 */

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed configuration
const SEED_CONFIG = {
  users: 10,
  tenants: 2,
  skills: 20,
  jobsPerUser: 2,
  bidsPerJob: 3,
  servicesPerFreelancer: 2,
  messagesPerConversation: 5,
};

// Helper to create deterministic seed
faker.seed(42);

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (in reverse order of dependencies)
  console.log('🗑️  Cleaning existing data...');
  await cleanDatabase();

  // Create skills
  console.log('📚 Creating skills...');
  const skills = await createSkills();

  // Create users
  console.log('👥 Creating users...');
  const users = await createUsers();

  // Create tenants and memberships
  console.log('🏢 Creating tenants...');
  const tenants = await createTenants(users);

  // Create jobs
  console.log('💼 Creating jobs...');
  const jobs = await createJobs(users, tenants, skills);

  // Create bids
  console.log('📝 Creating bids...');
  const bids = await createBids(jobs, users);

  // Create contracts from accepted bids
  console.log('📄 Creating contracts...');
  const contracts = await createContracts(bids);

  // Create services
  console.log('🛍️  Creating services...');
  await createServices(users, skills);

  // Create messages
  console.log('💬 Creating messages...');
  await createMessages(users, jobs, contracts);

  // Create reviews
  console.log('⭐ Creating reviews...');
  await createReviews(contracts);

  // Create trust scores
  console.log('📊 Creating trust scores...');
  await createTrustScores(users);

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Tenants: ${tenants.length}`);
  console.log(`   - Skills: ${skills.length}`);
  console.log(`   - Jobs: ${jobs.length}`);
  console.log(`   - Bids: ${bids.length}`);
  console.log(`   - Contracts: ${contracts.length}`);
}

async function cleanDatabase() {
  const tables = [
    'audit_logs',
    'notifications',
    'trust_scores',
    'reviews',
    'payments',
    'invoices',
    'payment_methods',
    'messages',
    'milestones',
    'contracts',
    'bids',
    'job_skills',
    'jobs',
    'service_skills',
    'services',
    'sessions',
    'portfolio_items',
    'user_skills',
    'tenant_members',
    'tenants',
    'refresh_tokens',
    'users',
    'skills',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
}

async function createSkills() {
  const skillCategories = {
    'Web Development': [
      'React',
      'Vue.js',
      'Angular',
      'Node.js',
      'TypeScript',
      'Next.js',
      'GraphQL',
    ],
    'Mobile Development': ['React Native', 'Flutter', 'Swift', 'Kotlin'],
    'Backend Development': ['Python', 'Go', 'Rust', 'Java', 'PostgreSQL'],
    Design: ['UI/UX Design', 'Figma', 'Adobe XD'],
    DevOps: ['Docker', 'Kubernetes', 'AWS', 'CI/CD'],
  };

  const skills = [];

  for (const [category, skillNames] of Object.entries(skillCategories)) {
    for (const name of skillNames) {
      const skill = await prisma.skill.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          category,
          description: faker.lorem.sentence(),
        },
      });
      skills.push(skill);
    }
  }

  return skills;
}

async function createUsers() {
  const users = [];

  // Create specific test users
  const testUsers = [
    {
      email: 'admin@skillancer.dev',
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin',
      status: 'ACTIVE' as const,
      verificationLevel: 'PREMIUM' as const,
    },
    {
      email: 'client@skillancer.dev',
      firstName: 'John',
      lastName: 'Client',
      displayName: 'John C.',
      status: 'ACTIVE' as const,
      verificationLevel: 'ENHANCED' as const,
    },
    {
      email: 'freelancer@skillancer.dev',
      firstName: 'Jane',
      lastName: 'Developer',
      displayName: 'Jane D.',
      status: 'ACTIVE' as const,
      verificationLevel: 'ENHANCED' as const,
    },
  ];

  for (const userData of testUsers) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash: '$2b$10$dummyhashforseeding', // Not a real hash
        avatarUrl: faker.image.avatar(),
        bio: faker.lorem.paragraph(),
        timezone: 'America/New_York',
      },
    });
    users.push(user);
  }

  // Create random users
  for (let i = 0; i < SEED_CONFIG.users - testUsers.length; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const user = await prisma.user.create({
      data: {
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        passwordHash: '$2b$10$dummyhashforseeding',
        firstName,
        lastName,
        displayName: `${firstName} ${lastName.charAt(0)}.`,
        avatarUrl: faker.image.avatar(),
        bio: faker.lorem.paragraph(),
        status: faker.helpers.arrayElement([
          'ACTIVE',
          'ACTIVE',
          'ACTIVE',
          'PENDING_VERIFICATION',
        ]),
        verificationLevel: faker.helpers.arrayElement([
          'NONE',
          'EMAIL',
          'BASIC',
          'ENHANCED',
        ]),
        timezone: faker.helpers.arrayElement([
          'America/New_York',
          'America/Los_Angeles',
          'Europe/London',
          'Asia/Tokyo',
        ]),
        lastLoginAt: faker.date.recent({ days: 30 }),
      },
    });
    users.push(user);
  }

  return users;
}

async function createTenants(users: { id: string }[]) {
  const tenants = [];

  const tenantData = [
    {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'Leading technology company',
      plan: 'PROFESSIONAL' as const,
    },
    {
      name: 'Startup Labs',
      slug: 'startup-labs',
      description: 'Innovation hub for startups',
      plan: 'STARTER' as const,
    },
  ];

  for (let i = 0; i < tenantData.length; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        ...tenantData[i],
        logoUrl: faker.image.urlLoremFlickr({ category: 'business' }),
        website: faker.internet.url(),
        settings: {
          allowPublicJobs: true,
          defaultCurrency: 'USD',
        },
      },
    });
    tenants.push(tenant);

    // Add members to tenant
    const memberCount = Math.min(3, users.length);
    for (let j = 0; j < memberCount; j++) {
      await prisma.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: users[(i * memberCount + j) % users.length]!.id,
          role: j === 0 ? 'OWNER' : j === 1 ? 'ADMIN' : 'MEMBER',
        },
      });
    }
  }

  return tenants;
}

async function createJobs(
  users: { id: string }[],
  tenants: { id: string }[],
  skills: { id: string }[]
) {
  const jobs = [];
  const clients = users.slice(0, Math.ceil(users.length / 2));

  for (const client of clients) {
    for (let i = 0; i < SEED_CONFIG.jobsPerUser; i++) {
      const title = faker.helpers.arrayElement([
        'Build a React Dashboard',
        'Mobile App Development',
        'API Integration Project',
        'Website Redesign',
        'E-commerce Platform',
        'Custom CRM Development',
        'Data Analytics Dashboard',
        'Cloud Migration Project',
      ]);

      const job = await prisma.job.create({
        data: {
          clientId: client.id,
          tenantId: faker.helpers.maybe(() => faker.helpers.arrayElement(tenants)?.id),
          title,
          slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${faker.string.nanoid(6)}`,
          description: faker.lorem.paragraphs(3),
          status: faker.helpers.arrayElement([
            'DRAFT',
            'PUBLISHED',
            'PUBLISHED',
            'PUBLISHED',
            'IN_PROGRESS',
            'COMPLETED',
          ]),
          visibility: faker.helpers.arrayElement(['PUBLIC', 'PUBLIC', 'PRIVATE']),
          budgetType: faker.helpers.arrayElement(['FIXED', 'HOURLY']),
          budgetMin: faker.number.int({ min: 500, max: 2000 }),
          budgetMax: faker.number.int({ min: 3000, max: 10000 }),
          currency: 'USD',
          duration: faker.helpers.arrayElement([
            'LESS_THAN_WEEK',
            'ONE_TO_TWO_WEEKS',
            'TWO_TO_FOUR_WEEKS',
            'ONE_TO_THREE_MONTHS',
          ]),
          experienceLevel: faker.helpers.arrayElement([
            'ENTRY',
            'INTERMEDIATE',
            'EXPERT',
          ]),
          isRemote: faker.datatype.boolean({ probability: 0.8 }),
          location: faker.helpers.maybe(() => faker.location.city()),
          tags: faker.helpers.arrayElements(
            ['urgent', 'long-term', 'startup', 'enterprise', 'remote'],
            { min: 1, max: 3 }
          ),
          publishedAt: faker.date.past({ years: 1 }),
        },
      });

      // Add skills to job
      const jobSkills = faker.helpers.arrayElements(skills, { min: 2, max: 5 });
      for (const skill of jobSkills) {
        await prisma.jobSkill.create({
          data: {
            jobId: job.id,
            skillId: skill.id,
            required: faker.datatype.boolean({ probability: 0.7 }),
          },
        });
      }

      jobs.push(job);
    }
  }

  return jobs;
}

async function createBids(jobs: { id: string; status: string }[], users: { id: string }[]) {
  const bids = [];
  const freelancers = users.slice(Math.ceil(users.length / 2));
  const publishedJobs = jobs.filter((j) => j.status === 'PUBLISHED' || j.status === 'IN_PROGRESS');

  for (const job of publishedJobs) {
    const bidders = faker.helpers.arrayElements(freelancers, {
      min: 1,
      max: SEED_CONFIG.bidsPerJob,
    });

    for (const freelancer of bidders) {
      const bid = await prisma.bid.create({
        data: {
          jobId: job.id,
          freelancerId: freelancer.id,
          status: faker.helpers.arrayElement([
            'PENDING',
            'PENDING',
            'SHORTLISTED',
            'ACCEPTED',
            'REJECTED',
          ]),
          coverLetter: faker.lorem.paragraphs(2),
          proposedRate: faker.number.int({ min: 1000, max: 8000 }),
          rateType: faker.helpers.arrayElement(['FIXED', 'HOURLY']),
          deliveryDays: faker.number.int({ min: 7, max: 60 }),
          attachments: [],
        },
      });
      bids.push(bid);
    }
  }

  return bids;
}

async function createContracts(bids: { id: string; jobId: string; freelancerId: string; status: string; proposedRate: any }[]) {
  const contracts = [];
  const acceptedBids = bids.filter((b) => b.status === 'ACCEPTED');

  for (const bid of acceptedBids) {
    // Get job to find client
    const job = await prisma.job.findUnique({
      where: { id: bid.jobId },
      select: { clientId: true, title: true },
    });

    if (!job) continue;

    const contract = await prisma.contract.create({
      data: {
        jobId: bid.jobId,
        bidId: bid.id,
        clientId: job.clientId,
        freelancerId: bid.freelancerId,
        status: faker.helpers.arrayElement([
          'PENDING',
          'ACTIVE',
          'ACTIVE',
          'COMPLETED',
        ]),
        title: job.title,
        description: faker.lorem.paragraphs(2),
        agreedRate: bid.proposedRate,
        rateType: 'FIXED',
        currency: 'USD',
        totalAmount: bid.proposedRate,
        startDate: faker.date.past({ years: 1 }),
        endDate: faker.date.future({ years: 1 }),
      },
    });

    // Create milestones
    const milestoneCount = faker.number.int({ min: 2, max: 4 });
    const milestoneAmount = Number(bid.proposedRate) / milestoneCount;

    for (let i = 0; i < milestoneCount; i++) {
      await prisma.milestone.create({
        data: {
          contractId: contract.id,
          title: `Milestone ${i + 1}: ${faker.lorem.words(3)}`,
          description: faker.lorem.sentence(),
          amount: milestoneAmount,
          status: faker.helpers.arrayElement([
            'PENDING',
            'IN_PROGRESS',
            'SUBMITTED',
            'APPROVED',
          ]),
          sortOrder: i,
          dueDate: faker.date.future({ years: 1 }),
        },
      });
    }

    contracts.push(contract);
  }

  return contracts;
}

async function createServices(users: { id: string }[], skills: { id: string }[]) {
  const freelancers = users.slice(Math.ceil(users.length / 2));

  for (const freelancer of freelancers) {
    for (let i = 0; i < SEED_CONFIG.servicesPerFreelancer; i++) {
      const title = faker.helpers.arrayElement([
        'Professional Web Development',
        'Mobile App Design & Development',
        'Full-Stack Development Services',
        'UI/UX Design Package',
        'API Development & Integration',
        'Cloud Architecture Consulting',
      ]);

      const service = await prisma.service.create({
        data: {
          freelancerId: freelancer.id,
          title,
          slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${faker.string.nanoid(6)}`,
          description: faker.lorem.paragraphs(3),
          status: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ACTIVE', 'ACTIVE']),
          category: faker.helpers.arrayElement([
            'Web Development',
            'Mobile Development',
            'Design',
            'Consulting',
          ]),
          tiers: [
            {
              name: 'Basic',
              price: faker.number.int({ min: 100, max: 500 }),
              deliveryDays: faker.number.int({ min: 3, max: 7 }),
              features: ['Basic features', 'Email support'],
            },
            {
              name: 'Standard',
              price: faker.number.int({ min: 500, max: 1500 }),
              deliveryDays: faker.number.int({ min: 7, max: 14 }),
              features: ['All Basic features', 'Priority support', 'Source code'],
            },
            {
              name: 'Premium',
              price: faker.number.int({ min: 1500, max: 5000 }),
              deliveryDays: faker.number.int({ min: 14, max: 30 }),
              features: [
                'All Standard features',
                '24/7 support',
                'Custom integrations',
              ],
            },
          ],
          tags: faker.helpers.arrayElements(
            ['featured', 'bestseller', 'new', 'trending'],
            { min: 0, max: 2 }
          ),
          images: [],
          faqs: [
            {
              question: 'What is included?',
              answer: faker.lorem.sentence(),
            },
            {
              question: 'What is the revision policy?',
              answer: faker.lorem.sentence(),
            },
          ],
          orderCount: faker.number.int({ min: 0, max: 100 }),
          rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 2 }),
          reviewCount: faker.number.int({ min: 0, max: 50 }),
          publishedAt: faker.date.past({ years: 1 }),
        },
      });

      // Add skills to service
      const serviceSkills = faker.helpers.arrayElements(skills, { min: 2, max: 4 });
      for (const skill of serviceSkills) {
        await prisma.serviceSkill.create({
          data: {
            serviceId: service.id,
            skillId: skill.id,
          },
        });
      }
    }
  }
}

async function createMessages(
  users: { id: string }[],
  jobs: { id: string }[],
  contracts: { id: string; clientId: string; freelancerId: string }[]
) {
  // Create messages for contracts
  for (const contract of contracts.slice(0, 5)) {
    for (let i = 0; i < SEED_CONFIG.messagesPerConversation; i++) {
      const isSenderClient = i % 2 === 0;
      await prisma.message.create({
        data: {
          senderId: isSenderClient ? contract.clientId : contract.freelancerId,
          receiverId: isSenderClient ? contract.freelancerId : contract.clientId,
          contractId: contract.id,
          content: faker.lorem.paragraph(),
          type: 'TEXT',
          readAt: faker.helpers.maybe(() => faker.date.recent({ days: 7 })),
        },
      });
    }
  }
}

async function createReviews(
  contracts: { id: string; clientId: string; freelancerId: string; status: string }[]
) {
  const completedContracts = contracts.filter((c) => c.status === 'COMPLETED');

  for (const contract of completedContracts) {
    // Client reviews freelancer
    await prisma.review.create({
      data: {
        reviewerId: contract.clientId,
        revieweeId: contract.freelancerId,
        contractId: contract.id,
        rating: faker.number.int({ min: 3, max: 5 }),
        title: faker.lorem.sentence(),
        comment: faker.lorem.paragraph(),
        communication: faker.number.int({ min: 3, max: 5 }),
        quality: faker.number.int({ min: 3, max: 5 }),
        expertise: faker.number.int({ min: 3, max: 5 }),
        professionalism: faker.number.int({ min: 3, max: 5 }),
        wouldRecommend: faker.datatype.boolean({ probability: 0.8 }),
        status: 'PUBLISHED',
      },
    });

    // Freelancer reviews client
    await prisma.review.create({
      data: {
        reviewerId: contract.freelancerId,
        revieweeId: contract.clientId,
        contractId: contract.id,
        rating: faker.number.int({ min: 3, max: 5 }),
        title: faker.lorem.sentence(),
        comment: faker.lorem.paragraph(),
        communication: faker.number.int({ min: 3, max: 5 }),
        professionalism: faker.number.int({ min: 3, max: 5 }),
        wouldRecommend: faker.datatype.boolean({ probability: 0.85 }),
        status: 'PUBLISHED',
      },
    });
  }
}

async function createTrustScores(users: { id: string }[]) {
  for (const user of users) {
    await prisma.trustScore.create({
      data: {
        userId: user.id,
        overallScore: faker.number.float({ min: 60, max: 100, fractionDigits: 2 }),
        completionRate: faker.number.float({ min: 70, max: 100, fractionDigits: 2 }),
        responseTime: faker.number.float({ min: 50, max: 100, fractionDigits: 2 }),
        qualityScore: faker.number.float({ min: 60, max: 100, fractionDigits: 2 }),
        communicationScore: faker.number.float({ min: 65, max: 100, fractionDigits: 2 }),
        totalJobs: faker.number.int({ min: 0, max: 50 }),
        completedJobs: faker.number.int({ min: 0, max: 40 }),
        totalEarnings: faker.number.int({ min: 0, max: 100000 }),
        repeatClients: faker.number.int({ min: 0, max: 10 }),
      },
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Production Seed Data
 *
 * Seeds essential production data required for platform operation.
 * This script should be run once during initial production setup.
 *
 * Includes:
 * - Skills by category
 * - Initial admin user
 * - Notification templates
 *
 * @module scripts/production-seed
 */

import { PrismaClient, NotificationCategory, NotificationPriority } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production seed...\n');

  // Seed skills
  await seedSkills();

  // Seed initial admin user
  await seedAdminUser();

  // Seed notification templates
  await seedNotificationTemplates();

  console.log('\n✅ Production seed completed successfully!');
}

/**
 * Seed skills with categories
 * Note: Skills have a 'category' string field, not a relation to SkillCategory
 */
async function seedSkills() {
  console.log('📚 Seeding skills...');

  const skillsByCategory: Record<
    string,
    Array<{ name: string; slug: string; description?: string }>
  > = {
    'Web Development': [
      { name: 'JavaScript', slug: 'javascript', description: 'Core web programming language' },
      { name: 'TypeScript', slug: 'typescript', description: 'Typed superset of JavaScript' },
      { name: 'React', slug: 'react', description: 'UI component library' },
      { name: 'Vue.js', slug: 'vuejs', description: 'Progressive JavaScript framework' },
      { name: 'Angular', slug: 'angular', description: 'Enterprise web framework' },
      { name: 'Next.js', slug: 'nextjs', description: 'React framework for production' },
      { name: 'Node.js', slug: 'nodejs', description: 'JavaScript runtime' },
      { name: 'Express.js', slug: 'expressjs', description: 'Node.js web framework' },
      { name: 'HTML/CSS', slug: 'html-css', description: 'Web markup and styling' },
      { name: 'Tailwind CSS', slug: 'tailwindcss', description: 'Utility-first CSS framework' },
    ],
    'Mobile Development': [
      {
        name: 'React Native',
        slug: 'react-native',
        description: 'Cross-platform mobile framework',
      },
      { name: 'Flutter', slug: 'flutter', description: 'Google UI toolkit for mobile' },
      { name: 'iOS/Swift', slug: 'ios-swift', description: 'Native iOS development' },
      { name: 'Android/Kotlin', slug: 'android-kotlin', description: 'Native Android development' },
      { name: 'Ionic', slug: 'ionic', description: 'Hybrid mobile framework' },
    ],
    'Backend Development': [
      { name: 'Python', slug: 'python', description: 'General-purpose programming language' },
      { name: 'Java', slug: 'java', description: 'Enterprise programming language' },
      { name: 'Go', slug: 'golang', description: 'Google systems language' },
      { name: 'Ruby', slug: 'ruby', description: 'Dynamic programming language' },
      { name: 'PHP', slug: 'php', description: 'Web scripting language' },
      { name: 'C#/.NET', slug: 'csharp-dotnet', description: 'Microsoft ecosystem' },
      { name: 'Rust', slug: 'rust', description: 'Systems programming language' },
    ],
    Database: [
      { name: 'PostgreSQL', slug: 'postgresql', description: 'Advanced open-source database' },
      { name: 'MySQL', slug: 'mysql', description: 'Popular relational database' },
      { name: 'MongoDB', slug: 'mongodb', description: 'Document database' },
      { name: 'Redis', slug: 'redis', description: 'In-memory data store' },
      { name: 'Elasticsearch', slug: 'elasticsearch', description: 'Search and analytics engine' },
    ],
    'Cloud & DevOps': [
      { name: 'AWS', slug: 'aws', description: 'Amazon Web Services' },
      { name: 'Google Cloud', slug: 'gcp', description: 'Google Cloud Platform' },
      { name: 'Azure', slug: 'azure', description: 'Microsoft Cloud' },
      { name: 'Docker', slug: 'docker', description: 'Container platform' },
      { name: 'Kubernetes', slug: 'kubernetes', description: 'Container orchestration' },
      { name: 'Terraform', slug: 'terraform', description: 'Infrastructure as Code' },
      { name: 'CI/CD', slug: 'ci-cd', description: 'Continuous Integration/Deployment' },
    ],
    Design: [
      { name: 'UI Design', slug: 'ui-design', description: 'User interface design' },
      { name: 'UX Design', slug: 'ux-design', description: 'User experience design' },
      { name: 'Figma', slug: 'figma', description: 'Design collaboration tool' },
      { name: 'Adobe XD', slug: 'adobe-xd', description: 'Adobe design tool' },
      { name: 'Sketch', slug: 'sketch', description: 'macOS design tool' },
      { name: 'Graphic Design', slug: 'graphic-design', description: 'Visual design' },
      { name: 'Brand Identity', slug: 'brand-identity', description: 'Brand design' },
    ],
    'Data & AI': [
      {
        name: 'Machine Learning',
        slug: 'machine-learning',
        description: 'ML algorithms and models',
      },
      { name: 'Data Science', slug: 'data-science', description: 'Data analysis and insights' },
      { name: 'Deep Learning', slug: 'deep-learning', description: 'Neural networks' },
      { name: 'NLP', slug: 'nlp', description: 'Natural language processing' },
      { name: 'Computer Vision', slug: 'computer-vision', description: 'Image and video analysis' },
      { name: 'Data Engineering', slug: 'data-engineering', description: 'Data pipelines' },
    ],
    Security: [
      { name: 'Penetration Testing', slug: 'penetration-testing', description: 'Security testing' },
      { name: 'Security Auditing', slug: 'security-auditing', description: 'Security assessment' },
      { name: 'Network Security', slug: 'network-security', description: 'Network protection' },
      {
        name: 'Cloud Security',
        slug: 'cloud-security',
        description: 'Cloud security architecture',
      },
      { name: 'OWASP', slug: 'owasp', description: 'Web application security' },
    ],
  };

  let totalSkills = 0;

  for (const [category, skills] of Object.entries(skillsByCategory)) {
    for (const skill of skills) {
      await prisma.skill.upsert({
        where: { slug: skill.slug },
        update: {
          name: skill.name,
          category,
          description: skill.description,
        },
        create: {
          name: skill.name,
          slug: skill.slug,
          category,
          description: skill.description,
          isCustom: false,
          isApproved: true,
        },
      });
      totalSkills++;
    }
  }

  console.log(
    `   ✓ Created ${totalSkills} skills in ${Object.keys(skillsByCategory).length} categories`
  );
}

/**
 * Seed initial admin user
 */
async function seedAdminUser() {
  console.log('👤 Seeding initial admin user...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@skillancer.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.log(
      '   ⚠️  ADMIN_PASSWORD environment variable not set. Skipping admin user creation.'
    );
    console.log('   ⚠️  Set ADMIN_PASSWORD to create the initial admin user.');
    return;
  }

  const hashedPassword = await hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      status: 'ACTIVE',
      verificationLevel: 'EMAIL',
    },
  });

  console.log(`   ✓ Created admin user: ${adminEmail}`);
  console.log(`   ⚠️  Remember to enable MFA for the admin account!`);

  return adminUser;
}

/**
 * Seed notification templates
 */
async function seedNotificationTemplates() {
  console.log('📧 Seeding notification templates...');

  const templates = [
    {
      type: 'welcome',
      name: 'Welcome Email',
      category: NotificationCategory.SYSTEM,
      inAppTitle: 'Welcome to Skillancer!',
      inAppBody:
        'We are excited to have you join our community. Complete your profile to get started.',
      emailSubject: 'Welcome to Skillancer!',
      emailHtmlTemplate: `
        <h1>Welcome to Skillancer, {{firstName}}!</h1>
        <p>We're excited to have you join our community of talented professionals.</p>
        <p>Get started by completing your profile and exploring opportunities.</p>
        <a href="{{dashboardUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
      `,
      emailTextTemplate: `
Welcome to Skillancer, {{firstName}}!

We're excited to have you join our community.

Get started: {{dashboardUrl}}
      `,
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: ['EMAIL', 'IN_APP'],
    },
    {
      type: 'email_verification',
      name: 'Email Verification',
      category: NotificationCategory.SECURITY,
      inAppTitle: 'Verify Your Email',
      inAppBody: 'Please check your email to verify your account.',
      emailSubject: 'Verify your email address',
      emailHtmlTemplate: `
        <h1>Verify Your Email</h1>
        <p>Hi {{firstName}}, please click below to verify your email:</p>
        <a href="{{verificationUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
      emailTextTemplate: `
Verify your email: {{verificationUrl}}
This link expires in 24 hours.
      `,
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: ['EMAIL'],
    },
    {
      type: 'password_reset',
      name: 'Password Reset',
      category: NotificationCategory.SECURITY,
      inAppTitle: 'Password Reset Requested',
      inAppBody: 'A password reset was requested for your account.',
      emailSubject: 'Reset your password',
      emailHtmlTemplate: `
        <h1>Password Reset</h1>
        <p>Hi {{firstName}}, click below to reset your password:</p>
        <a href="{{resetUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `,
      emailTextTemplate: `
Reset your password: {{resetUrl}}
This link expires in 1 hour.
      `,
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: ['EMAIL'],
    },
    {
      type: 'proposal_received',
      name: 'Proposal Received',
      category: NotificationCategory.JOB,
      inAppTitle: 'New Proposal Received',
      inAppBody: '{{freelancerName}} submitted a proposal for "{{jobTitle}}"',
      emailSubject: 'New proposal on your job: {{jobTitle}}',
      emailHtmlTemplate: `
        <h1>New Proposal Received</h1>
        <p>{{freelancerName}} submitted a proposal for "{{jobTitle}}"</p>
        <p><strong>Bid:</strong> {{bidAmount}}</p>
        <a href="{{proposalUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Proposal</a>
      `,
      emailTextTemplate: `
New proposal from {{freelancerName}} for "{{jobTitle}}"
Bid: {{bidAmount}}
View: {{proposalUrl}}
      `,
      defaultPriority: NotificationPriority.NORMAL,
      defaultChannels: ['EMAIL', 'IN_APP', 'PUSH'],
    },
    {
      type: 'contract_started',
      name: 'Contract Started',
      category: NotificationCategory.CONTRACT,
      inAppTitle: 'Contract Started',
      inAppBody: 'Your contract for "{{jobTitle}}" has begun.',
      emailSubject: 'Contract started: {{jobTitle}}',
      emailHtmlTemplate: `
        <h1>Contract Started!</h1>
        <p>Your contract for "{{jobTitle}}" has begun.</p>
        <p><strong>Client:</strong> {{clientName}}</p>
        <p><strong>Freelancer:</strong> {{freelancerName}}</p>
        <a href="{{contractUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Contract</a>
      `,
      emailTextTemplate: `
Contract started for "{{jobTitle}}"
View: {{contractUrl}}
      `,
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: ['EMAIL', 'IN_APP', 'PUSH'],
    },
    {
      type: 'payment_received',
      name: 'Payment Received',
      category: NotificationCategory.PAYMENT,
      inAppTitle: 'Payment Received',
      inAppBody: 'You received {{amount}} for "{{jobTitle}}"',
      emailSubject: 'Payment received: {{amount}}',
      emailHtmlTemplate: `
        <h1>Payment Received!</h1>
        <p>You received <strong>{{amount}}</strong> for "{{jobTitle}}"</p>
        <p><strong>After fees:</strong> {{netAmount}}</p>
        <a href="{{paymentsUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Payments</a>
      `,
      emailTextTemplate: `
Payment received: {{amount}}
After fees: {{netAmount}}
View: {{paymentsUrl}}
      `,
      defaultPriority: NotificationPriority.HIGH,
      defaultChannels: ['EMAIL', 'IN_APP', 'PUSH'],
    },
    {
      type: 'message_received',
      name: 'Message Received',
      category: NotificationCategory.MESSAGE,
      inAppTitle: 'New Message',
      inAppBody: '{{senderName}} sent you a message',
      emailSubject: 'New message from {{senderName}}',
      emailHtmlTemplate: `
        <h1>New Message</h1>
        <p>{{senderName}} sent you a message:</p>
        <blockquote style="border-left: 4px solid #E5E7EB; padding-left: 16px; margin: 16px 0;">{{messagePreview}}</blockquote>
        <a href="{{conversationUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Conversation</a>
      `,
      emailTextTemplate: `
New message from {{senderName}}:
"{{messagePreview}}"

View: {{conversationUrl}}
      `,
      defaultPriority: NotificationPriority.NORMAL,
      defaultChannels: ['EMAIL', 'IN_APP', 'PUSH'],
    },
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type: template.type },
      update: template,
      create: template,
    });
  }

  console.log(`   ✓ Created ${templates.length} notification templates`);
}

main()
  .catch((e) => {
    console.error('❌ Production seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Production Seed Data
 *
 * Seeds essential production data required for platform operation.
 * This script should be run once during initial production setup.
 *
 * Includes:
 * - Skill categories and skills
 * - Default security policies
 * - System configuration
 * - Initial admin user
 * - Email templates
 * - Default invoice templates
 *
 * @deprecated TODO: This seed file needs updates to match the current schema:
 * - SkillpodPolicy model doesn't exist (use different policy model)
 * - SystemConfig model doesn't exist (need to create or use alternative)
 * - EmailTemplate model doesn't exist (need to create or use alternative)
 * - Skill model uses 'category' field not 'categoryId'
 * - User model uses firstName/lastName not 'name', has different status/role enums
 * - InvoiceTemplate requires freelancerUserId relation
 * - See demo-data-seed.ts for a working example
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production seed...\n');

  // Seed skill categories and skills
  await seedSkillCategories();

  // Seed security policies
  await seedSecurityPolicies();

  // Seed system configuration
  await seedSystemConfig();

  // Seed initial admin user
  await seedAdminUser();

  // Seed email templates
  await seedEmailTemplates();

  // Seed invoice templates
  await seedInvoiceTemplates();

  console.log('\n✅ Production seed completed successfully!');
}

async function seedSkillCategories() {
  console.log('📚 Seeding skill categories...');

  const categories = [
    {
      id: 'cat_web_dev',
      name: 'Web Development',
      slug: 'web-development',
      icon: 'globe',
      skills: [
        { name: 'JavaScript', slug: 'javascript' },
        { name: 'TypeScript', slug: 'typescript' },
        { name: 'React', slug: 'react' },
        { name: 'Vue.js', slug: 'vuejs' },
        { name: 'Angular', slug: 'angular' },
        { name: 'Next.js', slug: 'nextjs' },
        { name: 'Node.js', slug: 'nodejs' },
        { name: 'Express.js', slug: 'expressjs' },
        { name: 'HTML/CSS', slug: 'html-css' },
        { name: 'Tailwind CSS', slug: 'tailwindcss' },
      ],
    },
    {
      id: 'cat_mobile_dev',
      name: 'Mobile Development',
      slug: 'mobile-development',
      icon: 'smartphone',
      skills: [
        { name: 'React Native', slug: 'react-native' },
        { name: 'Flutter', slug: 'flutter' },
        { name: 'iOS/Swift', slug: 'ios-swift' },
        { name: 'Android/Kotlin', slug: 'android-kotlin' },
        { name: 'Ionic', slug: 'ionic' },
      ],
    },
    {
      id: 'cat_backend',
      name: 'Backend Development',
      slug: 'backend-development',
      icon: 'server',
      skills: [
        { name: 'Python', slug: 'python' },
        { name: 'Java', slug: 'java' },
        { name: 'Go', slug: 'golang' },
        { name: 'Ruby', slug: 'ruby' },
        { name: 'PHP', slug: 'php' },
        { name: 'C#/.NET', slug: 'csharp-dotnet' },
        { name: 'Rust', slug: 'rust' },
      ],
    },
    {
      id: 'cat_devops',
      name: 'DevOps & Cloud',
      slug: 'devops-cloud',
      icon: 'cloud',
      skills: [
        { name: 'AWS', slug: 'aws' },
        { name: 'Google Cloud', slug: 'gcp' },
        { name: 'Azure', slug: 'azure' },
        { name: 'Docker', slug: 'docker' },
        { name: 'Kubernetes', slug: 'kubernetes' },
        { name: 'Terraform', slug: 'terraform' },
        { name: 'CI/CD', slug: 'ci-cd' },
        { name: 'Linux', slug: 'linux' },
      ],
    },
    {
      id: 'cat_data',
      name: 'Data Science & ML',
      slug: 'data-science',
      icon: 'bar-chart',
      skills: [
        { name: 'Machine Learning', slug: 'machine-learning' },
        { name: 'Deep Learning', slug: 'deep-learning' },
        { name: 'Data Analysis', slug: 'data-analysis' },
        { name: 'SQL', slug: 'sql' },
        { name: 'TensorFlow', slug: 'tensorflow' },
        { name: 'PyTorch', slug: 'pytorch' },
        { name: 'Pandas', slug: 'pandas' },
      ],
    },
    {
      id: 'cat_design',
      name: 'Design',
      slug: 'design',
      icon: 'palette',
      skills: [
        { name: 'UI Design', slug: 'ui-design' },
        { name: 'UX Design', slug: 'ux-design' },
        { name: 'Figma', slug: 'figma' },
        { name: 'Adobe XD', slug: 'adobe-xd' },
        { name: 'Sketch', slug: 'sketch' },
        { name: 'Graphic Design', slug: 'graphic-design' },
        { name: 'Motion Graphics', slug: 'motion-graphics' },
      ],
    },
    {
      id: 'cat_blockchain',
      name: 'Blockchain',
      slug: 'blockchain',
      icon: 'link',
      skills: [
        { name: 'Solidity', slug: 'solidity' },
        { name: 'Web3.js', slug: 'web3js' },
        { name: 'Smart Contracts', slug: 'smart-contracts' },
        { name: 'DeFi', slug: 'defi' },
        { name: 'NFT Development', slug: 'nft-development' },
      ],
    },
    {
      id: 'cat_security',
      name: 'Cybersecurity',
      slug: 'cybersecurity',
      icon: 'shield',
      skills: [
        { name: 'Penetration Testing', slug: 'penetration-testing' },
        { name: 'Security Auditing', slug: 'security-auditing' },
        { name: 'Network Security', slug: 'network-security' },
        { name: 'Cloud Security', slug: 'cloud-security' },
        { name: 'OWASP', slug: 'owasp' },
      ],
    },
  ];

  for (const category of categories) {
    const { skills, ...categoryData } = category;

    await prisma.skillCategory.upsert({
      where: { id: category.id },
      update: categoryData,
      create: categoryData,
    });

    for (const skill of skills) {
      await prisma.skill.upsert({
        where: { slug: skill.slug },
        update: { ...skill, categoryId: category.id },
        create: {
          id: `skill_${skill.slug.replace(/-/g, '_')}`,
          ...skill,
          categoryId: category.id,
        },
      });
    }
  }

  console.log(`   ✓ Created ${categories.length} categories with skills`);
}

async function seedSecurityPolicies() {
  console.log('🔒 Seeding security policies...');

  const policies = [
    {
      id: 'policy_standard',
      name: 'Standard',
      level: 1,
      description: 'Basic monitoring, suitable for general work',
      config: {
        recording: true,
        clipboardAccess: true,
        internetAccess: true,
        fileDownload: true,
        sessionTimeout: 480, // 8 hours
        idleTimeout: 30, // 30 minutes
      },
    },
    {
      id: 'policy_enhanced',
      name: 'Enhanced',
      level: 2,
      description: 'Full recording with limited internet access',
      config: {
        recording: true,
        clipboardAccess: true,
        clipboardLogging: true,
        internetAccess: 'whitelist',
        fileDownload: 'approval',
        sessionTimeout: 480,
        idleTimeout: 15,
      },
    },
    {
      id: 'policy_strict',
      name: 'Strict',
      level: 3,
      description: 'No internet, no clipboard, watermarked screen',
      config: {
        recording: true,
        clipboardAccess: false,
        internetAccess: false,
        fileDownload: false,
        screenWatermark: true,
        sessionTimeout: 240, // 4 hours
        idleTimeout: 10,
      },
    },
    {
      id: 'policy_maximum',
      name: 'Maximum Security',
      level: 4,
      description: 'All restrictions plus keystroke logging',
      config: {
        recording: true,
        keystrokeLogging: true,
        clipboardAccess: false,
        internetAccess: false,
        fileDownload: false,
        screenWatermark: true,
        screenshotBlocking: true,
        sessionTimeout: 120, // 2 hours
        idleTimeout: 5,
        managerApproval: true,
      },
    },
  ];

  for (const policy of policies) {
    await prisma.skillpodPolicy.upsert({
      where: { id: policy.id },
      update: policy,
      create: policy,
    });
  }

  console.log(`   ✓ Created ${policies.length} security policies`);
}

async function seedSystemConfig() {
  console.log('⚙️ Seeding system configuration...');

  const configs = [
    // Platform settings
    { key: 'platform.name', value: 'Skillancer', category: 'platform' },
    { key: 'platform.url', value: 'https://skillancer.com', category: 'platform' },
    { key: 'platform.supportEmail', value: 'support@skillancer.com', category: 'platform' },
    { key: 'platform.maintenanceMode', value: 'false', category: 'platform' },

    // Fee configuration
    { key: 'fees.freelancer.tier1', value: '0.20', category: 'fees' }, // 20% for first $500
    { key: 'fees.freelancer.tier2', value: '0.10', category: 'fees' }, // 10% $500-$10k
    { key: 'fees.freelancer.tier3', value: '0.05', category: 'fees' }, // 5% over $10k
    { key: 'fees.client', value: '0.03', category: 'fees' }, // 3% client fee

    // Payment settings
    { key: 'payment.minWithdrawal', value: '100', category: 'payment' },
    { key: 'payment.fixedReleaseDelay', value: '5', category: 'payment' }, // days
    { key: 'payment.hourlyReleaseDelay', value: '10', category: 'payment' }, // days

    // Proposal settings
    { key: 'proposal.connectsCost.low', value: '2', category: 'proposal' }, // Under $500
    { key: 'proposal.connectsCost.medium', value: '4', category: 'proposal' }, // $500-$1000
    { key: 'proposal.connectsCost.high', value: '6', category: 'proposal' }, // Over $1000
    { key: 'proposal.freeConnectsMonthly', value: '60', category: 'proposal' },

    // Session settings
    { key: 'session.timeout', value: '1800', category: 'session' }, // 30 minutes
    { key: 'session.absoluteTimeout', value: '86400', category: 'session' }, // 24 hours
    { key: 'session.maxConcurrent', value: '5', category: 'session' },

    // Security settings
    { key: 'security.maxLoginAttempts', value: '5', category: 'security' },
    { key: 'security.lockoutDuration', value: '900', category: 'security' }, // 15 minutes
    { key: 'security.passwordMinLength', value: '12', category: 'security' },
    { key: 'security.mfaRequired.admin', value: 'true', category: 'security' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    });
  }

  console.log(`   ✓ Created ${configs.length} configuration entries`);
}

async function seedAdminUser() {
  console.log('👤 Seeding initial admin user...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@skillancer.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';

  const hashedPassword = await hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: 'user_admin_initial',
      email: adminEmail,
      passwordHash: hashedPassword,
      name: 'System Administrator',
      role: 'ADMIN',
      emailVerified: true,
      mfaEnabled: false, // Should enable after first login
      status: 'ACTIVE',
    },
  });

  console.log(`   ✓ Created admin user: ${adminEmail}`);
  console.log('   ⚠️  Remember to change the default password and enable MFA!');
}

async function seedEmailTemplates() {
  console.log('📧 Seeding email templates...');

  const templates = [
    {
      id: 'email_welcome',
      name: 'Welcome Email',
      subject: 'Welcome to Skillancer!',
      htmlTemplate: `
        <h1>Welcome to Skillancer, {{name}}!</h1>
        <p>We're excited to have you join our community of talented professionals.</p>
        <p>Get started by completing your profile and exploring opportunities.</p>
        <a href="{{dashboardUrl}}">Go to Dashboard</a>
      `,
      textTemplate: `
Welcome to Skillancer, {{name}}!

We're excited to have you join our community.

Get started: {{dashboardUrl}}
      `,
    },
    {
      id: 'email_verify',
      name: 'Email Verification',
      subject: 'Verify your email address',
      htmlTemplate: `
        <h1>Verify Your Email</h1>
        <p>Hi {{name}}, please click below to verify your email:</p>
        <a href="{{verificationUrl}}">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
      textTemplate: `
Verify your email: {{verificationUrl}}
This link expires in 24 hours.
      `,
    },
    {
      id: 'email_password_reset',
      name: 'Password Reset',
      subject: 'Reset your password',
      htmlTemplate: `
        <h1>Password Reset</h1>
        <p>Hi {{name}}, click below to reset your password:</p>
        <a href="{{resetUrl}}">Reset Password</a>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `,
      textTemplate: `
Reset your password: {{resetUrl}}
This link expires in 1 hour.
      `,
    },
    {
      id: 'email_proposal_received',
      name: 'Proposal Received',
      subject: 'New proposal on your job: {{jobTitle}}',
      htmlTemplate: `
        <h1>New Proposal Received</h1>
        <p>{{freelancerName}} submitted a proposal for "{{jobTitle}}"</p>
        <p>Bid: {{bidAmount}}</p>
        <a href="{{proposalUrl}}">View Proposal</a>
      `,
      textTemplate: `
New proposal from {{freelancerName}} for "{{jobTitle}}"
Bid: {{bidAmount}}
View: {{proposalUrl}}
      `,
    },
    {
      id: 'email_contract_started',
      name: 'Contract Started',
      subject: 'Contract started: {{jobTitle}}',
      htmlTemplate: `
        <h1>Contract Started!</h1>
        <p>Your contract for "{{jobTitle}}" has begun.</p>
        <p>Client: {{clientName}}</p>
        <p>Freelancer: {{freelancerName}}</p>
        <a href="{{contractUrl}}">View Contract</a>
      `,
      textTemplate: `
Contract started for "{{jobTitle}}"
View: {{contractUrl}}
      `,
    },
    {
      id: 'email_payment_received',
      name: 'Payment Received',
      subject: 'Payment received: {{amount}}',
      htmlTemplate: `
        <h1>Payment Received!</h1>
        <p>You received {{amount}} for "{{jobTitle}}"</p>
        <p>After fees: {{netAmount}}</p>
        <a href="{{paymentsUrl}}">View Payments</a>
      `,
      textTemplate: `
Payment received: {{amount}}
After fees: {{netAmount}}
View: {{paymentsUrl}}
      `,
    },
  ];

  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { id: template.id },
      update: template,
      create: template,
    });
  }

  console.log(`   ✓ Created ${templates.length} email templates`);
}

async function seedInvoiceTemplates() {
  console.log('📄 Seeding invoice templates...');

  const templates = [
    {
      id: 'invoice_default',
      name: 'Default Invoice',
      isDefault: true,
      config: {
        showLogo: true,
        showCompanyAddress: true,
        showClientAddress: true,
        showTaxId: true,
        columns: ['description', 'quantity', 'rate', 'amount'],
        showSubtotal: true,
        showTax: true,
        showTotal: true,
        footerText: 'Thank you for your business!\n\nPayment is due within 14 days.',
        accentColor: '#3B82F6',
      },
    },
    {
      id: 'invoice_minimal',
      name: 'Minimal Invoice',
      isDefault: false,
      config: {
        showLogo: false,
        showCompanyAddress: false,
        showClientAddress: true,
        showTaxId: false,
        columns: ['description', 'amount'],
        showSubtotal: false,
        showTax: false,
        showTotal: true,
        footerText: '',
        accentColor: '#000000',
      },
    },
    {
      id: 'invoice_detailed',
      name: 'Detailed Invoice',
      isDefault: false,
      config: {
        showLogo: true,
        showCompanyAddress: true,
        showClientAddress: true,
        showTaxId: true,
        columns: ['date', 'description', 'hours', 'rate', 'amount'],
        showSubtotal: true,
        showTax: true,
        showDiscount: true,
        showTotal: true,
        showNotes: true,
        showPaymentTerms: true,
        footerText:
          'Thank you for choosing Skillancer!\n\nQuestions? Contact billing@skillancer.com',
        accentColor: '#10B981',
      },
    },
  ];

  for (const template of templates) {
    await prisma.invoiceTemplate.upsert({
      where: { id: template.id },
      update: template,
      create: template,
    });
  }

  console.log(`   ✓ Created ${templates.length} invoice templates`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

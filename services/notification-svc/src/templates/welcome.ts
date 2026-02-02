/**
 * Welcome Email Template
 *
 * Sent to new users after registration
 */

import {
  wrapEmailContent,
  htmlToPlainText,
  commonStyles,
  styleToString,
  createButton,
  BRAND_COLORS,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  accountType: 'freelancer' | 'client' | 'agency';
  verificationUrl?: string;
  dashboardUrl?: string;
  profileUrl?: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

export function generateWelcomeEmail(data: WelcomeEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    userName,
    accountType,
    verificationUrl,
    dashboardUrl = 'https://skillancer.com/dashboard',
    profileUrl = 'https://skillancer.com/profile',
    unsubscribeUrl,
  } = data;

  const isFreelancer = accountType === 'freelancer';
  const isClient = accountType === 'client';

  // Personalized welcome message based on account type
  const getWelcomeMessage = (): string => {
    if (isFreelancer) {
      return "Welcome to the world's premier talent marketplace! You're now part of an exclusive community of skilled professionals.";
    }
    if (isClient) {
      return "Welcome to Skillancer! You're now ready to connect with top-tier talent from around the world.";
    }
    return 'Welcome to Skillancer! Your agency account is ready to manage projects and team collaboration.';
  };
  const welcomeMessage = getWelcomeMessage();

  // Next steps based on account type
  const getNextSteps = (): string => {
    if (isFreelancer) {
      return `
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Complete your profile</strong> - Add your skills, portfolio, and experience to stand out
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Set your rates</strong> - Define your hourly or project-based pricing
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Get verified</strong> - Complete identity and skill verification for a trust badge
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Browse jobs</strong> - Find opportunities that match your expertise
      </li>
    `;
    }
    if (isClient) {
      return `
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Post your first job</strong> - Describe your project and requirements
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Browse talent</strong> - Explore our verified freelancer directory
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Set up payments</strong> - Add a payment method for seamless transactions
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Invite your team</strong> - Collaborate with colleagues on hiring
      </li>
    `;
    }
    return `
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Set up your agency</strong> - Add your branding and team members
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Invite freelancers</strong> - Build your talent roster
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Create SkillPods</strong> - Organize teams for different clients
      </li>
      <li style="${styleToString(commonStyles.paragraph)}">
        <strong>Set commission rates</strong> - Configure your fee structure
      </li>
    `;
  };
  const nextSteps = getNextSteps();

  // Pro tip based on account type
  const getProTip = (): string => {
    if (isFreelancer) {
      return 'Freelancers with complete profiles receive 3x more job invitations. Take 10 minutes to fill out your profile today!';
    }
    if (isClient) {
      return 'Post detailed job descriptions with clear requirements to attract the best talent. Quality descriptions receive better proposals.';
    }
    return 'Verified agencies get featured in our directory. Complete your agency verification to boost visibility.';
  };
  const proTip = getProTip();

  const ctaButton = verificationUrl
    ? createButton('Verify Your Email', verificationUrl)
    : createButton('Go to Dashboard', dashboardUrl);

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">
      Welcome to Skillancer, ${userName}! 🎉
    </h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">
      ${welcomeMessage}
    </p>

    ${
      verificationUrl
        ? `
    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#FEF3C7', borderColor: '#F59E0B' })}">
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
        <strong>📧 Please verify your email</strong><br>
        Click the button below to verify your email address and activate your account.
      </p>
    </div>
    `
        : ''
    }

    <div style="text-align: center; margin: 32px 0;">
      ${ctaButton}
    </div>

    <h2 style="${styleToString(commonStyles.heading2)}">
      Here's how to get started:
    </h2>
    
    <ol style="padding-left: 20px; margin: 0;">
      ${nextSteps}
    </ol>

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString(commonStyles.card)}">
      <h3 style="${styleToString({ ...commonStyles.heading2, color: BRAND_COLORS.primary })}">
        💡 Pro Tip
      </h3>
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
        ${proTip}
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Need help getting started? Our support team is here for you at 
      <a href="mailto:support@skillancer.com" style="color: ${BRAND_COLORS.primary};">support@skillancer.com</a>
    </p>


    <p style="${styleToString(commonStyles.paragraph)}">
      Best regards,<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Welcome to Skillancer!',
    body,
    previewText: `Welcome to Skillancer, ${userName}! Let's get you started.`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `Welcome to Skillancer, ${userName}! 🎉`;

  return { html, text, subject };
}

export default generateWelcomeEmail;

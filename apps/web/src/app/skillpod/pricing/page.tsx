import type { Metadata } from 'next';
import { Check, X, HelpCircle, Zap, Shield, Users, HeadphonesIcon } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SkillPod Pricing - Enterprise VDI & Secure Access',
  description:
    'Choose the right SkillPod plan for your organization. From startups to enterprises, we have secure containerized desktop solutions for every team size.',
};

// =============================================================================
// PLAN DATA
// =============================================================================

const plans = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Perfect for small teams',
    description: 'Essential VDI capabilities for teams getting started with secure remote access.',
    monthlyPrice: 99,
    annualPrice: 79,
    perUserMonthly: 15,
    perUserAnnual: 12,
    maxUsers: 10,
    recommended: false,
    cta: 'Start Free Trial',
    ctaLink: '/signup?plan=starter',
    features: {
      core: [
        { name: 'VDI Sessions', included: true },
        { name: 'Multi-Device Access', included: true },
        { name: 'Session Recording', included: false },
        { name: 'Custom Container Images', included: false },
      ],
      security: [
        { name: 'Multi-Factor Authentication', included: true },
        { name: 'IP Whitelisting', included: false },
        { name: 'DLP Policies', included: false },
        { name: 'Real-time Threat Detection', included: false },
      ],
      integration: [
        { name: 'REST API Access', included: false },
        { name: 'SAML 2.0 SSO', included: false },
        { name: 'OIDC SSO', included: false },
        { name: 'SCIM Provisioning', included: false },
      ],
      support: [
        { name: 'Email Support', included: true },
        { name: 'Priority Support (4hr SLA)', included: false },
        { name: 'Dedicated CSM', included: false },
        { name: 'Training Sessions', included: false },
      ],
    },
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For growing organizations',
    description: 'Advanced features and integrations for scaling teams with compliance needs.',
    monthlyPrice: 299,
    annualPrice: 249,
    perUserMonthly: 25,
    perUserAnnual: 20,
    maxUsers: 50,
    recommended: true,
    cta: 'Start Free Trial',
    ctaLink: '/signup?plan=pro',
    features: {
      core: [
        { name: 'VDI Sessions', included: true },
        { name: 'Multi-Device Access', included: true },
        { name: 'Session Recording', included: true },
        { name: 'Custom Container Images', included: true },
      ],
      security: [
        { name: 'Multi-Factor Authentication', included: true },
        { name: 'IP Whitelisting', included: true },
        { name: 'DLP Policies', included: true },
        { name: 'Real-time Threat Detection', included: false },
      ],
      integration: [
        { name: 'REST API Access', included: true },
        { name: 'SAML 2.0 SSO', included: true },
        { name: 'OIDC SSO', included: true },
        { name: 'SCIM Provisioning', included: false },
      ],
      support: [
        { name: 'Email Support', included: true },
        { name: 'Priority Support (4hr SLA)', included: true },
        { name: 'Dedicated CSM', included: false },
        { name: 'Training Sessions', included: true },
      ],
    },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Full power, custom solutions',
    description:
      'Complete platform with advanced security, unlimited scale, and white-glove support.',
    monthlyPrice: null,
    annualPrice: null,
    maxUsers: -1,
    recommended: false,
    cta: 'Contact Sales',
    ctaLink: '/contact-sales?plan=enterprise',
    features: {
      core: [
        { name: 'VDI Sessions', included: true },
        { name: 'Multi-Device Access', included: true },
        { name: 'Session Recording', included: true },
        { name: 'Custom Container Images', included: true },
      ],
      security: [
        { name: 'Multi-Factor Authentication', included: true },
        { name: 'IP Whitelisting', included: true },
        { name: 'DLP Policies', included: true },
        { name: 'Real-time Threat Detection', included: true },
      ],
      integration: [
        { name: 'REST API Access', included: true },
        { name: 'SAML 2.0 SSO', included: true },
        { name: 'OIDC SSO', included: true },
        { name: 'SCIM Provisioning', included: true },
      ],
      support: [
        { name: 'Email Support', included: true },
        { name: 'Priority Support (4hr SLA)', included: true },
        { name: 'Dedicated CSM', included: true },
        { name: 'Training Sessions', included: true },
      ],
    },
  },
];

const faq = [
  {
    question: 'How does the 14-day free trial work?',
    answer:
      'Start with full Pro features for 14 days, no credit card required. At the end of your trial, choose the plan that fits your needs or continue with our free tier.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the remaining billing period. Downgrades take effect at the next billing cycle.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express), ACH bank transfers for annual plans, and can issue invoices for Enterprise customers.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer:
      'Yes! Annual billing saves you approximately 20% compared to monthly billing. Enterprise customers can also negotiate multi-year discounts.',
  },
  {
    question: "What's included in the per-user pricing?",
    answer:
      'Each user gets access to VDI sessions, their allocated storage, and all features included in your plan tier. The base price includes your first user.',
  },
  {
    question: 'How do concurrent session limits work?',
    answer:
      'Concurrent sessions are the number of active VDI sessions running at the same time. If you hit your limit, users will need to wait for a session to end before starting a new one.',
  },
  {
    question: 'Is there a setup fee?',
    answer:
      'No setup fees for Starter and Pro plans. Enterprise customers receive complimentary onboarding and implementation support as part of their custom agreement.',
  },
  {
    question: 'Do you offer educational or nonprofit discounts?',
    answer:
      'Yes! We offer 25% off for verified educational institutions and registered nonprofits. Contact our sales team to learn more.',
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function PricingToggle({ isAnnual, onToggle }: { isAnnual: boolean; onToggle: () => void }) {
  return (
    <div className="mb-12 flex items-center justify-center gap-4">
      <span className={`text-sm ${!isAnnual ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
        Monthly
      </span>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isAnnual ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isAnnual ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm ${isAnnual ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
        Annual
        <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          Save 20%
        </span>
      </span>
    </div>
  );
}

function PlanCard({ plan, isAnnual }: { plan: (typeof plans)[0]; isAnnual: boolean }) {
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const perUser = isAnnual ? plan.perUserAnnual : plan.perUserMonthly;

  return (
    <div
      className={`relative rounded-2xl border-2 p-8 ${
        plan.recommended
          ? 'scale-105 border-blue-600 shadow-xl'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {plan.recommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
          Most Popular
        </div>
      )}

      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
        <p className="mt-1 text-sm text-gray-500">{plan.tagline}</p>
      </div>

      <div className="mb-6 text-center">
        {price !== null ? (
          <>
            <div className="flex items-baseline justify-center">
              <span className="text-4xl font-bold text-gray-900">${price}</span>
              <span className="ml-1 text-gray-500">/mo</span>
            </div>
            {perUser && (
              <p className="mt-1 text-sm text-gray-500">+ ${perUser}/user/mo after first user</p>
            )}
            {isAnnual && <p className="mt-1 text-xs text-green-600">Billed annually</p>}
          </>
        ) : (
          <div className="text-4xl font-bold text-gray-900">Custom</div>
        )}
      </div>

      <p className="mb-6 text-center text-sm text-gray-600">{plan.description}</p>

      <Link
        href={plan.ctaLink}
        className={`block w-full rounded-lg px-4 py-3 text-center font-medium transition-colors ${
          plan.recommended
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        {plan.cta}
      </Link>

      <div className="mt-8 space-y-4">
        <div className="text-sm font-medium text-gray-900">
          {plan.maxUsers === -1 ? 'Unlimited users' : `Up to ${plan.maxUsers} users`}
        </div>

        <div className="space-y-2">
          {Object.values(plan.features)
            .flat()
            .slice(0, 6)
            .map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {feature.included ? (
                  <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <X className="h-4 w-4 flex-shrink-0 text-gray-300" />
                )}
                <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                  {feature.name}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

type Plan = (typeof plans)[number];

function FeatureComparisonTable({
  plans: plansList,
  isAnnual,
}: {
  plans: Plan[];
  isAnnual: boolean;
}) {
  const categories = [
    { key: 'core', name: 'Core Features', icon: <Zap className="h-5 w-5" /> },
    { key: 'security', name: 'Security', icon: <Shield className="h-5 w-5" /> },
    { key: 'integration', name: 'Integrations', icon: <Users className="h-5 w-5" /> },
    { key: 'support', name: 'Support', icon: <HeadphonesIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="mt-24">
      <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">Compare All Features</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="w-1/3 px-4 py-4 text-left">Feature</th>
              {plansList.map((plan: Plan) => (
                <th key={plan.id} className="px-4 py-4 text-center">
                  <div className="text-lg font-bold">{plan.name}</div>
                  <div className="text-sm text-gray-500">
                    {plan.monthlyPrice !== null
                      ? `$${isAnnual ? plan.annualPrice : plan.monthlyPrice}/mo`
                      : 'Custom'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <>
                <tr key={category.key} className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      {category.icon}
                      {category.name}
                    </div>
                  </td>
                </tr>
                {plansList[0]?.features[category.key as keyof Plan['features']]?.map(
                  (feature: { name: string; included: boolean }, i: number) => (
                    <tr key={`${category.key}-${i}`} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-700">{feature.name}</td>
                      {plansList.map((plan: Plan) => {
                        const planFeature =
                          plan.features[category.key as keyof Plan['features']]?.[i];
                        return (
                          <td key={plan.id} className="px-4 py-3 text-center">
                            {planFeature?.included ? (
                              <Check className="mx-auto h-5 w-5 text-green-500" />
                            ) : (
                              <X className="mx-auto h-5 w-5 text-gray-300" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FAQ() {
  return (
    <div className="mt-24">
      <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
        Frequently Asked Questions
      </h2>

      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {faq.map((item, i) => (
          <div key={i} className="space-y-2">
            <h3 className="flex items-start gap-2 font-semibold text-gray-900">
              <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              {item.question}
            </h3>
            <p className="pl-7 text-sm text-gray-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnterpriseCallout() {
  return (
    <div className="mt-24 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-12 text-center text-white">
      <h2 className="mb-4 text-3xl font-bold">Need a Custom Solution?</h2>
      <p className="mx-auto mb-8 max-w-2xl text-blue-100">
        Our Enterprise plan offers unlimited users, advanced security features, dedicated support,
        and custom SLAs. Let's discuss your specific requirements.
      </p>
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <Link
          href="/contact-sales"
          className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          Contact Sales
        </Link>
        <Link
          href="/demo"
          className="inline-flex items-center justify-center rounded-lg border-2 border-white px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
        >
          Request Demo
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function PricingPage() {
  // Note: This would be client component in real implementation for toggle
  const isAnnual = false; // Default to monthly, would be state in client component

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-50 to-white pb-12 pt-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-600">
            Choose the plan that fits your organization. All plans include a 14-day free trial with
            full access to Pro features.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Toggle would be interactive in client component */}
        <div className="mb-12 flex items-center justify-center gap-4">
          <span className="text-sm font-medium text-gray-900">Monthly</span>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
            <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white" />
          </div>
          <span className="text-sm text-gray-500">
            Annual
            <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Save 20%
            </span>
          </span>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isAnnual={isAnnual} />
          ))}
        </div>

        {/* Feature Comparison */}
        <FeatureComparisonTable plans={plans} isAnnual={isAnnual} />

        {/* Enterprise Callout */}
        <EnterpriseCallout />

        {/* FAQ */}
        <FAQ />

        {/* Trust Section */}
        <div className="mt-24 pb-24 text-center">
          <p className="mb-8 text-gray-500">Trusted by innovative companies worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-50">
            {/* Placeholder logos */}
            {['Company A', 'Company B', 'Company C', 'Company D', 'Company E'].map((company) => (
              <div key={company} className="text-2xl font-bold text-gray-400">
                {company}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

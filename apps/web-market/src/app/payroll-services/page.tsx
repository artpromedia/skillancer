'use client';

import {
  BanknotesIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ClockIcon,
  CalculatorIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserGroupIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Feature {
  title: string;
  description: string;
  icon: React.ElementType;
}

interface PricingTier {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

interface Benefit {
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    title: 'Global Payroll Processing',
    description:
      'Pay freelancers and contractors in 180+ countries with local currency support and competitive exchange rates.',
    icon: GlobeAltIcon,
  },
  {
    title: 'Automated Payments',
    description:
      'Set up recurring payments, milestone-based releases, or on-demand transfers. Never miss a payment deadline.',
    icon: ClockIcon,
  },
  {
    title: 'Tax Compliance',
    description:
      'Automatic tax form generation (1099, W-8BEN, etc.), withholding calculations, and year-end reporting.',
    icon: CalculatorIcon,
  },
  {
    title: 'Multi-Currency Support',
    description:
      'Pay in 50+ currencies with transparent fees. Freelancers receive payments in their preferred currency.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Contractor Classification',
    description:
      'Built-in classification tools to ensure proper worker status and avoid misclassification risks.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Detailed Reporting',
    description:
      'Comprehensive dashboards for spend tracking, budget forecasting, and financial reporting.',
    icon: ChartBarIcon,
  },
];

const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    description: 'For small teams just getting started with freelancers',
    price: '$0',
    period: 'per month',
    features: [
      'Up to 5 contractors',
      'Basic payment processing',
      'Email support',
      'Standard transfer speeds',
      '1099 generation',
    ],
    highlighted: false,
    cta: 'Get Started Free',
  },
  {
    name: 'Professional',
    description: 'For growing teams managing multiple freelancers',
    price: '$49',
    period: 'per month',
    features: [
      'Up to 50 contractors',
      'Multi-currency payments',
      'Priority support',
      'Fast transfers (1-2 days)',
      'Tax compliance tools',
      'Spend analytics',
      'API access',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with complex needs',
    price: 'Custom',
    period: 'contact sales',
    features: [
      'Unlimited contractors',
      'Dedicated account manager',
      'Same-day transfers',
      'Custom integrations',
      'Advanced compliance',
      'SSO & security controls',
      'SLA guarantees',
      'White-label options',
    ],
    highlighted: false,
    cta: 'Contact Sales',
  },
];

const benefits: Benefit[] = [
  {
    title: 'Reduce Administrative Burden',
    description:
      'Automate invoicing, payment processing, and tax documentation. Save 10+ hours per week on payroll tasks.',
  },
  {
    title: 'Ensure Compliance',
    description:
      'Stay compliant with local labor laws, tax regulations, and contractor classification requirements worldwide.',
  },
  {
    title: 'Improve Contractor Satisfaction',
    description:
      'Fast, reliable payments in local currencies keep your freelancers happy and motivated.',
  },
  {
    title: 'Gain Financial Visibility',
    description:
      'Real-time dashboards and reports give you complete visibility into contractor spend and budgets.',
  },
];

const paymentMethods = [
  'Direct Bank Transfer (ACH)',
  'Wire Transfer',
  'PayPal',
  'Payoneer',
  'Wise (TransferWise)',
  'Local Bank Transfer (50+ countries)',
];

const complianceFeatures = [
  'Automatic 1099-NEC generation',
  'W-8BEN/W-8BEN-E collection',
  'Worker classification questionnaire',
  'Contract template library',
  'Audit trail & documentation',
  'Multi-jurisdiction compliance',
];

const stats = [
  { value: '$500M+', label: 'Processed Annually' },
  { value: '180+', label: 'Countries Supported' },
  { value: '50+', label: 'Currencies' },
  { value: '99.9%', label: 'Payment Success Rate' },
];

export default function PayrollServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-green-600 to-green-700 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-100">
                <BanknotesIcon className="h-4 w-4" />
                Payroll Services
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Global Payroll Made Simple
              </h1>
              <p className="mt-6 text-lg leading-8 text-green-100">
                Pay your freelancers and contractors anywhere in the world with automated payments,
                tax compliance, and real-time reporting. No more spreadsheets, no more missed
                payments.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-green-600 transition-colors hover:bg-gray-100"
                  href="/signup?plan=payroll"
                >
                  Start Free Trial
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-lg border-2 border-white px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-600"
                  href="/contact?type=payroll"
                >
                  Talk to Sales
                </Link>
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur"
                  >
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="mt-1 text-sm text-green-100">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything You Need for Contractor Payments
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A complete payroll solution designed for the modern workforce
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <feature.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">Get started in minutes, not days</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {[
              {
                step: 1,
                title: 'Add Contractors',
                description:
                  'Invite freelancers to join your payroll. They complete their profiles and tax information.',
              },
              {
                step: 2,
                title: 'Set Up Payments',
                description:
                  'Configure payment schedules, currencies, and methods for each contractor.',
              },
              {
                step: 3,
                title: 'Approve & Pay',
                description:
                  'Review timesheets or invoices, approve payments with one click, and we handle the rest.',
              },
              {
                step: 4,
                title: 'Stay Compliant',
                description:
                  'We automatically generate tax forms and maintain records for audit-ready compliance.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods & Compliance */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12">
            {/* Payment Methods */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Flexible Payment Options</h2>
              <p className="mt-4 text-gray-600">
                Pay contractors using the method that works best for them. We support all major
                payment platforms and local bank transfers in 50+ countries.
              </p>
              <ul className="mt-8 space-y-3">
                {paymentMethods.map((method) => (
                  <li key={method} className="flex items-center gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700">{method}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Compliance */}
            <div className="mt-12 lg:mt-0">
              <h2 className="text-2xl font-bold text-gray-900">Built-In Compliance</h2>
              <p className="mt-4 text-gray-600">
                Stay compliant with tax regulations and labor laws worldwide. We handle the
                paperwork so you can focus on your business.
              </p>
              <ul className="mt-8 space-y-3">
                {complianceFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-green-600 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">
              Why Companies Choose Skillancer Payroll
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl bg-white/10 p-6 backdrop-blur">
                <h3 className="text-lg font-semibold text-white">{benefit.title}</h3>
                <p className="mt-2 text-green-100">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-gray-600">
              Choose the plan that fits your team size and needs
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl border-2 p-8 ${
                  tier.highlighted ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                {tier.highlighted && (
                  <span className="mb-4 inline-block rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-gray-500">/{tier.period}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-8 w-full rounded-lg px-4 py-3 font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-green-600 text-white hover:bg-green-500'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Partners */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Integrates With Your Favorite Tools
            </h2>
            <p className="mt-2 text-gray-600">
              Connect with accounting, HR, and project management software
            </p>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {['QuickBooks', 'Xero', 'NetSuite', 'Workday', 'BambooHR', 'Slack'].map((tool) => (
              <div
                key={tool}
                className="text-xl font-bold text-gray-300 transition-colors hover:text-gray-400"
              >
                {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Ready to Simplify Your Contractor Payments?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Join thousands of companies using Skillancer Payroll to pay their global workforce.
            Start your free trial today.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-500"
              href="/signup?plan=payroll"
            >
              Start Free Trial
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              href="/contact?type=payroll-demo"
            >
              Schedule a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">Common Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'How quickly can contractors receive payments?',
                a: 'Standard transfers take 3-5 business days. With Professional and Enterprise plans, you can access fast transfers (1-2 days) or same-day payments.',
              },
              {
                q: 'Do you handle tax forms for international contractors?',
                a: 'Yes! We automatically collect W-8BEN forms from international contractors and generate 1099s for US-based freelancers at year-end.',
              },
              {
                q: 'Can I integrate with my existing accounting software?',
                a: 'Absolutely. We integrate with QuickBooks, Xero, NetSuite, and other major accounting platforms. Enterprise customers can also use our API for custom integrations.',
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              className="font-medium text-green-600 hover:text-green-500"
              href="/faq?topic=payroll"
            >
              View all Payroll FAQs →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/enterprise">
              Enterprise
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-hire">
              How to Hire
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/help">
              Help Center
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact Sales
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

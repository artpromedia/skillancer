'use client';

import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  ChartBarIcon,
  UserGroupIcon,
  GlobeAltIcon,
  CogIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Feature {
  title: string;
  description: string;
  icon: React.ElementType;
}

interface Benefit {
  title: string;
  description: string;
}

interface CaseStudy {
  company: string;
  industry: string;
  logo: string;
  challenge: string;
  solution: string;
  result: string;
  metrics: { label: string; value: string }[];
}

const enterpriseFeatures: Feature[] = [
  {
    title: 'Dedicated Talent Pool',
    description:
      'Access a curated network of pre-vetted enterprise-grade freelancers with proven experience working with Fortune 500 companies.',
    icon: UserGroupIcon,
  },
  {
    title: 'Enterprise Security',
    description:
      'SOC 2 Type II certified with advanced security controls, SSO integration, and compliance with global data protection regulations.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Custom Integrations',
    description:
      'Seamlessly integrate with your existing tools including HRIS, project management, and finance systems via our API.',
    icon: CogIcon,
  },
  {
    title: 'Global Compliance',
    description:
      'Navigate international labor laws, contractor classification, and tax requirements with our built-in compliance tools.',
    icon: GlobeAltIcon,
  },
  {
    title: 'Analytics & Reporting',
    description:
      'Gain insights into workforce spend, project performance, and talent utilization with comprehensive dashboards.',
    icon: ChartBarIcon,
  },
  {
    title: 'Faster Time-to-Hire',
    description:
      'Reduce time-to-hire by 60% with AI-powered matching, pre-vetted talent, and streamlined onboarding workflows.',
    icon: ClockIcon,
  },
];

const benefits: Benefit[] = [
  {
    title: 'Dedicated Account Team',
    description:
      'A dedicated customer success manager and talent sourcing specialist focused on your needs.',
  },
  {
    title: 'Priority Support',
    description:
      '24/7 priority support with guaranteed response times and dedicated support channels.',
  },
  {
    title: 'Custom SLAs',
    description: 'Tailored service level agreements that align with your enterprise requirements.',
  },
  {
    title: 'Flexible Contracts',
    description: 'Custom pricing and contract terms designed for enterprise procurement processes.',
  },
  {
    title: 'Onboarding & Training',
    description: 'Comprehensive onboarding and training for your team to maximize platform value.',
  },
  {
    title: 'Talent Exclusivity',
    description: 'Option to build exclusive talent pools for ongoing projects and initiatives.',
  },
];

const caseStudies: CaseStudy[] = [
  {
    company: 'TechCorp',
    industry: 'Technology',
    logo: 'TC',
    challenge: 'Needed to scale engineering team quickly for product launch',
    solution: 'Deployed 25 senior developers within 2 weeks through Skillancer Enterprise',
    result: 'Launched product on time with 40% cost savings vs. traditional staffing',
    metrics: [
      { label: 'Time to Deploy', value: '2 weeks' },
      { label: 'Cost Savings', value: '40%' },
      { label: 'Talent Retained', value: '92%' },
    ],
  },
  {
    company: 'GlobalRetail',
    industry: 'E-commerce',
    logo: 'GR',
    challenge: 'Required multilingual support team across 12 time zones',
    solution: 'Built distributed customer success team with 50+ specialists',
    result: 'Achieved 24/7 coverage with 98% customer satisfaction',
    metrics: [
      { label: 'Languages', value: '15+' },
      { label: 'CSAT Score', value: '98%' },
      { label: 'Response Time', value: '-65%' },
    ],
  },
];

const stats = [
  { value: '500+', label: 'Enterprise Clients' },
  { value: '$500M+', label: 'Enterprise GMV' },
  { value: '60%', label: 'Faster Hiring' },
  { value: '99.9%', label: 'Platform Uptime' },
];

const securityFeatures = [
  'SOC 2 Type II Certified',
  'GDPR Compliant',
  'CCPA Compliant',
  'SSO / SAML Integration',
  'Role-Based Access Control',
  'Audit Logs & Reporting',
  'Data Encryption (AES-256)',
  'Vendor Risk Assessments',
];

export default function EnterprisePage() {
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
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-600/20 px-3 py-1 text-sm font-medium text-green-400">
                <BuildingOffice2Icon className="h-4 w-4" />
                Enterprise Solutions
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Scale Your Workforce with Confidence
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                Skillancer Enterprise provides the security, compliance, and dedicated support that
                large organizations need to build flexible, global teams.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
                  href="/contact?type=enterprise"
                >
                  Contact Sales
                </Link>
                <button className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800">
                  Watch Demo
                </button>
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-gray-700 bg-gray-800/50 p-6"
                  >
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="border-b border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-8 text-center text-sm font-medium text-gray-500">
            TRUSTED BY LEADING ENTERPRISES WORLDWIDE
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {['Microsoft', 'Airbnb', 'Salesforce', 'Stripe', 'Shopify', 'Dropbox'].map(
              (company) => (
                <div
                  key={company}
                  className="text-xl font-bold text-gray-300 transition-colors hover:text-gray-400"
                >
                  {company}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Enterprise-Grade Features</h2>
            <p className="mt-4 text-lg text-gray-600">
              Everything you need to manage a global flexible workforce at scale
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {enterpriseFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
              >
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

      {/* Security Section */}
      <section className="bg-gray-900 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-white">Security & Compliance First</h2>
              <p className="mb-8 text-lg text-gray-300">
                We understand that security is non-negotiable for enterprises. Skillancer is built
                with enterprise-grade security controls and maintains compliance with major
                regulatory frameworks.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {securityFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  className="inline-flex items-center font-medium text-green-400 hover:text-green-300"
                  href="/trust"
                >
                  Learn more about our security practices
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="mt-12 flex justify-center lg:mt-0">
              <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 text-center">
                    <ShieldCheckIcon className="mx-auto mb-3 h-12 w-12 text-green-500" />
                    <p className="text-sm font-medium text-white">SOC 2 Type II</p>
                    <p className="text-xs text-gray-400">Certified</p>
                  </div>
                  <div className="p-4 text-center">
                    <GlobeAltIcon className="mx-auto mb-3 h-12 w-12 text-green-500" />
                    <p className="text-sm font-medium text-white">GDPR</p>
                    <p className="text-xs text-gray-400">Compliant</p>
                  </div>
                  <div className="p-4 text-center">
                    <BuildingOffice2Icon className="mx-auto mb-3 h-12 w-12 text-green-500" />
                    <p className="text-sm font-medium text-white">ISO 27001</p>
                    <p className="text-xs text-gray-400">Certified</p>
                  </div>
                  <div className="p-4 text-center">
                    <CurrencyDollarIcon className="mx-auto mb-3 h-12 w-12 text-green-500" />
                    <p className="text-sm font-medium text-white">PCI DSS</p>
                    <p className="text-xs text-gray-400">Compliant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Customer Success Stories</h2>
            <p className="mt-4 text-lg text-gray-600">
              See how leading enterprises scale with Skillancer
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {caseStudies.map((study) => (
              <div
                key={study.company}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="border-b border-gray-100 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-900 text-xl font-bold text-white">
                      {study.logo}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{study.company}</h3>
                      <p className="text-sm text-gray-500">{study.industry}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Challenge</p>
                    <p className="text-gray-900">{study.challenge}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Solution</p>
                    <p className="text-gray-900">{study.solution}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Result</p>
                    <p className="text-gray-900">{study.result}</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <div className="flex justify-between">
                    {study.metrics.map((metric) => (
                      <div key={metric.label} className="text-center">
                        <p className="text-xl font-bold text-green-600">{metric.value}</p>
                        <p className="text-xs text-gray-500">{metric.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              className="inline-flex items-center font-medium text-green-600 hover:text-green-500"
              href="/success-stories"
            >
              View more success stories
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Enterprise Benefits</h2>
            <p className="mt-4 text-lg text-gray-600">
              White-glove service designed for large organizations
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-green-600 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Ready to Transform Your Workforce Strategy?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-green-100">
            Schedule a consultation with our enterprise team to learn how Skillancer can help you
            build a more flexible, efficient workforce.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-lg font-semibold text-green-600 transition-colors hover:bg-gray-100"
              href="/contact?type=enterprise"
            >
              Contact Sales
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border-2 border-white px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-500"
              href="/pricing"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-hire">
              How to Hire
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/trust">
              Trust & Security
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/help">
              Help Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

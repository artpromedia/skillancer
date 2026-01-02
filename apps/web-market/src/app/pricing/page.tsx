'use client';

import { CheckIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useState } from 'react';

type BillingPeriod = 'monthly' | 'annually';

interface PricingTier {
  name: string;
  id: string;
  description: string;
  price: {
    monthly: number;
    annually: number;
  };
  features: string[];
  highlighted?: boolean;
  cta: string;
  href: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    id: 'tier-starter',
    description: 'Perfect for individuals just getting started with freelancing.',
    price: {
      monthly: 0,
      annually: 0,
    },
    features: [
      '5 proposals per month',
      'Basic profile',
      'Standard messaging',
      'Payment protection',
      '20% service fee',
      'Email support',
    ],
    cta: 'Get Started Free',
    href: '/signup',
  },
  {
    name: 'Professional',
    id: 'tier-professional',
    description: 'For growing freelancers who want to scale their business.',
    price: {
      monthly: 29,
      annually: 24,
    },
    features: [
      'Unlimited proposals',
      'Featured profile badge',
      'Priority in search results',
      'AI-powered job matching',
      '10% service fee',
      'Priority support',
      'Analytics dashboard',
      'Proposal templates',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
    href: '/signup?plan=professional',
  },
  {
    name: 'Business',
    id: 'tier-business',
    description: 'For agencies and teams managing multiple freelancers.',
    price: {
      monthly: 99,
      annually: 79,
    },
    features: [
      'Everything in Professional',
      'Team management (up to 10)',
      'Custom branding',
      'Bulk proposals',
      '5% service fee',
      'Dedicated account manager',
      'API access',
      'Advanced analytics',
      'Priority placement',
      'White-glove onboarding',
    ],
    cta: 'Contact Sales',
    href: '/contact?subject=business',
  },
];

const comparisonFeatures = [
  {
    category: 'Core Features',
    features: [
      {
        name: 'Proposals per month',
        starter: '5',
        professional: 'Unlimited',
        business: 'Unlimited',
      },
      {
        name: 'Profile visibility',
        starter: 'Standard',
        professional: 'Featured',
        business: 'Priority',
      },
      { name: 'Service fee', starter: '20%', professional: '10%', business: '5%' },
      { name: 'Payment protection', starter: true, professional: true, business: true },
    ],
  },
  {
    category: 'AI & Matching',
    features: [
      { name: 'AI job matching', starter: false, professional: true, business: true },
      { name: 'Smart recommendations', starter: false, professional: true, business: true },
      {
        name: 'Skill-based matching',
        starter: 'Basic',
        professional: 'Advanced',
        business: 'Advanced',
      },
    ],
  },
  {
    category: 'Team & Collaboration',
    features: [
      { name: 'Team members', starter: '1', professional: '1', business: 'Up to 10' },
      { name: 'Shared workspace', starter: false, professional: false, business: true },
      { name: 'Team analytics', starter: false, professional: false, business: true },
    ],
  },
  {
    category: 'Support & Analytics',
    features: [
      { name: 'Support level', starter: 'Email', professional: 'Priority', business: 'Dedicated' },
      { name: 'Analytics dashboard', starter: false, professional: true, business: true },
      { name: 'API access', starter: false, professional: false, business: true },
    ],
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

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
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Choose the plan that's right for you. All plans include our core platform features with
            no hidden fees.
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <span
              className={`text-sm ${billingPeriod === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
            >
              Monthly
            </span>
            <button
              aria-checked={billingPeriod === 'annually'}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 ${
                billingPeriod === 'annually' ? 'bg-green-600' : 'bg-gray-200'
              }`}
              role="switch"
              type="button"
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annually' : 'monthly')}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  billingPeriod === 'annually' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-sm ${billingPeriod === 'annually' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
            >
              Annually
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Save 20%
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-3xl p-8 ${
                  tier.highlighted
                    ? 'bg-gray-900 ring-2 ring-green-500'
                    : 'bg-white ring-1 ring-gray-200'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-green-500 px-4 py-1 text-sm font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}
                  >
                    {tier.name}
                  </h3>
                  <p
                    className={`mt-2 text-sm ${tier.highlighted ? 'text-gray-300' : 'text-gray-600'}`}
                  >
                    {tier.description}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline">
                    <span
                      className={`text-4xl font-bold tracking-tight ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}
                    >
                      ${tier.price[billingPeriod]}
                    </span>
                    {tier.price.monthly > 0 && (
                      <span
                        className={`ml-2 text-sm ${tier.highlighted ? 'text-gray-300' : 'text-gray-600'}`}
                      >
                        /month
                      </span>
                    )}
                  </div>
                  {tier.price.monthly > 0 && billingPeriod === 'annually' && (
                    <p
                      className={`mt-1 text-sm ${tier.highlighted ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      Billed annually (${tier.price.annually * 12}/year)
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckIcon
                        className={`h-5 w-5 flex-shrink-0 ${tier.highlighted ? 'text-green-400' : 'text-green-600'}`}
                      />
                      <span
                        className={`ml-3 text-sm ${tier.highlighted ? 'text-gray-300' : 'text-gray-600'}`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-green-500 text-white hover:bg-green-400'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                  href={tier.href}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">Compare Plans</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="w-1/4 py-4 text-left text-sm font-semibold text-gray-900">
                    Feature
                  </th>
                  <th className="w-1/4 py-4 text-center text-sm font-semibold text-gray-900">
                    Starter
                  </th>
                  <th className="w-1/4 bg-green-50 py-4 text-center text-sm font-semibold text-gray-900">
                    Professional
                  </th>
                  <th className="w-1/4 py-4 text-center text-sm font-semibold text-gray-900">
                    Business
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((section) => (
                  <>
                    <tr key={section.category}>
                      <td
                        className="bg-gray-100 py-4 text-sm font-semibold text-gray-900"
                        colSpan={4}
                      >
                        {section.category}
                      </td>
                    </tr>
                    {section.features.map((feature) => (
                      <tr key={feature.name} className="border-b border-gray-200">
                        <td className="py-4 text-sm text-gray-600">{feature.name}</td>
                        <td className="py-4 text-center">
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? (
                              <CheckIcon className="mx-auto h-5 w-5 text-green-600" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-sm text-gray-600">{feature.starter}</span>
                          )}
                        </td>
                        <td className="bg-green-50 py-4 text-center">
                          {typeof feature.professional === 'boolean' ? (
                            feature.professional ? (
                              <CheckIcon className="mx-auto h-5 w-5 text-green-600" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-sm font-medium text-gray-900">
                              {feature.professional}
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          {typeof feature.business === 'boolean' ? (
                            feature.business ? (
                              <CheckIcon className="mx-auto h-5 w-5 text-green-600" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-sm text-gray-600">{feature.business}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-gray-900 to-gray-800 p-8 sm:p-12 lg:p-16">
            <div className="lg:flex lg:items-center lg:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white">Enterprise Solutions</h2>
                <p className="mt-4 max-w-2xl text-lg text-gray-300">
                  Need a custom solution for your organization? Get dedicated support, custom
                  integrations, and volume pricing tailored to your needs.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    'Custom contracts',
                    'Volume discounts',
                    'SSO integration',
                    'Dedicated success manager',
                    'Custom reporting',
                    'SLA guarantees',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center">
                      <CheckIcon className="h-5 w-5 text-green-400" />
                      <span className="ml-3 text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 lg:ml-12 lg:mt-0">
                <Link
                  className="inline-flex items-center rounded-lg bg-white px-6 py-4 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                  href="/contact?subject=enterprise"
                >
                  Contact Enterprise Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">Questions about pricing?</h2>
          <p className="mt-4 text-lg text-gray-600">
            Check out our frequently asked questions or reach out to our team.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              href="/faq"
            >
              View FAQ
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
              href="/contact"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

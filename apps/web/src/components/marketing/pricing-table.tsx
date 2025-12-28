'use client';

import Link from 'next/link';
import { useState } from 'react';

const plans = [
  {
    name: 'Free',
    description: 'For individuals just getting started',
    price: { monthly: 0, yearly: 0 },
    features: ['5 proposals per month', 'Basic profile', 'Community support', 'Standard matching'],
    cta: 'Get Started',
    href: '/signup?plan=free',
    highlighted: false,
  },
  {
    name: 'Pro',
    description: 'For serious freelancers',
    price: { monthly: 29, yearly: 290 },
    features: [
      'Unlimited proposals',
      'Verified profile badge',
      'Priority support',
      'SmartMatch AI',
      'SkillPod workspaces (3)',
      'Analytics dashboard',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=pro',
    highlighted: true,
  },
  {
    name: 'Business',
    description: 'For agencies and teams',
    price: { monthly: 99, yearly: 990 },
    features: [
      'Everything in Pro',
      'Unlimited SkillPods',
      'Team management',
      'Custom branding',
      'API access',
      'Dedicated support',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    href: '/contact?plan=business',
    highlighted: false,
  },
];

export function PricingTable() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div>
      {/* Toggle */}
      <div className="mb-12 flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!isYearly ? 'text-slate-900' : 'text-slate-500'}`}>
          Monthly
        </span>
        <button
          className={`relative h-7 w-14 rounded-full transition-colors ${
            isYearly ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          onClick={() => setIsYearly(!isYearly)}
        >
          <span
            className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
              isYearly ? 'translate-x-7' : ''
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${isYearly ? 'text-slate-900' : 'text-slate-500'}`}>
          Yearly
          <span className="ml-2 text-xs font-semibold text-green-600">Save 17%</span>
        </span>
      </div>

      {/* Cards */}
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl p-8 ${
              plan.highlighted
                ? 'scale-105 bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-2xl'
                : 'border border-slate-200 bg-white'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-1 text-xs font-bold text-slate-900">
                Most Popular
              </div>
            )}

            <h3 className={`mb-2 text-xl font-bold ${plan.highlighted ? '' : 'text-slate-900'}`}>
              {plan.name}
            </h3>
            <p
              className={`mb-6 text-sm ${plan.highlighted ? 'text-indigo-100' : 'text-slate-500'}`}
            >
              {plan.description}
            </p>

            <div className="mb-6">
              <span className={`text-4xl font-bold ${plan.highlighted ? '' : 'text-slate-900'}`}>
                ${isYearly ? plan.price.yearly : plan.price.monthly}
              </span>
              <span
                className={`text-sm ${plan.highlighted ? 'text-indigo-100' : 'text-slate-500'}`}
              >
                /{isYearly ? 'year' : 'month'}
              </span>
            </div>

            <ul className="mb-8 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg
                    className={`h-5 w-5 flex-shrink-0 ${plan.highlighted ? 'text-indigo-200' : 'text-green-500'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      clipRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      fillRule="evenodd"
                    />
                  </svg>
                  <span
                    className={`text-sm ${plan.highlighted ? 'text-indigo-100' : 'text-slate-600'}`}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              className={`block w-full rounded-lg py-3 text-center font-semibold transition-all ${
                plan.highlighted
                  ? 'bg-white text-indigo-600 hover:bg-slate-50'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
              href={plan.href}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

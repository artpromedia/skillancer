'use client';

/**
 * Intelligence API Portal - Pricing Page
 * Sprint M10: Talent Intelligence API
 */

import { Button } from '@skillancer/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@skillancer/ui/card';
import { ArrowLeft, Check, X, Zap } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    price: '$199',
    period: '/month',
    description: 'For small projects and testing',
    features: [
      { name: '1,000 API calls/month', included: true },
      { name: 'Rate benchmarking endpoints', included: true },
      { name: 'Availability endpoints', included: true },
      { name: 'Demand endpoints', included: true },
      { name: 'Workforce planning', included: false },
      { name: 'Priority support', included: false },
      { name: 'Custom data exports', included: false },
      { name: 'SLA guarantee', included: false },
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: '$499',
    period: '/month',
    description: 'For growing businesses',
    features: [
      { name: '10,000 API calls/month', included: true },
      { name: 'Rate benchmarking endpoints', included: true },
      { name: 'Availability endpoints', included: true },
      { name: 'Demand endpoints', included: true },
      { name: 'Workforce planning', included: true },
      { name: 'Priority support', included: true },
      { name: 'Custom data exports', included: false },
      { name: 'SLA guarantee', included: false },
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      { name: 'Unlimited API calls', included: true },
      { name: 'Rate benchmarking endpoints', included: true },
      { name: 'Availability endpoints', included: true },
      { name: 'Demand endpoints', included: true },
      { name: 'Workforce planning', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Custom data exports', included: true },
      { name: '99.9% SLA guarantee', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faq = [
  {
    question: 'What counts as an API call?',
    answer:
      'Each request to any endpoint counts as one API call. Failed requests due to client errors (4xx) still count, but server errors (5xx) do not count against your quota.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      'Yes, you can change your plan at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.',
  },
  {
    question: 'What happens if I exceed my monthly limit?',
    answer:
      'On Starter and Professional plans, additional API calls are billed at $0.05 per call. Enterprise plans have custom overage pricing.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes! All new accounts get 100 free API calls to explore the API. No credit card required to start.',
  },
  {
    question: 'What data is included in the API?',
    answer:
      'Our API provides anonymized, aggregated data from the Skillancer platform including freelance rates, talent availability, and skill demand signals. Individual freelancer data is never exposed.',
  },
  {
    question: 'Do you offer annual billing?',
    answer:
      'Yes, annual billing is available with a 20% discount. Contact our sales team for annual pricing.',
  },
];

export default function APIPricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link className="text-gray-500 hover:text-gray-700" href="/api-portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-semibold">API Pricing</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api-portal/docs">
              <Button size="sm" variant="outline">
                Documentation
              </Button>
            </Link>
            <Link href="/api-portal/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Start small and scale as you grow. All plans include access to our core data APIs with
            predictable pricing.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.popular ? 'border-2 border-blue-500 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                    <Zap className="mr-1 h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.name}
                      className={`flex items-center text-sm ${
                        feature.included ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {feature.included ? (
                        <Check className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
                      ) : (
                        <X className="mr-2 h-4 w-4 flex-shrink-0 text-gray-300" />
                      )}
                      {feature.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">Detailed Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-4 text-left font-medium text-gray-500">Feature</th>
                  <th className="px-4 py-4 text-center font-medium text-gray-500">Starter</th>
                  <th className="px-4 py-4 text-center font-medium text-gray-500">Professional</th>
                  <th className="px-4 py-4 text-center font-medium text-gray-500">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-4">Monthly API Calls</td>
                  <td className="px-4 py-4 text-center">1,000</td>
                  <td className="px-4 py-4 text-center">10,000</td>
                  <td className="px-4 py-4 text-center">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Rate Limit (per minute)</td>
                  <td className="px-4 py-4 text-center">60</td>
                  <td className="px-4 py-4 text-center">300</td>
                  <td className="px-4 py-4 text-center">1,000+</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">API Keys</td>
                  <td className="px-4 py-4 text-center">2</td>
                  <td className="px-4 py-4 text-center">10</td>
                  <td className="px-4 py-4 text-center">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Data Retention</td>
                  <td className="px-4 py-4 text-center">30 days</td>
                  <td className="px-4 py-4 text-center">90 days</td>
                  <td className="px-4 py-4 text-center">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Overage Rate</td>
                  <td className="px-4 py-4 text-center">$0.05/call</td>
                  <td className="px-4 py-4 text-center">$0.03/call</td>
                  <td className="px-4 py-4 text-center">Custom</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Support</td>
                  <td className="px-4 py-4 text-center">Email</td>
                  <td className="px-4 py-4 text-center">Priority Email</td>
                  <td className="px-4 py-4 text-center">Dedicated</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">SLA</td>
                  <td className="px-4 py-4 text-center">-</td>
                  <td className="px-4 py-4 text-center">99.5%</td>
                  <td className="px-4 py-4 text-center">99.9%</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Webhooks</td>
                  <td className="px-4 py-4 text-center">
                    <X className="mx-auto h-4 w-4 text-gray-300" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-green-500" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-green-500" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-4">Custom Exports</td>
                  <td className="px-4 py-4 text-center">
                    <X className="mx-auto h-4 w-4 text-gray-300" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <X className="mx-auto h-4 w-4 text-gray-300" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-green-500" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mx-auto max-w-3xl">
          <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h3>
          <div className="space-y-6">
            {faq.map((item, index) => (
              <div key={index} className="border-b pb-6">
                <h4 className="mb-2 font-medium text-gray-900">{item.question}</h4>
                <p className="text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 rounded-2xl bg-blue-50 p-12 text-center">
          <h3 className="mb-4 text-2xl font-bold text-gray-900">Ready to get started?</h3>
          <p className="mb-6 text-gray-600">
            Start with 100 free API calls. No credit card required.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/api-portal/dashboard">
              <Button size="lg">Get Free Trial</Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

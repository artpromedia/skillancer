import type { Metadata } from 'next';

import { PricingTable, CTASection } from '@/components/marketing';
import { generateMetadata as genMeta, generateFAQSchema } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Pricing - Simple, Transparent Plans',
  description: "Choose the plan that fits your needs. Start free, upgrade when you're ready.",
  path: '/pricing',
});

const faqs = [
  {
    question: 'Can I change plans later?',
    answer: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All paid plans come with a 14-day free trial. No credit card required.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and wire transfers for enterprise.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: "Absolutely. Cancel anytime with no questions asked. We'll prorate your refund.",
  },
];

export default function PricingPage() {
  const faqSchema = generateFAQSchema(faqs);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        type="application/ld+json"
      />

      <section className="pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">
              Simple, Transparent Pricing
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Start free and scale as you grow. No hidden fees, no surprises.
            </p>
          </div>
          <PricingTable />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{faq.question}</h3>
                <p className="text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        description="Contact our sales team for enterprise pricing and custom solutions."
        primaryCTA={{ label: 'Contact Sales', href: '/contact' }}
        title="Need a Custom Plan?"
        variant="dark"
      />
    </>
  );
}

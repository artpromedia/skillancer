'use client';

import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  name: string;
  id: string;
  faqs: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    name: 'Getting Started',
    id: 'getting-started',
    faqs: [
      {
        question: 'How do I create an account on Skillancer?',
        answer:
          'Creating an account is simple. Click the "Sign Up" button on the homepage, enter your email address, create a password, and follow the prompts to set up your profile. You can sign up as a freelancer, a client, or both.',
      },
      {
        question: 'Is Skillancer free to use?',
        answer:
          'Yes, creating an account and browsing the platform is completely free. We offer a free Starter plan that includes 5 proposals per month. For more features and lower service fees, you can upgrade to our Professional or Business plans.',
      },
      {
        question: "What's the difference between a freelancer and a client account?",
        answer:
          'Freelancers can create profiles showcasing their skills, browse jobs, and submit proposals. Clients can post jobs, browse freelancer profiles, and hire talent. You can use the same account for both purposes.',
      },
      {
        question: 'How do I complete my profile?',
        answer:
          'Navigate to your Dashboard and click on "Profile." Fill out your bio, add your skills, upload a professional photo, and include portfolio samples. A complete profile increases your visibility and chances of getting hired.',
      },
    ],
  },
  {
    name: 'For Freelancers',
    id: 'freelancers',
    faqs: [
      {
        question: 'How do I find jobs on Skillancer?',
        answer:
          'Browse our job listings using filters for category, budget, timeline, and required skills. You can also set up job alerts to receive notifications when relevant opportunities are posted. Our AI matching system will also recommend jobs based on your profile.',
      },
      {
        question: 'How do proposals work?',
        answer:
          "When you find a job you're interested in, submit a proposal explaining why you're the right fit. Include a cover letter, proposed timeline, and your rate. Clients review proposals and may invite you for an interview or hire you directly.",
      },
      {
        question: 'What are the service fees for freelancers?',
        answer:
          'Service fees depend on your plan. The Starter plan has a 20% fee, Professional has a 10% fee, and Business has a 5% fee. Fees are deducted from your earnings when payment is released.',
      },
      {
        question: 'How do I get paid?',
        answer:
          'Once a client approves your work, funds are released from escrow to your Skillancer balance. You can withdraw to your bank account, PayPal, or other supported payment methods. Withdrawals typically process within 1-3 business days.',
      },
      {
        question: 'How can I improve my profile visibility?',
        answer:
          'Complete your profile 100%, add portfolio samples, earn positive reviews, verify your identity, and maintain a high job success score. Upgrading to a Professional or Business plan also gives you priority in search results.',
      },
    ],
  },
  {
    name: 'For Clients',
    id: 'clients',
    faqs: [
      {
        question: 'How do I post a job?',
        answer:
          'Click "Post a Job" in your dashboard. Describe your project, required skills, budget, and timeline. You can make jobs public or invite specific freelancers. Our AI will suggest relevant freelancers based on your requirements.',
      },
      {
        question: 'How does payment protection work?',
        answer:
          'When you hire a freelancer, you fund the project through our escrow system. Funds are held securely until you approve the completed work. This protects both you and the freelancer throughout the engagement.',
      },
      {
        question: 'Can I hire freelancers for ongoing work?',
        answer:
          'Yes! You can hire freelancers for one-time projects or ongoing relationships. For long-term work, consider setting up recurring milestones or hourly contracts with weekly billing.',
      },
      {
        question: "What if I'm not satisfied with the work?",
        answer:
          "First, communicate with your freelancer to address concerns. If issues persist, you can request revisions. If you still can't resolve the issue, open a dispute through our resolution center and our team will help mediate.",
      },
      {
        question: "How do I verify a freelancer's skills?",
        answer:
          'Review their profile, portfolio, and client reviews. Check their job success score and verification badges. You can also conduct interviews and request skill tests before hiring.',
      },
    ],
  },
  {
    name: 'Payments & Billing',
    id: 'payments',
    faqs: [
      {
        question: 'What payment methods are accepted?',
        answer:
          'We accept major credit cards (Visa, Mastercard, American Express), bank transfers, PayPal, and select local payment methods depending on your country.',
      },
      {
        question: 'How does escrow work?',
        answer:
          'When a client funds a project, the money is held securely by Skillancer. Once the freelancer completes the work and the client approves it, funds are released to the freelancer. This protects both parties.',
      },
      {
        question: 'Are there any hidden fees?',
        answer:
          'No hidden fees. Our pricing is transparent. Freelancers pay a service fee based on their plan (5-20%). Clients may incur payment processing fees (typically 2.9% + $0.30) depending on the payment method.',
      },
      {
        question: 'How do I get a refund?',
        answer:
          "Refund policies depend on the stage of the project. If work hasn't started and funds are still in escrow, you can cancel and receive a full refund. For disputes after work has begun, our resolution team will review and determine appropriate refunds.",
      },
      {
        question: 'Do you provide invoices?',
        answer:
          'Yes, invoices are automatically generated for all transactions. You can download them from your billing history in the dashboard. We also provide annual summaries for tax purposes.',
      },
    ],
  },
  {
    name: 'Trust & Safety',
    id: 'trust',
    faqs: [
      {
        question: 'How does Skillancer verify users?',
        answer:
          'We offer multiple verification levels: email verification, phone verification, government ID verification, and professional credential verification. Verified users display badges on their profiles.',
      },
      {
        question: 'Is my personal information secure?',
        answer:
          'Yes, we use industry-standard encryption and security measures to protect your data. We never share your personal information with third parties without your consent. See our Privacy Policy for details.',
      },
      {
        question: 'What should I do if I encounter a scam?',
        answer:
          'Report suspicious activity immediately through our "Report" feature or contact our support team. Never share personal information, accept payments outside the platform, or work without escrow protection.',
      },
      {
        question: 'How are disputes handled?',
        answer:
          'If you have a dispute, first try to resolve it directly with the other party. If unsuccessful, open a case in our Resolution Center. Our team will review evidence from both sides and make a fair determination.',
      },
    ],
  },
  {
    name: 'Account & Settings',
    id: 'account',
    faqs: [
      {
        question: 'How do I reset my password?',
        answer:
          'Click "Login," then "Forgot Password." Enter your email address and we\'ll send you a link to reset your password. The link expires after 24 hours for security.',
      },
      {
        question: 'Can I delete my account?',
        answer:
          'Yes, you can delete your account from Settings > Account > Delete Account. Note that this action is permanent. Make sure to withdraw any remaining balance and download your data first.',
      },
      {
        question: 'How do I change my email address?',
        answer:
          'Go to Settings > Account > Email. Enter your new email address and verify it through the confirmation email we send. Your old email will remain active until the new one is verified.',
      },
      {
        question: 'How do I enable two-factor authentication?',
        answer:
          'Go to Settings > Security > Two-Factor Authentication. You can enable 2FA using an authenticator app or SMS. We highly recommend enabling 2FA for enhanced account security.',
      },
    ],
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const toggleItem = (categoryId: string, index: number) => {
    const key = `${categoryId}-${index}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter(
      (category) =>
        category.faqs.length > 0 && (activeCategory === 'all' || category.id === activeCategory)
    );

  const totalResults = filteredCategories.reduce((acc, category) => acc + category.faqs.length, 0);

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
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Find answers to common questions about Skillancer. Can't find what you're looking for?
            Contact our support team.
          </p>

          {/* Search */}
          <div className="mx-auto mt-10 max-w-xl">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-gray-300 py-4 pl-12 pr-4 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="Search for answers..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <p className="mt-4 text-sm text-gray-600">
                Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="border-b border-gray-200 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveCategory('all')}
            >
              All Topics
            </button>
            {faqCategories.map((category) => (
              <button
                key={category.id}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {filteredCategories.length > 0 ? (
            <div className="space-y-12">
              {filteredCategories.map((category) => (
                <div key={category.id}>
                  <h2 className="mb-6 text-2xl font-bold text-gray-900">{category.name}</h2>
                  <div className="space-y-4">
                    {category.faqs.map((faq, index) => {
                      const isOpen = openItems[`${category.id}-${index}`];
                      return (
                        <div
                          key={index}
                          className="overflow-hidden rounded-xl border border-gray-200"
                        >
                          <button
                            className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-gray-50"
                            onClick={() => toggleItem(category.id, index)}
                          >
                            <span className="pr-4 text-base font-medium text-gray-900">
                              {faq.question}
                            </span>
                            <ChevronDownIcon
                              className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="px-6 pb-5">
                              <p className="leading-relaxed text-gray-600">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-600">
                No results found for "{searchQuery}". Try a different search term.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Still Need Help */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900">Still have questions?</h2>
          <p className="mt-4 text-lg text-gray-600">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
              href="/contact"
            >
              Contact Support
            </Link>
            <a
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              href="mailto:support@skillancer.com"
            >
              Email Us
            </a>
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

'use client';

import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
}

const initialFormData: ContactFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  subject: '',
  message: '',
};

const subjectOptions = [
  { value: '', label: 'Select a topic' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'support', label: 'Technical Support' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'enterprise', label: 'Enterprise Sales' },
  { value: 'press', label: 'Press & Media' },
  { value: 'feedback', label: 'Product Feedback' },
  { value: 'other', label: 'Other' },
];

const contactMethods = [
  {
    name: 'Email',
    description: "Send us an email and we'll respond within 24 hours.",
    icon: EnvelopeIcon,
    contact: 'support@skillancer.com',
    href: 'mailto:support@skillancer.com',
  },
  {
    name: 'Phone',
    description: 'Available Monday-Friday, 9am-6pm EST.',
    icon: PhoneIcon,
    contact: '+1 (555) 123-4567',
    href: 'tel:+15551234567',
  },
  {
    name: 'Live Chat',
    description: 'Chat with our support team in real-time.',
    icon: ChatBubbleLeftRightIcon,
    contact: 'Start a conversation',
    href: '#chat',
  },
  {
    name: 'Office',
    description: 'Visit us at our headquarters.',
    icon: MapPinIcon,
    contact: '123 Innovation Way, Tech City, TC 12345',
    href: 'https://maps.google.com',
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitted(true);
      setFormData(initialFormData);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Get in Touch
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon
            as possible.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {contactMethods.map((method) => (
              <div
                key={method.name}
                className="relative rounded-2xl border border-gray-200 p-8 transition-all hover:border-green-300 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <method.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{method.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{method.description}</p>
                <a
                  className="mt-4 block text-sm font-medium text-green-600 hover:text-green-500"
                  href={method.href}
                >
                  {method.contact}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16">
            {/* Form Info */}
            <div className="mb-12 lg:mb-0">
              <h2 className="text-3xl font-bold text-gray-900">Send us a message</h2>
              <p className="mt-4 text-lg text-gray-600">
                Fill out the form and our team will get back to you within 24 hours.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 font-bold text-white">
                      1
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Fill out the form</h3>
                    <p className="mt-1 text-gray-600">
                      Provide your contact information and describe your inquiry.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 font-bold text-white">
                      2
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">We review your message</h3>
                    <p className="mt-1 text-gray-600">
                      Our team reviews your inquiry and routes it to the right department.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 font-bold text-white">
                      3
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Get a response</h3>
                    <p className="mt-1 text-gray-600">
                      Receive a personalized response within 24 hours.
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ Link */}
              <div className="mt-12 rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">Looking for quick answers?</h3>
                <p className="mt-2 text-gray-600">
                  Check out our FAQ section for answers to common questions.
                </p>
                <Link
                  className="mt-4 inline-flex items-center font-medium text-green-600 hover:text-green-500"
                  href="/faq"
                >
                  Visit FAQ
                  <span className="ml-2">→</span>
                </Link>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-2xl bg-white p-8 shadow-lg">
              {isSubmitted ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-8 w-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-gray-900">Message sent!</h3>
                  <p className="mt-4 text-gray-600">
                    Thank you for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <button
                    className="mt-8 font-medium text-green-600 hover:text-green-500"
                    onClick={() => setIsSubmitted(false)}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
                  )}

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor="firstName"
                      >
                        First name *
                      </label>
                      <input
                        required
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        id="firstName"
                        name="firstName"
                        placeholder="John"
                        type="text"
                        value={formData.firstName}
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700" htmlFor="lastName">
                        Last name *
                      </label>
                      <input
                        required
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        id="lastName"
                        name="lastName"
                        placeholder="Doe"
                        type="text"
                        value={formData.lastName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="email">
                      Email address *
                    </label>
                    <input
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                      id="email"
                      name="email"
                      placeholder="john@example.com"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700" htmlFor="phone">
                        Phone number
                      </label>
                      <input
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        id="phone"
                        name="phone"
                        placeholder="+1 (555) 123-4567"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700" htmlFor="company">
                        Company
                      </label>
                      <input
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        id="company"
                        name="company"
                        placeholder="Acme Inc."
                        type="text"
                        value={formData.company}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="subject">
                      Subject *
                    </label>
                    <select
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-green-500 focus:ring-green-500"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                    >
                      {subjectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="message">
                      Message *
                    </label>
                    <textarea
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                      id="message"
                      name="message"
                      placeholder="How can we help you?"
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <button
                      className="w-full rounded-lg bg-green-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              fill="currentColor"
                            />
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        'Send Message'
                      )}
                    </button>
                  </div>

                  <p className="text-center text-xs text-gray-500">
                    By submitting this form, you agree to our{' '}
                    <Link className="text-green-600 hover:text-green-500" href="/privacy">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Map Section (Placeholder) */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-96 items-center justify-center rounded-2xl bg-gray-200">
            <div className="text-center">
              <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-600">123 Innovation Way, Tech City, TC 12345</p>
              <a
                className="mt-2 inline-block font-medium text-green-600 hover:text-green-500"
                href="https://maps.google.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Google Maps
              </a>
            </div>
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
            <Link className="text-gray-600 hover:text-green-600" href="/faq">
              FAQ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

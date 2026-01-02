'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  const lastUpdated = 'December 29, 2024';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-gray-600">Last updated: {lastUpdated}</p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg prose-green max-w-none">
          {/* Introduction */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Introduction</h2>
            <p className="leading-relaxed text-gray-600">
              Skillancer ("we," "our," or "us") is committed to protecting your privacy. This
              Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our platform, including our website, mobile applications, and related
              services (collectively, the "Platform").
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              Please read this privacy policy carefully. By using the Platform, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Information We Collect</h2>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Personal Information</h3>
            <p className="leading-relaxed text-gray-600">
              When you register for an account, we collect:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-gray-600">
              <li>Name and email address</li>
              <li>Profile information (photo, bio, skills, portfolio)</li>
              <li>Payment and billing information</li>
              <li>Government-issued ID for verification purposes</li>
              <li>Business information for clients</li>
            </ul>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Usage Information</h3>
            <p className="leading-relaxed text-gray-600">
              We automatically collect certain information when you use the Platform:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-gray-600">
              <li>Device information (type, operating system, browser)</li>
              <li>IP address and location data</li>
              <li>Usage patterns and interaction data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Communication Data</h3>
            <p className="leading-relaxed text-gray-600">We collect and store:</p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-gray-600">
              <li>Messages between users on the Platform</li>
              <li>Customer support communications</li>
              <li>Feedback and survey responses</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">How We Use Your Information</h2>
            <p className="leading-relaxed text-gray-600">We use the information we collect to:</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Provide, maintain, and improve our Platform</li>
              <li>Process transactions and send related information</li>
              <li>Verify your identity and prevent fraud</li>
              <li>Facilitate matching between freelancers and clients</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Personalize and improve your experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Information Sharing</h2>
            <p className="leading-relaxed text-gray-600">
              We may share your information in the following circumstances:
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">With Other Users</h3>
            <p className="leading-relaxed text-gray-600">
              Your public profile information is visible to other users. When you apply for jobs or
              hire freelancers, relevant information is shared to facilitate the engagement.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Service Providers</h3>
            <p className="leading-relaxed text-gray-600">
              We share information with third-party vendors who provide services such as payment
              processing, data analysis, email delivery, hosting, customer service, and marketing
              assistance.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Legal Requirements</h3>
            <p className="leading-relaxed text-gray-600">
              We may disclose your information if required by law, regulation, or legal process, or
              if we believe disclosure is necessary to protect the rights, property, or safety of
              Skillancer, our users, or others.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Business Transfers</h3>
            <p className="leading-relaxed text-gray-600">
              In connection with any merger, sale of company assets, or acquisition, your
              information may be transferred to the new owner.
            </p>
          </section>

          {/* Data Security */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Data Security</h2>
            <p className="leading-relaxed text-gray-600">
              We implement appropriate technical and organizational security measures to protect
              your personal information, including:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication measures</li>
              <li>Secure development practices</li>
              <li>Employee training on data protection</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              However, no method of transmission over the Internet or electronic storage is 100%
              secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Your Rights */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Your Rights</h2>
            <p className="leading-relaxed text-gray-600">
              Depending on your location, you may have the following rights regarding your personal
              data:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>
                <strong>Access:</strong> Request a copy of the personal data we hold about you
              </li>
              <li>
                <strong>Rectification:</strong> Request correction of inaccurate or incomplete data
              </li>
              <li>
                <strong>Erasure:</strong> Request deletion of your personal data
              </li>
              <li>
                <strong>Restriction:</strong> Request restriction of processing of your data
              </li>
              <li>
                <strong>Portability:</strong> Request transfer of your data to another service
              </li>
              <li>
                <strong>Objection:</strong> Object to certain types of processing
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Withdraw consent where processing is based on
                consent
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              To exercise these rights, please contact us at{' '}
              <a
                className="text-green-600 hover:text-green-700"
                href="mailto:privacy@skillancer.com"
              >
                privacy@skillancer.com
              </a>
            </p>
          </section>

          {/* Cookies */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              Cookies and Tracking Technologies
            </h2>
            <p className="leading-relaxed text-gray-600">
              We use cookies and similar tracking technologies to collect and store information.
              Cookies are small data files stored on your device.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">Types of cookies we use:</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>
                <strong>Essential Cookies:</strong> Required for the Platform to function
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how users interact with the
                Platform
              </li>
              <li>
                <strong>Preference Cookies:</strong> Remember your settings and preferences
              </li>
              <li>
                <strong>Marketing Cookies:</strong> Used to deliver relevant advertisements
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Data Retention</h2>
            <p className="leading-relaxed text-gray-600">
              We retain your personal information for as long as necessary to fulfill the purposes
              for which it was collected, including to satisfy any legal, accounting, or reporting
              requirements.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              When you delete your account, we will delete or anonymize your personal information
              within 30 days, except where we are required to retain it for legal purposes.
            </p>
          </section>

          {/* International Transfers */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">International Data Transfers</h2>
            <p className="leading-relaxed text-gray-600">
              Your information may be transferred to and processed in countries other than your
              country of residence. These countries may have different data protection laws than
              your country.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              We take appropriate safeguards to ensure that your personal information remains
              protected in accordance with this Privacy Policy and applicable laws.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Children's Privacy</h2>
            <p className="leading-relaxed text-gray-600">
              The Platform is not intended for children under 18 years of age. We do not knowingly
              collect personal information from children under 18. If we learn we have collected
              personal information from a child under 18, we will delete that information.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Changes to This Policy</h2>
            <p className="leading-relaxed text-gray-600">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              We encourage you to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          {/* Contact Us */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Contact Us</h2>
            <p className="leading-relaxed text-gray-600">
              If you have any questions about this Privacy Policy or our privacy practices, please
              contact us:
            </p>
            <div className="mt-4 rounded-lg bg-gray-50 p-6">
              <p className="font-medium text-gray-800">Skillancer Privacy Team</p>
              <p className="mt-2 text-gray-600">
                Email:{' '}
                <a
                  className="text-green-600 hover:text-green-700"
                  href="mailto:privacy@skillancer.com"
                >
                  privacy@skillancer.com
                </a>
              </p>
              <p className="mt-1 text-gray-600">Address: 123 Innovation Way, Tech City, TC 12345</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact Us
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

'use client';

import Link from 'next/link';

export default function TermsOfServicePage() {
  const lastUpdated = 'December 29, 2024';
  const effectiveDate = 'January 1, 2025';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-gray-600">Last updated: {lastUpdated}</p>
          <p className="text-gray-600">Effective date: {effectiveDate}</p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg prose-green max-w-none">
          {/* Introduction */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">1. Agreement to Terms</h2>
            <p className="leading-relaxed text-gray-600">
              These Terms of Service ("Terms") constitute a legally binding agreement between you
              and Skillancer Inc. ("Skillancer," "we," "us," or "our") governing your access to and
              use of the Skillancer platform, including our website, mobile applications, and all
              related services (collectively, the "Platform").
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              By accessing or using the Platform, you agree to be bound by these Terms. If you do
              not agree to these Terms, you may not access or use the Platform.
            </p>
          </section>

          {/* Eligibility */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">2. Eligibility</h2>
            <p className="leading-relaxed text-gray-600">To use the Platform, you must:</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Be at least 18 years old</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Not be prohibited from using the Platform under applicable law</li>
              <li>Not have been previously suspended or removed from the Platform</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              By using the Platform, you represent and warrant that you meet all eligibility
              requirements.
            </p>
          </section>

          {/* Account Registration */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">3. Account Registration</h2>
            <p className="leading-relaxed text-gray-600">
              To access certain features of the Platform, you must create an account. When you
              register:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>You agree to provide accurate, current, and complete information</li>
              <li>
                You are responsible for maintaining the confidentiality of your account credentials
              </li>
              <li>You are responsible for all activities that occur under your account</li>
              <li>You agree to notify us immediately of any unauthorized access</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              We reserve the right to suspend or terminate your account if any information provided
              is inaccurate, false, or outdated.
            </p>
          </section>

          {/* Platform Description */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">4. Platform Description</h2>
            <p className="leading-relaxed text-gray-600">
              Skillancer is a marketplace platform that connects freelancers with clients seeking
              professional services. We provide:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>A venue for clients to post projects and find freelancers</li>
              <li>A venue for freelancers to showcase their skills and find work</li>
              <li>Tools for communication, project management, and collaboration</li>
              <li>Payment processing and escrow services</li>
              <li>AI-powered matching and recommendations</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              Skillancer is not a party to any agreement between clients and freelancers. We act
              solely as an intermediary to facilitate connections.
            </p>
          </section>

          {/* User Conduct */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">5. User Conduct</h2>
            <p className="leading-relaxed text-gray-600">You agree not to:</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Circumvent platform fees or payment processes</li>
              <li>Use automated means to access the Platform without permission</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of the Platform</li>
              <li>Engage in any activity that is harmful to Skillancer or its users</li>
            </ul>
          </section>

          {/* Freelancer Terms */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">6. Freelancer Terms</h2>
            <p className="leading-relaxed text-gray-600">
              As a freelancer on the Platform, you agree to:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Accurately represent your skills, experience, and qualifications</li>
              <li>Deliver work that meets agreed-upon specifications and deadlines</li>
              <li>Communicate professionally and respond promptly to clients</li>
              <li>Maintain confidentiality of client information</li>
              <li>Not solicit clients to conduct business outside the Platform</li>
              <li>Comply with all applicable tax obligations</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              Freelancers are independent contractors, not employees of Skillancer. You are solely
              responsible for your work product and compliance with applicable laws.
            </p>
          </section>

          {/* Client Terms */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">7. Client Terms</h2>
            <p className="leading-relaxed text-gray-600">
              As a client on the Platform, you agree to:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Provide clear and accurate project descriptions</li>
              <li>Communicate requirements and expectations clearly</li>
              <li>Provide timely feedback and approvals</li>
              <li>Pay for completed work as agreed</li>
              <li>Treat freelancers with respect and professionalism</li>
              <li>Not request illegal, unethical, or harmful work</li>
            </ul>
          </section>

          {/* Fees and Payments */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">8. Fees and Payments</h2>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Service Fees</h3>
            <p className="leading-relaxed text-gray-600">
              Skillancer charges service fees for the use of the Platform. Current fee schedules are
              available on our pricing page. We reserve the right to change fees with reasonable
              notice.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Payment Processing</h3>
            <p className="leading-relaxed text-gray-600">
              All payments are processed through our secure payment system. Clients must fund
              projects before work begins. Freelancers receive payment after successful completion
              and client approval.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Escrow Protection</h3>
            <p className="leading-relaxed text-gray-600">
              Skillancer holds funds in escrow to protect both parties. Funds are released to
              freelancers upon project completion and client approval.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Taxes</h3>
            <p className="leading-relaxed text-gray-600">
              You are responsible for paying all applicable taxes related to your use of the
              Platform. Skillancer may collect and remit taxes as required by law.
            </p>
          </section>

          {/* Intellectual Property */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">9. Intellectual Property</h2>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Platform Content</h3>
            <p className="leading-relaxed text-gray-600">
              The Platform and its content, features, and functionality are owned by Skillancer and
              protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">User Content</h3>
            <p className="leading-relaxed text-gray-600">
              You retain ownership of content you create and post on the Platform. By posting
              content, you grant Skillancer a non-exclusive, worldwide, royalty-free license to use,
              display, and distribute your content in connection with the Platform.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold text-gray-800">Work Product</h3>
            <p className="leading-relaxed text-gray-600">
              Unless otherwise agreed in writing, intellectual property rights in work product are
              transferred to the client upon full payment. Freelancers may retain rights to use work
              samples for portfolio purposes unless prohibited by the contract.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">10. Dispute Resolution</h2>
            <p className="leading-relaxed text-gray-600">
              Skillancer provides a dispute resolution process for conflicts between users. If a
              dispute arises:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>First, attempt to resolve the issue directly with the other party</li>
              <li>If unsuccessful, open a dispute through the Platform</li>
              <li>Provide all relevant documentation and communications</li>
              <li>Skillancer will review and make a determination</li>
            </ul>
            <p className="mt-4 leading-relaxed text-gray-600">
              Skillancer's decisions in disputes are final and binding. We reserve the right to hold
              funds during dispute resolution.
            </p>
          </section>

          {/* Disclaimers */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">11. Disclaimers</h2>
            <p className="leading-relaxed text-gray-600">
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED,
              SECURE, OR ERROR-FREE.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              SKILLANCER DOES NOT ENDORSE OR GUARANTEE THE QUALITY, ACCURACY, OR LEGALITY OF ANY
              USER CONTENT OR SERVICES OFFERED ON THE PLATFORM.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">12. Limitation of Liability</h2>
            <p className="leading-relaxed text-gray-600">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SKILLANCER SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM YOUR USE OF THE PLATFORM SHALL NOT
              EXCEED THE GREATER OF (A) THE FEES YOU PAID TO SKILLANCER IN THE 12 MONTHS PRIOR TO
              THE CLAIM, OR (B) $100.
            </p>
          </section>

          {/* Indemnification */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">13. Indemnification</h2>
            <p className="leading-relaxed text-gray-600">
              You agree to indemnify, defend, and hold harmless Skillancer and its officers,
              directors, employees, and agents from any claims, damages, losses, and expenses
              (including reasonable attorney's fees) arising from:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Any content you post or submit to the Platform</li>
            </ul>
          </section>

          {/* Termination */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">14. Termination</h2>
            <p className="leading-relaxed text-gray-600">
              You may terminate your account at any time by following the account deletion process.
              Skillancer may suspend or terminate your account for any reason, including violation
              of these Terms.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              Upon termination, your right to use the Platform ceases immediately. Provisions that
              by their nature should survive termination will survive, including ownership
              provisions, warranty disclaimers, and limitations of liability.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">15. Governing Law</h2>
            <p className="leading-relaxed text-gray-600">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Delaware, without regard to its conflict of law provisions. Any legal action
              or proceeding shall be brought exclusively in the courts located in Delaware.
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">16. Changes to Terms</h2>
            <p className="leading-relaxed text-gray-600">
              We reserve the right to modify these Terms at any time. We will provide notice of
              material changes by posting the updated Terms on the Platform and updating the "Last
              updated" date. Your continued use of the Platform after changes become effective
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          {/* Severability */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">17. Severability</h2>
            <p className="leading-relaxed text-gray-600">
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be modified to reflect the parties' original intent or eliminated to
              the minimum extent necessary. The remaining provisions shall continue in full force
              and effect.
            </p>
          </section>

          {/* Entire Agreement */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">18. Entire Agreement</h2>
            <p className="leading-relaxed text-gray-600">
              These Terms, together with our Privacy Policy and any other policies referenced
              herein, constitute the entire agreement between you and Skillancer regarding your use
              of the Platform.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">19. Contact Us</h2>
            <p className="leading-relaxed text-gray-600">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="mt-4 rounded-lg bg-gray-50 p-6">
              <p className="font-medium text-gray-800">Skillancer Legal Team</p>
              <p className="mt-2 text-gray-600">
                Email:{' '}
                <a
                  className="text-green-600 hover:text-green-700"
                  href="mailto:legal@skillancer.com"
                >
                  legal@skillancer.com
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
            <Link className="text-gray-600 hover:text-green-600" href="/privacy">
              Privacy Policy
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

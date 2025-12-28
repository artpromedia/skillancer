import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Privacy Policy',
  description: 'Learn how Skillancer collects, uses, and protects your personal information.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="pb-20 pt-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-4xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mb-8 text-slate-500">Last updated: December 28, 2025</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly, including name, email, payment details, and
            profile information. We also collect usage data and device information automatically.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use your information to provide and improve our services, process payments,
            communicate with you, and ensure platform security.
          </p>

          <h2>3. Information Sharing</h2>
          <p>
            We share information with service providers, when required by law, and with your
            consent. We do not sell your personal information.
          </p>

          <h2>4. Data Security</h2>
          <p>
            We implement industry-standard security measures including encryption, access controls,
            and regular security audits.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            You have the right to access, correct, delete, or export your data. Contact
            privacy@skillancer.com to exercise these rights.
          </p>

          <h2>6. Cookies</h2>
          <p>
            We use cookies for authentication, preferences, and analytics. You can manage cookie
            preferences in your browser settings.
          </p>

          <h2>7. International Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside your own. We ensure
            appropriate safeguards are in place.
          </p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>
            Our service is not intended for users under 18. We do not knowingly collect data from
            children.
          </p>

          <h2>9. Contact Us</h2>
          <p>For privacy-related inquiries, contact privacy@skillancer.com.</p>
        </div>
      </div>
    </div>
  );
}

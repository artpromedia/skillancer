import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Terms of Service',
  description:
    'Read our terms of service to understand your rights and responsibilities when using Skillancer.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <div className="pb-20 pt-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-4xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mb-8 text-slate-500">Last updated: December 28, 2025</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Skillancer, you agree to be bound by these Terms of Service and
            all applicable laws and regulations.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Skillancer provides a platform connecting freelancers with clients, offering secure
            workspaces, skill verification, and project management tools.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities under your account.
          </p>

          <h2>4. Acceptable Use</h2>
          <p>
            You agree not to use the service for any unlawful purpose or in violation of these
            terms. Prohibited activities include fraud, harassment, and intellectual property
            infringement.
          </p>

          <h2>5. Payment Terms</h2>
          <p>
            Freelancers and clients agree to the payment terms established for each project.
            Skillancer charges a platform fee as disclosed in our pricing.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            Work product ownership is determined by the agreement between freelancer and client.
            Skillancer does not claim ownership of user-generated content.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            Skillancer is provided &quot;as is&quot; without warranties. We are not liable for any
            indirect, incidental, or consequential damages.
          </p>

          <h2>8. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. Continued use of the service constitutes
            acceptance of modified terms.
          </p>

          <h2>9. Contact</h2>
          <p>Questions about these terms should be directed to legal@skillancer.com.</p>
        </div>
      </div>
    </div>
  );
}

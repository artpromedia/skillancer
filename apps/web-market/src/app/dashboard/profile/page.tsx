/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { MissingVerificationAlert, ProfileImprovementTips } from '@/components/profile';
import { SkillVerificationJourney } from '@/components/skills';
import {
  calculateProfileCompleteness,
  getFreelancerByUsername,
  getFreelancerPortfolio,
  getFreelancerSkills,
  getFreelancerWorkHistory,
} from '@/lib/api/freelancers';

import { ProfileEditForm } from './components/profile-edit-form';

import type { Metadata } from 'next';

import { getAuthSession } from '@/lib/auth';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Edit Profile | Skillancer',
  description: 'Manage your freelancer profile, bio, hourly rate, and availability settings.',
};

// ============================================================================
// Loading States
// ============================================================================

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-muted h-6 w-32 rounded" />
      <div className="bg-muted h-24 rounded-lg" />
    </div>
  );
}

// ============================================================================
// Profile Tips Loader
// ============================================================================

async function ProfileTipsLoader({ username }: Readonly<{ username: string }>) {
  try {
    const [profile, skills, portfolio, workHistory] = await Promise.all([
      getFreelancerByUsername(username),
      getFreelancerSkills(username),
      getFreelancerPortfolio(username),
      getFreelancerWorkHistory(username),
    ]);

    const completeness = calculateProfileCompleteness(profile, skills, portfolio, workHistory);

    // Transform suggestions into improvement tips format
    const tips = completeness.suggestions.map((suggestion, index) => ({
      id: `tip-${index}`,
      title: suggestion,
      description: getDescriptionForSuggestion(suggestion),
      priority: index < 3 ? ('high' as const) : ('medium' as const),
      action: {
        label: 'Fix Now',
        href: getHrefForSuggestion(suggestion),
      },
    }));

    return <ProfileImprovementTips completeness={completeness.percentage} tips={tips} />;
  } catch {
    return null;
  }
}

function getDescriptionForSuggestion(suggestion: string): string {
  const descriptions: Record<string, string> = {
    'Add a professional profile photo': 'Profiles with photos get 14x more views',
    'Add a professional title (at least 10 characters)':
      'A clear title helps clients understand your expertise',
    'Write a detailed bio (at least 100 characters)':
      'A comprehensive bio builds trust and showcases your personality',
    'Add at least 3 skills': 'Skills help you appear in relevant searches',
    'Add at least one portfolio item': 'Portfolio items showcase your best work',
    'Add your work experience': 'Work history demonstrates your professional background',
    'Set your hourly rate': 'Help clients understand your pricing upfront',
    'Complete identity verification for more trust': 'Verified profiles earn 2x more on average',
  };
  return descriptions[suggestion] ?? 'Improve your profile visibility and trustworthiness';
}

function getHrefForSuggestion(suggestion: string): string {
  if (suggestion.includes('photo')) return '/dashboard/profile#avatar';
  if (suggestion.includes('title')) return '/dashboard/profile#title';
  if (suggestion.includes('bio')) return '/dashboard/profile#bio';
  if (suggestion.includes('skills')) return '/dashboard/skills';
  if (suggestion.includes('portfolio')) return '/dashboard/portfolio';
  if (suggestion.includes('work')) return '/dashboard/work-history';
  if (suggestion.includes('rate')) return '/dashboard/profile#rate';
  if (suggestion.includes('verification')) return '/dashboard/verification';
  return '/dashboard/profile';
}

// ============================================================================
// Page
// ============================================================================

export default async function DashboardProfilePage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/profile');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your public profile information</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <ProfileEditForm userId={session.userId} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Profile Improvement Tips */}
            <Suspense fallback={<SectionSkeleton />}>
              <ProfileTipsLoader username={session.username ?? session.userId} />
            </Suspense>

            {/* Verification Alert */}
            <MissingVerificationAlert
              missingVerifications={['identity', 'skills']}
              onVerifyClick={(type) => {
                globalThis.location.href =
                  type === 'identity' ? '/dashboard/verification' : '/dashboard/skills';
              }}
            />

            {/* Skill Verification Journey */}
            <div className="rounded-xl border bg-white p-6">
              <h3 className="mb-4 font-semibold">Skill Verification</h3>
              <SkillVerificationJourney skillProgress={[]} variant="compact" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

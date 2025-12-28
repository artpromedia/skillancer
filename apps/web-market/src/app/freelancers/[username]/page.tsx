/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { notFound } from 'next/navigation';
import { Suspense } from 'react';


import {
  AvailabilityWidget,
  CredentialShowcase,
  PortfolioGallery,
  ProfileHeader,
  ReviewsSection,
  SkillsSection,
  VerificationBadges,
  WorkHistory,
} from '@/components/profile';
import {
  getFreelancerByUsername,
  getFreelancerCredentials,
  getFreelancerPortfolio,
  getFreelancerReviews,
  getFreelancerSkills,
} from '@/lib/api/freelancers';

import type { Metadata } from 'next';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ username: string }>;
}

// ============================================================================
// Metadata Generation
// ============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;

  try {
    const profile = await getFreelancerByUsername(username);

    return {
      title: `${profile.displayName} - ${profile.title} | Skillancer`,
      description:
        profile.bio?.slice(0, 160) ??
        `Hire ${profile.displayName}, a top freelance ${profile.title} on Skillancer.`,
      openGraph: {
        title: `${profile.displayName} - ${profile.title}`,
        description:
          profile.bio?.slice(0, 160) ??
          `Hire ${profile.displayName}, a top freelance ${profile.title} on Skillancer.`,
        images: profile.avatarUrl
          ? [{ url: profile.avatarUrl, width: 400, height: 400, alt: profile.displayName }]
          : [],
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title: `${profile.displayName} - ${profile.title}`,
        description:
          profile.bio?.slice(0, 160) ??
          `Hire ${profile.displayName}, a top freelance ${profile.title} on Skillancer.`,
        images: profile.avatarUrl ? [profile.avatarUrl] : [],
      },
      alternates: {
        canonical: `/freelancers/${username}`,
      },
    };
  } catch {
    return {
      title: 'Freelancer Profile | Skillancer',
      description: 'View freelancer profile on Skillancer.',
    };
  }
}

// ============================================================================
// Structured Data
// ============================================================================

interface PersonSchemaProps {
  profile: Awaited<ReturnType<typeof getFreelancerByUsername>>;
}

function PersonSchema({ profile }: Readonly<PersonSchemaProps>) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.displayName,
    jobTitle: profile.title,
    description: profile.bio,
    image: profile.avatarUrl,
    url: `https://skillancer.com/freelancers/${profile.username}`,
    address: profile.location
      ? {
          '@type': 'PostalAddress',
          addressLocality: profile.location.city,
          addressCountry: profile.location.country,
        }
      : undefined,
    sameAs: [
      profile.socialLinks?.linkedIn,
      profile.socialLinks?.github,
      profile.socialLinks?.twitter,
      profile.socialLinks?.website,
    ].filter(Boolean),
    makesOffer: {
      '@type': 'Offer',
      priceSpecification: profile.hourlyRate
        ? {
            '@type': 'UnitPriceSpecification',
            price: profile.hourlyRate,
            priceCurrency: 'USD',
            unitCode: 'HUR',
          }
        : undefined,
    },
    aggregateRating:
      profile.stats.totalReviews > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: profile.stats.avgRating,
            reviewCount: profile.stats.totalReviews,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  );
}

// ============================================================================
// Page Sections
// ============================================================================

async function SkillsSectionLoader({ username }: Readonly<{ username: string }>) {
  const skills = await getFreelancerSkills(username);
  return <SkillsSection skills={skills} />;
}

async function PortfolioLoader({ username }: Readonly<{ username: string }>) {
  const portfolio = await getFreelancerPortfolio(username, { limit: 6 });
  return <PortfolioGallery items={portfolio.items} profileUrl={`/freelancers/${username}`} />;
}

async function ReviewsLoader({ username }: Readonly<{ username: string }>) {
  const reviews = await getFreelancerReviews(username, { limit: 5 });
  return (
    <ReviewsSection
      profileUrl={`/freelancers/${username}`}
      reviews={reviews.reviews}
      summary={{
        avgRating: reviews.avgRating,
        totalReviews: reviews.total,
        breakdown: reviews.breakdown,
      }}
    />
  );
}

async function CredentialsLoader({ username }: Readonly<{ username: string }>) {
  const credentials = await getFreelancerCredentials(username);
  return <CredentialShowcase credentials={credentials} />;
}

// ============================================================================
// Loading States
// ============================================================================

function SectionSkeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-muted h-6 w-32 rounded" />
      {Array.from({ length: rows }, (_, i) => `skeleton-row-${i}`).map((id) => (
        <div key={id} className="bg-muted h-16 rounded-lg" />
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function FreelancerProfilePage({ params }: Readonly<PageProps>) {
  const { username } = await params;

  let profile: Awaited<ReturnType<typeof getFreelancerByUsername>>;

  try {
    profile = await getFreelancerByUsername(username);
  } catch {
    notFound();
  }

  return (
    <>
      <PersonSchema profile={profile} />

      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Profile Header */}
        <section className="border-b bg-white">
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <ProfileHeader
              profile={{
                displayName: profile.displayName,
                title: profile.title,
                avatarUrl: profile.avatarUrl,
                location: profile.location
                  ? `${profile.location.city}, ${profile.location.country}`
                  : undefined,
                memberSince: profile.memberSince,
                isOnline: profile.isOnline,
                lastSeen: profile.lastSeen,
                bio: profile.bio,
                hourlyRate: profile.hourlyRate,
                verificationLevel: profile.verification.identityTier,
              }}
              stats={{
                avgRating: profile.stats.avgRating,
                totalReviews: profile.stats.totalReviews,
                totalJobs: profile.stats.totalJobs,
                jobSuccessRate: profile.stats.jobSuccessRate,
                totalEarnings: profile.stats.totalEarnings,
                responseTime: profile.stats.responseTime,
              }}
            />
          </div>
        </section>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left column - Main content */}
            <div className="space-y-8 lg:col-span-2">
              {/* Verification Badges */}
              <section>
                <h2 className="mb-4 text-lg font-semibold">Verification & Trust</h2>
                <VerificationBadges verification={profile.verification} />
              </section>

              {/* Skills */}
              <section>
                <Suspense fallback={<SectionSkeleton />}>
                  <SkillsSectionLoader username={username} />
                </Suspense>
              </section>

              {/* Portfolio */}
              <section>
                <Suspense fallback={<SectionSkeleton rows={2} />}>
                  <PortfolioLoader username={username} />
                </Suspense>
              </section>

              {/* Work History */}
              {profile.workHistory && profile.workHistory.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">Work History</h2>
                  <WorkHistory items={profile.workHistory} />
                </section>
              )}

              {/* Reviews */}
              <section>
                <Suspense fallback={<SectionSkeleton rows={4} />}>
                  <ReviewsLoader username={username} />
                </Suspense>
              </section>
            </div>

            {/* Right column - Sidebar */}
            <aside className="space-y-6">
              {/* Availability */}
              <AvailabilityWidget
                hoursPerWeek={profile.availability.hoursPerWeek}
                preferredSchedule={profile.availability.preferredSchedule}
                status={profile.availability.status}
                timezone={profile.availability.timezone}
              />

              {/* Credentials */}
              <section>
                <Suspense fallback={<SectionSkeleton rows={2} />}>
                  <CredentialsLoader username={username} />
                </Suspense>
              </section>

              {/* Social Links */}
              {profile.socialLinks && Object.values(profile.socialLinks).some(Boolean) && (
                <div className="rounded-lg border bg-white p-4">
                  <h3 className="mb-3 font-semibold">Connect</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.socialLinks.linkedIn && (
                      <a
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                        href={profile.socialLinks.linkedIn}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        LinkedIn
                      </a>
                    )}
                    {profile.socialLinks.github && (
                      <a
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                        href={profile.socialLinks.github}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        GitHub
                      </a>
                    )}
                    {profile.socialLinks.twitter && (
                      <a
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                        href={profile.socialLinks.twitter}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Twitter
                      </a>
                    )}
                    {profile.socialLinks.website && (
                      <a
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                        href={profile.socialLinks.website}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

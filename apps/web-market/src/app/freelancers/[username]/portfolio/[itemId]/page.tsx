/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Badge, Button, Card, CardContent } from '@skillancer/ui';
import { ArrowLeft, Calendar, ExternalLink, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getFreelancerByUsername, getPortfolioItem } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ username: string; itemId: string }>;
}

// ============================================================================
// Metadata Generation
// ============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, itemId } = await params;

  try {
    const [profile, item] = await Promise.all([
      getFreelancerByUsername(username),
      getPortfolioItem(username, itemId),
    ]);

    return {
      title: `${item.title} - ${profile.displayName} | Skillancer`,
      description:
        item.description?.slice(0, 160) ??
        `View ${item.title} by ${profile.displayName} on Skillancer.`,
      openGraph: {
        title: `${item.title} by ${profile.displayName}`,
        description:
          item.description?.slice(0, 160) ??
          `View ${item.title} by ${profile.displayName} on Skillancer.`,
        images: item.thumbnailUrl
          ? [{ url: item.thumbnailUrl, width: 1200, height: 630, alt: item.title }]
          : [],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${item.title} by ${profile.displayName}`,
        description:
          item.description?.slice(0, 160) ??
          `View ${item.title} by ${profile.displayName} on Skillancer.`,
        images: item.thumbnailUrl ? [item.thumbnailUrl] : [],
      },
    };
  } catch {
    return {
      title: 'Portfolio Item | Skillancer',
      description: 'View portfolio item on Skillancer.',
    };
  }
}

// ============================================================================
// Structured Data
// ============================================================================

interface CreativeWorkSchemaProps {
  item: Awaited<ReturnType<typeof getPortfolioItem>>;
  profile: Awaited<ReturnType<typeof getFreelancerByUsername>>;
}

function CreativeWorkSchema({ item, profile }: CreativeWorkSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: item.title,
    description: item.description,
    image: item.thumbnailUrl,
    url: `https://skillancer.com/freelancers/${profile.username}/portfolio/${item.id}`,
    dateCreated: item.createdAt,
    author: {
      '@type': 'Person',
      name: profile.displayName,
      url: `https://skillancer.com/freelancers/${profile.username}`,
    },
    keywords: item.tags?.join(', '),
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function PortfolioItemPage({ params }: PageProps) {
  const { username, itemId } = await params;

  let profile: Awaited<ReturnType<typeof getFreelancerByUsername>>;
  let item: Awaited<ReturnType<typeof getPortfolioItem>>;

  try {
    [profile, item] = await Promise.all([
      getFreelancerByUsername(username),
      getPortfolioItem(username, itemId),
    ]);
  } catch {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  return (
    <>
      <CreativeWorkSchema item={item} profile={profile} />

      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Header */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <Link
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
              href={`/freelancers/${username}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {profile.displayName}&apos;s profile
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2">
              {/* Media */}
              <Card className="overflow-hidden">
                {item.type === 'VIDEO' && item.mediaUrl ? (
                  <div className="relative aspect-video bg-black">
                    <video
                      controls
                      className="h-full w-full"
                      poster={item.thumbnailUrl}
                      src={item.mediaUrl}
                    >
                      <track kind="captions" />
                    </video>
                  </div>
                ) : item.images && item.images.length > 0 ? (
                  <div className="space-y-4 p-4">
                    {item.images.map((image, i) => (
                      <div key={i} className="relative aspect-video overflow-hidden rounded-lg">
                        <Image
                          fill
                          alt={`${item.title} - Image ${i + 1}`}
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 66vw"
                          src={image}
                        />
                      </div>
                    ))}
                  </div>
                ) : item.thumbnailUrl ? (
                  <div className="relative aspect-video">
                    <Image
                      fill
                      priority
                      alt={item.title}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      src={item.thumbnailUrl}
                    />
                  </div>
                ) : (
                  <div className="bg-muted flex aspect-video items-center justify-center">
                    <span className="text-muted-foreground">No preview available</span>
                  </div>
                )}
              </Card>

              {/* Description */}
              <div className="mt-8">
                <h1 className="text-2xl font-bold sm:text-3xl">{item.title}</h1>

                <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(item.createdAt)}
                  </span>
                  {item.category && (
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-4 w-4" />
                      {item.category}
                    </span>
                  )}
                </div>

                {item.description && (
                  <div className="prose prose-slate mt-6 max-w-none">
                    <p className="whitespace-pre-wrap">{item.description}</p>
                  </div>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-muted-foreground text-sm font-medium">
                      Skills & Technologies
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Link */}
                {item.projectUrl && (
                  <div className="mt-6">
                    <Button asChild variant="outline">
                      <a href={item.projectUrl} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Live Project
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Freelancer Card */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-muted-foreground mb-4 text-sm font-medium">Created by</h3>
                  <div className="flex items-center gap-3">
                    {profile.avatarUrl && (
                      <Image
                        alt={profile.displayName}
                        className="rounded-full"
                        height={48}
                        src={profile.avatarUrl}
                        width={48}
                      />
                    )}
                    <div>
                      <Link
                        className="hover:text-primary font-medium"
                        href={`/freelancers/${username}`}
                      >
                        {profile.displayName}
                      </Link>
                      <p className="text-muted-foreground text-sm">{profile.title}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild className="flex-1" size="sm">
                      <Link href={`/freelancers/${username}`}>View Profile</Link>
                    </Button>
                    <Button className="flex-1" size="sm" variant="outline">
                      Hire
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Project Details */}
              {(item.client || item.duration || item.role) && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-muted-foreground mb-4 text-sm font-medium">
                      Project Details
                    </h3>
                    <dl className="space-y-3 text-sm">
                      {item.client && (
                        <div>
                          <dt className="text-muted-foreground">Client</dt>
                          <dd className="font-medium">{item.client}</dd>
                        </div>
                      )}
                      {item.role && (
                        <div>
                          <dt className="text-muted-foreground">Role</dt>
                          <dd className="font-medium">{item.role}</dd>
                        </div>
                      )}
                      {item.duration && (
                        <div>
                          <dt className="text-muted-foreground">Duration</dt>
                          <dd className="font-medium">{item.duration}</dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                </Card>
              )}

              {/* Related Projects placeholder */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-muted-foreground mb-4 text-sm font-medium">
                    More from {profile.displayName}
                  </h3>
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/freelancers/${username}#portfolio`}>
                      View All Portfolio Items
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

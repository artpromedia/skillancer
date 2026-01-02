'use client';

/**
 * Guild Profile Page
 * Sprint M8: Guild & Agency Accounts
 */

import {
  Users,
  Star,
  CheckCircle,
  MapPin,
  Globe,
  Calendar,
  Briefcase,
  Award,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface GuildProfile {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  banner: string | null;
  tagline: string | null;
  description: string | null;
  combinedRating: number;
  totalReviews: number;
  totalProjects: number;
  verificationLevel: number;
  website: string | null;
  location: string | null;
  foundedDate: string;
  skills: string[];
  members: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    rating: number;
  }[];
  recentProjects: {
    id: string;
    name: string;
    status: string;
    completedAt: string | null;
  }[];
  reviews: {
    id: string;
    rating: number;
    comment: string;
    reviewerName: string;
    createdAt: string;
  }[];
}

export default function GuildProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [guild, setGuild] = useState<GuildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'projects' | 'reviews'>('about');

  useEffect(() => {
    if (slug) {
      fetchGuild();
    }
  }, [slug]);

  const fetchGuild = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guilds/slug/${slug}`);
      const data = await res.json();
      setGuild(data.data);
    } catch (error) {
      console.error('Failed to fetch guild:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Guild Not Found</h1>
          <p className="mb-4 text-gray-600">The guild you're looking for doesn't exist.</p>
          <Link className="text-blue-600 hover:underline" href="/guilds">
            Browse Guilds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-600">
        {guild.banner && <Image fill alt="" className="object-cover" src={guild.banner} />}
      </div>

      {/* Profile Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 mb-8">
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-6 md:flex-row">
              {/* Logo */}
              <div className="-mt-20 flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-gray-100 shadow-md md:-mt-12">
                {guild.logo ? (
                  <Image
                    alt={guild.name}
                    className="object-cover"
                    height={128}
                    src={guild.logo}
                    width={128}
                  />
                ) : (
                  <Users className="h-16 w-16 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-900">{guild.name}</h1>
                      {guild.verificationLevel > 0 && (
                        <CheckCircle className="h-6 w-6 text-blue-500" />
                      )}
                    </div>
                    {guild.tagline && <p className="mt-1 text-gray-600">{guild.tagline}</p>}

                    <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-current text-yellow-400" />
                        <span className="font-medium">{guild.combinedRating.toFixed(1)}</span>
                        <span>({guild.totalReviews} reviews)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {guild.members.length} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {guild.totalProjects} projects
                      </span>
                      {guild.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {guild.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700">
                    Contact Guild
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex gap-8">
            {(['about', 'members', 'projects', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'about' && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">About</h2>
                <p className="whitespace-pre-wrap text-gray-600">
                  {guild.description || 'No description provided.'}
                </p>

                <h3 className="text-md mb-4 mt-8 font-semibold text-gray-900">
                  Skills & Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                  {guild.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Team Members</h2>
                <div className="space-y-4">
                  {guild.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 rounded-lg bg-gray-50 p-4"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200">
                        {member.avatarUrl ? (
                          <Image
                            alt={member.displayName}
                            height={48}
                            src={member.avatarUrl}
                            width={48}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-400">
                            {member.displayName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{member.displayName}</div>
                        <div className="text-sm text-gray-500">{member.role}</div>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-current text-yellow-400" />
                        {member.rating.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Projects</h2>
                <div className="space-y-4">
                  {guild.recentProjects.map((project) => (
                    <div key={project.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">{project.name}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            project.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      {project.completedAt && (
                        <div className="mt-1 text-sm text-gray-500">
                          Completed {new Date(project.completedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Client Reviews</h2>
                <div className="space-y-6">
                  {guild.reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'fill-current text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600">{review.comment}</p>
                      <div className="mt-2 text-sm text-gray-500">— {review.reviewerName}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Guild Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium">98%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg Response Time</span>
                  <span className="font-medium">2 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Member Since</span>
                  <span className="font-medium">
                    {new Date(guild.foundedDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Links</h3>
              <div className="space-y-3">
                {guild.website && (
                  <a
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                    href={guild.website}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
              </div>
            </div>

            {/* Verification Badge */}
            {guild.verificationLevel > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="mb-2 flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  <span className="font-semibold">Verified Guild</span>
                </div>
                <p className="text-sm text-blue-100">
                  This guild has been verified by Skillancer and meets our quality standards.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

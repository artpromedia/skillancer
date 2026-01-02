'use client';

/**
 * Guilds Discovery Page
 * Sprint M8: Guild & Agency Accounts
 */

import { Search, Star, Users, CheckCircle, Filter, Grid, List } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Guild {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  combinedRating: number;
  totalReviews: number;
  memberCount: number;
  totalProjects: number;
  verificationLevel: number;
  skills: string[];
  isVerified: boolean;
}

export default function GuildsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    verified: false,
    minRating: 0,
    skills: [] as string[],
  });

  useEffect(() => {
    fetchGuilds();
  }, [searchQuery, filters]);

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.verified) params.set('verified', 'true');
      if (filters.minRating > 0) params.set('minRating', filters.minRating.toString());
      if (filters.skills.length > 0) params.set('skills', filters.skills.join(','));

      const res = await fetch(`/api/guilds?${params}`);
      const data = await res.json();
      setGuilds(data.data || []);
    } catch (error) {
      console.error('Failed to fetch guilds:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold">Discover Guilds</h1>
          <p className="mb-8 max-w-2xl text-xl text-blue-100">
            Find talented teams of freelancers ready to tackle your biggest projects. Guilds combine
            expertise, shared reputation, and collaborative excellence.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
            <input
              className="w-full rounded-lg py-4 pl-12 pr-4 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Search guilds by name, skills, or specialty..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
                filters.verified
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setFilters({ ...filters, verified: !filters.verified })}
            >
              <CheckCircle className="h-4 w-4" />
              Verified Only
            </button>

            <select
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700"
              value={filters.minRating}
              onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
            >
              <option value={0}>Any Rating</option>
              <option value={4}>4+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{guilds.length} guilds</span>
            <button
              className={`rounded p-2 ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              className={`rounded p-2 ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        )}

        {/* Guild Grid */}
        {!loading && viewMode === 'grid' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
          </div>
        )}

        {/* Guild List */}
        {!loading && viewMode === 'list' && (
          <div className="space-y-4">
            {guilds.map((guild) => (
              <GuildListItem key={guild.id} guild={guild} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && guilds.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No guilds found</h3>
            <p className="text-gray-500">Try adjusting your search or filters to find guilds.</p>
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-center text-white">
          <h2 className="mb-4 text-2xl font-bold">Ready to form your own guild?</h2>
          <p className="mx-auto mb-6 max-w-xl text-blue-100">
            Bring together talented freelancers, share your reputation, and win bigger projects
            together.
          </p>
          <Link
            className="inline-block rounded-lg bg-white px-8 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            href="/guilds/create"
          >
            Create a Guild
          </Link>
        </div>
      </div>
    </div>
  );
}

function GuildCard({ guild }: { guild: Guild }) {
  return (
    <Link
      className="block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
      href={`/guilds/${guild.slug}`}
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {guild.logo ? (
              <Image
                alt={guild.name}
                className="object-cover"
                height={64}
                src={guild.logo}
                width={64}
              />
            ) : (
              <Users className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-gray-900">{guild.name}</h3>
              {guild.isVerified && <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Star className="h-4 w-4 fill-current text-yellow-400" />
              <span className="text-sm font-medium">{guild.combinedRating.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({guild.totalReviews} reviews)</span>
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm text-gray-600">
          {guild.description || 'No description provided.'}
        </p>

        {/* Skills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {guild.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {skill}
            </span>
          ))}
          {guild.skills.length > 3 && (
            <span className="px-2 py-1 text-xs text-gray-500">+{guild.skills.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {guild.memberCount} members
          </span>
        </div>
        <span className="text-sm text-gray-500">{guild.totalProjects} projects</span>
      </div>
    </Link>
  );
}

function GuildListItem({ guild }: { guild: Guild }) {
  return (
    <Link
      className="flex items-center gap-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
      href={`/guilds/${guild.slug}`}
    >
      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {guild.logo ? (
          <Image
            alt={guild.name}
            className="object-cover"
            height={80}
            src={guild.logo}
            width={80}
          />
        ) : (
          <Users className="h-10 w-10 text-gray-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{guild.name}</h3>
          {guild.isVerified && <CheckCircle className="h-5 w-5 text-blue-500" />}
        </div>

        <p className="mb-2 line-clamp-1 text-sm text-gray-600">
          {guild.description || 'No description provided.'}
        </p>

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-yellow-600">
            <Star className="h-4 w-4 fill-current" />
            {guild.combinedRating.toFixed(1)} ({guild.totalReviews})
          </span>
          <span className="text-gray-500">{guild.memberCount} members</span>
          <span className="text-gray-500">{guild.totalProjects} projects</span>
        </div>
      </div>

      <div className="flex max-w-xs flex-wrap gap-2">
        {guild.skills.slice(0, 4).map((skill) => (
          <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
            {skill}
          </span>
        ))}
      </div>
    </Link>
  );
}

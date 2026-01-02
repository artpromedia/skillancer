'use client';

/**
 * Dashboard Guilds Page
 * Sprint M8: Guild & Agency Accounts
 *
 * Lists user's guild memberships and provides quick access to guild management
 */

import {
  Users,
  Plus,
  Star,
  Briefcase,
  DollarSign,
  ChevronRight,
  Shield,
  Settings,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface UserGuild {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: 'LEAD' | 'ADMIN' | 'SENIOR' | 'MEMBER' | 'JUNIOR';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  joinedAt: string;
  guild: {
    memberCount: number;
    combinedRating: number;
    totalReviews: number;
    activeProjects: number;
    verificationLevel: number;
  };
  pendingPayouts: number;
}

interface PendingInvitation {
  id: string;
  guildName: string;
  guildSlug: string;
  invitedBy: string;
  role: string;
  expiresAt: string;
}

export default function DashboardGuildsPage() {
  const [guilds, setGuilds] = useState<UserGuild[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserGuilds();
  }, []);

  const fetchUserGuilds = async () => {
    try {
      const [guildsRes, invitesRes] = await Promise.all([
        fetch('/api/users/me/guilds'),
        fetch('/api/users/me/guild-invitations'),
      ]);
      const guildsData = await guildsRes.json();
      const invitesData = await invitesRes.json();
      setGuilds(guildsData.data || []);
      setInvitations(invitesData.data || []);
    } catch (error) {
      console.error('Failed to fetch guilds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (invitationId: string, accept: boolean) => {
    try {
      await fetch(`/api/guild-invitations/${invitationId}/${accept ? 'accept' : 'decline'}`, {
        method: 'POST',
      });
      setInvitations(invitations.filter((i) => i.id !== invitationId));
      if (accept) {
        fetchUserGuilds();
      }
    } catch (error) {
      console.error('Failed to respond to invitation:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      LEAD: 'bg-purple-100 text-purple-700',
      ADMIN: 'bg-blue-100 text-blue-700',
      SENIOR: 'bg-green-100 text-green-700',
      MEMBER: 'bg-gray-100 text-gray-700',
      JUNIOR: 'bg-yellow-100 text-yellow-700',
    };
    return roleStyles[role] || roleStyles.MEMBER;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Guilds</h1>
          <p className="mt-1 text-gray-600">
            Manage your guild memberships and team collaborations
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50"
            href="/guilds"
          >
            <ExternalLink className="h-4 w-4" />
            Browse Guilds
          </Link>
          <Link
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            href="/guilds/create"
          >
            <Plus className="h-4 w-4" />
            Create Guild
          </Link>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h2 className="mb-3 font-semibold text-yellow-800">Pending Invitations</h2>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between rounded-lg bg-white p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{invitation.guildName}</p>
                  <p className="text-sm text-gray-500">
                    Invited by {invitation.invitedBy} as {invitation.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
                    onClick={() => handleInvitationResponse(invitation.id, false)}
                  >
                    Decline
                  </button>
                  <button
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    onClick={() => handleInvitationResponse(invitation.id, true)}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guilds List */}
      {guilds.length > 0 ? (
        <div className="grid gap-6">
          {guilds.map((membership) => (
            <div
              key={membership.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Guild Logo */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
                    {membership.logo ? (
                      <img
                        alt={membership.name}
                        className="h-full w-full rounded-xl object-cover"
                        src={membership.logo}
                      />
                    ) : (
                      membership.name.charAt(0)
                    )}
                  </div>

                  {/* Guild Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        className="text-xl font-bold text-gray-900 hover:text-blue-600"
                        href={`/guilds/${membership.slug}`}
                      >
                        {membership.name}
                      </Link>
                      {membership.guild.verificationLevel >= 2 && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${getRoleBadge(membership.role)}`}
                      >
                        {membership.role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {membership.guild.memberCount} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-current text-yellow-400" />
                        {membership.guild.combinedRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  {['LEAD', 'ADMIN'].includes(membership.role) && (
                    <Link
                      className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                      href={`/guilds/${membership.id}/dashboard`}
                      title="Manage Guild"
                    >
                      <Settings className="h-5 w-5" />
                    </Link>
                  )}
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                    href={`/guilds/${membership.slug}`}
                  >
                    View <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Stats Row */}
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {membership.guild.activeProjects}
                  </div>
                  <div className="text-sm text-gray-500">Active Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {membership.guild.totalReviews}
                  </div>
                  <div className="text-sm text-gray-500">Total Reviews</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {new Date(membership.joinedAt).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">Joined</div>
                </div>
                {membership.pendingPayouts > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${membership.pendingPayouts.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Pending Payout</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">No Guild Memberships</h3>
          <p className="mx-auto mb-6 max-w-md text-gray-500">
            Join a guild to collaborate with other freelancers, share reputation, and bid on larger
            projects together.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50"
              href="/guilds"
            >
              Browse Guilds
            </Link>
            <Link
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              href="/guilds/create"
            >
              <Plus className="h-4 w-4" />
              Create Your Own
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

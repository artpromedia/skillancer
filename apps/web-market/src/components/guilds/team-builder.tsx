'use client';

/**
 * Team Builder Component
 * Sprint M8: Guild & Agency Accounts
 *
 * Visual team composition tool with skill matching and availability
 */

import {
  Users,
  Search,
  Star,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
  Zap,
  UserPlus,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

interface GuildMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    rating: number;
    hourlyRate: number | null;
  };
  skills: string[];
  availabilityPercentage: number;
  activeProjects: number;
}

interface SelectedMember {
  memberId: string;
  projectRole: string;
  allocation: number;
}

interface TeamBuilderProps {
  guildId: string;
  requiredSkills: string[];
  suggestedBudget?: number;
  selectedMembers: SelectedMember[];
  onTeamChange: (members: SelectedMember[]) => void;
  maxTeamSize?: number;
}

export default function TeamBuilder({
  guildId,
  requiredSkills,
  suggestedBudget,
  selectedMembers,
  onTeamChange,
  maxTeamSize = 10,
}: TeamBuilderProps) {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [guildId]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/members?includeAvailability=true`);
      const data = await res.json();
      setMembers(data.data || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate skill coverage
  const skillCoverage = useMemo(() => {
    const coveredSkills: Record<string, string[]> = {};

    selectedMembers.forEach((sm) => {
      const member = members.find((m) => m.id === sm.memberId);
      if (member) {
        requiredSkills.forEach((skill) => {
          if (member.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))) {
            if (!coveredSkills[skill]) coveredSkills[skill] = [];
            coveredSkills[skill].push(`${member.user.firstName} ${member.user.lastName}`);
          }
        });
      }
    });

    return {
      covered: Object.keys(coveredSkills),
      missing: requiredSkills.filter((s) => !coveredSkills[s]),
      details: coveredSkills,
    };
  }, [selectedMembers, members, requiredSkills]);

  // Calculate estimated cost
  const estimatedCost = useMemo(() => {
    let total = 0;
    selectedMembers.forEach((sm) => {
      const member = members.find((m) => m.id === sm.memberId);
      if (member?.user.hourlyRate) {
        // Assuming 160 hours/month, adjusted by allocation
        total += member.user.hourlyRate * 160 * (sm.allocation / 100);
      }
    });
    return total;
  }, [selectedMembers, members]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = `${member.user.firstName} ${member.user.lastName}`.toLowerCase();
        const matchesName = name.includes(query);
        const matchesSkills = member.skills.some((s) => s.toLowerCase().includes(query));
        if (!matchesName && !matchesSkills) return false;
      }

      // Skill filter
      if (skillFilter) {
        if (!member.skills.some((s) => s.toLowerCase().includes(skillFilter.toLowerCase()))) {
          return false;
        }
      }

      // Availability filter
      if (showOnlyAvailable && member.availabilityPercentage < 20) {
        return false;
      }

      return true;
    });
  }, [members, searchQuery, skillFilter, showOnlyAvailable]);

  // AI-suggested team
  const getSuggestedTeam = () => {
    const suggestion: SelectedMember[] = [];
    const usedMembers = new Set<string>();

    requiredSkills.forEach((skill) => {
      const matchingMember = members.find(
        (m) =>
          !usedMembers.has(m.id) &&
          m.availabilityPercentage >= 50 &&
          m.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
      );

      if (matchingMember) {
        usedMembers.add(matchingMember.id);
        suggestion.push({
          memberId: matchingMember.id,
          projectRole: skill,
          allocation: 100,
        });
      }
    });

    return suggestion;
  };

  const toggleMember = (memberId: string) => {
    const exists = selectedMembers.find((sm) => sm.memberId === memberId);
    if (exists) {
      onTeamChange(selectedMembers.filter((sm) => sm.memberId !== memberId));
    } else if (selectedMembers.length < maxTeamSize) {
      onTeamChange([...selectedMembers, { memberId, projectRole: '', allocation: 100 }]);
    }
  };

  const updateMember = (memberId: string, updates: Partial<SelectedMember>) => {
    onTeamChange(
      selectedMembers.map((sm) => (sm.memberId === memberId ? { ...sm, ...updates } : sm))
    );
  };

  const applyAISuggestion = () => {
    onTeamChange(getSuggestedTeam());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Skill Coverage Summary */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Skill Coverage</h3>
          <button
            className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100"
            onClick={applyAISuggestion}
          >
            <Zap className="h-4 w-4" />
            AI Suggest Team
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {requiredSkills.map((skill) => {
            const isCovered = skillCoverage.covered.includes(skill);
            return (
              <div
                key={skill}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${
                  isCovered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {isCovered ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {skill}
              </div>
            );
          })}
        </div>

        {skillCoverage.missing.length > 0 && (
          <p className="mt-3 text-sm text-red-600">
            {skillCoverage.missing.length} skill(s) not covered. Add members with these skills.
          </p>
        )}
      </div>

      {/* Team Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {selectedMembers.length}/{maxTeamSize}
          </div>
          <div className="text-sm text-gray-500">Team Members</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {Math.round((skillCoverage.covered.length / requiredSkills.length) * 100)}%
          </div>
          <div className="text-sm text-gray-500">Skills Covered</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">${estimatedCost.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Est. Monthly Cost</div>
        </div>
      </div>

      {/* Selected Team */}
      {selectedMembers.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
            <Users className="h-5 w-5" />
            Selected Team ({selectedMembers.length})
          </h3>
          <div className="space-y-3">
            {selectedMembers.map((sm) => {
              const member = members.find((m) => m.id === sm.memberId);
              if (!member) return null;

              return (
                <div
                  key={sm.memberId}
                  className="flex items-center gap-4 rounded-lg bg-gray-50 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600">
                    {member.user.firstName[0]}
                    {member.user.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <input
                      className="w-full border-b border-gray-300 bg-transparent text-sm text-gray-500 focus:border-blue-500 focus:outline-none"
                      placeholder="Project role..."
                      type="text"
                      value={sm.projectRole}
                      onChange={(e) => updateMember(sm.memberId, { projectRole: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-16 rounded border border-gray-200 p-1 text-center text-sm"
                      max="100"
                      min="0"
                      type="number"
                      value={sm.allocation}
                      onChange={(e) =>
                        updateMember(sm.memberId, {
                          allocation: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={() => toggleMember(sm.memberId)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member Browser */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Available Members</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                checked={showOnlyAvailable}
                className="rounded"
                type="checkbox"
                onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              />
              Available only
            </label>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4"
              placeholder="Search members or skills..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-200 px-4 py-2"
            value={skillFilter || ''}
            onChange={(e) => setSkillFilter(e.target.value || null)}
          >
            <option value="">All Skills</option>
            {requiredSkills.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
        </div>

        {/* Members Grid */}
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {filteredMembers.map((member) => {
            const isSelected = selectedMembers.some((sm) => sm.memberId === member.id);
            const isExpanded = expandedMember === member.id;

            return (
              <div
                key={member.id}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="flex cursor-pointer items-center gap-4 p-3"
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-medium">
                    {member.user.firstName[0]}
                    {member.user.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Star className="h-4 w-4 fill-current" />
                      {member.user.rating.toFixed(1)}
                    </span>
                    <span
                      className={`rounded px-2 py-1 ${
                        member.availabilityPercentage >= 80
                          ? 'bg-green-100 text-green-700'
                          : member.availabilityPercentage >= 30
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {member.availabilityPercentage}% available
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {member.skills.map((skill) => {
                        const isRequired = requiredSkills.some((rs) =>
                          skill.toLowerCase().includes(rs.toLowerCase())
                        );
                        return (
                          <span
                            key={skill}
                            className={`rounded px-2 py-1 text-xs ${
                              isRequired
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        ${member.user.hourlyRate}/hr • {member.activeProjects} active projects
                      </div>
                      <button
                        className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                          isSelected
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        }`}
                        disabled={!isSelected && selectedMembers.length >= maxTeamSize}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMember(member.id);
                        }}
                      >
                        {isSelected ? (
                          'Remove'
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Add to Team
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredMembers.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              No members found matching your criteria
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

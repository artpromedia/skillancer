'use client';

/**
 * Guild Proposal Form Component
 * Sprint M8: Guild & Agency Accounts
 *
 * Form for submitting proposals as a guild with team composition
 */

import {
  Users,
  DollarSign,
  Clock,
  FileText,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface GuildMember {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    hourlyRate: number | null;
  };
  role: string;
  skills: string[];
}

interface TeamMember {
  memberId: string;
  role: string;
  allocation: number; // Percentage 0-100
  proposedRate: number;
}

interface GuildProposalFormProps {
  guildId: string;
  jobId: string;
  jobBudgetMin: number;
  jobBudgetMax: number;
  requiredSkills: string[];
  onSubmit: (data: ProposalData) => Promise<void>;
  onCancel: () => void;
}

interface ProposalData {
  guildId: string;
  jobId: string;
  coverLetter: string;
  proposedBudget: number;
  estimatedDuration: string;
  teamMembers: TeamMember[];
  milestones: {
    title: string;
    amount: number;
    description: string;
  }[];
}

export default function GuildProposalForm({
  guildId,
  jobId,
  jobBudgetMin,
  jobBudgetMax,
  requiredSkills,
  onSubmit,
  onCancel,
}: GuildProposalFormProps) {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coverLetter, setCoverLetter] = useState('');
  const [proposedBudget, setProposedBudget] = useState(jobBudgetMin);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [milestones, setMilestones] = useState<
    { title: string; amount: number; description: string }[]
  >([{ title: '', amount: 0, description: '' }]);

  useEffect(() => {
    fetchGuildMembers();
  }, [guildId]);

  const fetchGuildMembers = async () => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/members`);
      const data = await res.json();
      setMembers(data.data || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTeamMember = (memberId: string) => {
    if (teamMembers.find((tm) => tm.memberId === memberId)) return;

    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    setTeamMembers([
      ...teamMembers,
      {
        memberId,
        role: '',
        allocation: 100,
        proposedRate: member.user.hourlyRate || 0,
      },
    ]);
  };

  const removeTeamMember = (memberId: string) => {
    setTeamMembers(teamMembers.filter((tm) => tm.memberId !== memberId));
  };

  const updateTeamMember = (memberId: string, updates: Partial<TeamMember>) => {
    setTeamMembers(
      teamMembers.map((tm) => (tm.memberId === memberId ? { ...tm, ...updates } : tm))
    );
  };

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', amount: 0, description: '' }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (
    index: number,
    updates: Partial<{ title: string; amount: number; description: string }>
  ) => {
    setMilestones(milestones.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const calculateCoverage = () => {
    const teamSkills = teamMembers.flatMap((tm) => {
      const member = members.find((m) => m.id === tm.memberId);
      return member?.skills || [];
    });
    const coveredSkills = requiredSkills.filter((skill) =>
      teamSkills.some((ts) => ts.toLowerCase().includes(skill.toLowerCase()))
    );
    return {
      covered: coveredSkills.length,
      total: requiredSkills.length,
      percentage:
        requiredSkills.length > 0
          ? Math.round((coveredSkills.length / requiredSkills.length) * 100)
          : 100,
    };
  };

  const validateForm = (): string | null => {
    if (teamMembers.length === 0) return 'Please add at least one team member';
    if (!coverLetter.trim()) return 'Please write a cover letter';
    if (proposedBudget <= 0) return 'Please enter a valid budget';
    if (!estimatedDuration) return 'Please select estimated duration';

    const milestonesTotal = milestones.reduce((sum, m) => sum + m.amount, 0);
    if (milestones.length > 0 && Math.abs(milestonesTotal - proposedBudget) > 0.01) {
      return 'Milestone amounts must equal the proposed budget';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        guildId,
        jobId,
        coverLetter,
        proposedBudget,
        estimatedDuration,
        teamMembers,
        milestones: milestones.filter((m) => m.title.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const coverage = calculateCoverage();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Team Composition */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Users className="h-5 w-5" />
            Team Composition
          </h3>
          <div
            className={`rounded-full px-3 py-1 text-sm ${
              coverage.percentage === 100
                ? 'bg-green-100 text-green-700'
                : coverage.percentage >= 50
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {coverage.covered}/{coverage.total} skills covered ({coverage.percentage}%)
          </div>
        </div>

        {/* Member Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">Add Team Members</label>
          <select
            className="w-full rounded-lg border border-gray-200 p-3"
            value=""
            onChange={(e) => addTeamMember(e.target.value)}
          >
            <option value="">Select a member to add...</option>
            {members
              .filter((m) => !teamMembers.find((tm) => tm.memberId === m.id))
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user.firstName} {member.user.lastName} - {member.role} (
                  {member.skills.slice(0, 3).join(', ')})
                </option>
              ))}
          </select>
        </div>

        {/* Selected Team Members */}
        <div className="space-y-4">
          {teamMembers.map((tm) => {
            const member = members.find((m) => m.id === tm.memberId);
            if (!member) return null;

            return (
              <div key={tm.memberId} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <button
                    className="text-gray-400 hover:text-red-500"
                    type="button"
                    onClick={() => removeTeamMember(tm.memberId)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Project Role</label>
                    <input
                      className="w-full rounded border border-gray-200 p-2 text-sm"
                      placeholder="e.g., Lead Developer"
                      type="text"
                      value={tm.role}
                      onChange={(e) => updateTeamMember(tm.memberId, { role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Allocation (%)</label>
                    <input
                      className="w-full rounded border border-gray-200 p-2 text-sm"
                      max="100"
                      min="0"
                      type="number"
                      value={tm.allocation}
                      onChange={(e) =>
                        updateTeamMember(tm.memberId, {
                          allocation: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Proposed Rate ($/hr)</label>
                    <input
                      className="w-full rounded border border-gray-200 p-2 text-sm"
                      min="0"
                      type="number"
                      value={tm.proposedRate}
                      onChange={(e) =>
                        updateTeamMember(tm.memberId, {
                          proposedRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {teamMembers.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-gray-500">
              Select members from the dropdown above to build your team
            </div>
          )}
        </div>
      </div>

      {/* Proposal Details */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <FileText className="h-5 w-5" />
          Proposal Details
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cover Letter</label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 p-3"
              placeholder="Explain why your guild is the perfect fit for this project..."
              rows={6}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <DollarSign className="mr-1 inline h-4 w-4" />
                Proposed Budget
              </label>
              <input
                className="w-full rounded-lg border border-gray-200 p-3"
                min={0}
                type="number"
                value={proposedBudget}
                onChange={(e) => setProposedBudget(parseFloat(e.target.value) || 0)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Client budget: ${jobBudgetMin.toLocaleString()} - ${jobBudgetMax.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <Clock className="mr-1 inline h-4 w-4" />
                Estimated Duration
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 p-3"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
              >
                <option value="">Select duration...</option>
                <option value="less_than_week">Less than a week</option>
                <option value="1_2_weeks">1-2 weeks</option>
                <option value="2_4_weeks">2-4 weeks</option>
                <option value="1_3_months">1-3 months</option>
                <option value="3_6_months">3-6 months</option>
                <option value="6_plus_months">6+ months</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Milestones (Optional)</h3>
          <button
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            type="button"
            onClick={addMilestone}
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </button>
        </div>

        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div key={index} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Milestone {index + 1}</span>
                {milestones.length > 1 && (
                  <button
                    className="text-gray-400 hover:text-red-500"
                    type="button"
                    onClick={() => removeMilestone(index)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <input
                    className="w-full rounded border border-gray-200 p-2 text-sm"
                    placeholder="Milestone title"
                    type="text"
                    value={milestone.title}
                    onChange={(e) => updateMilestone(index, { title: e.target.value })}
                  />
                </div>
                <div>
                  <input
                    className="w-full rounded border border-gray-200 p-2 text-sm"
                    min="0"
                    placeholder="Amount"
                    type="number"
                    value={milestone.amount}
                    onChange={(e) =>
                      updateMilestone(index, {
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <textarea
                className="mt-2 w-full resize-none rounded border border-gray-200 p-2 text-sm"
                placeholder="Description of deliverables..."
                rows={2}
                value={milestone.description}
                onChange={(e) => updateMilestone(index, { description: e.target.value })}
              />
            </div>
          ))}
        </div>

        {milestones.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Total: ${milestones.reduce((sum, m) => sum + m.amount, 0).toLocaleString()}
            </span>
            {Math.abs(milestones.reduce((sum, m) => sum + m.amount, 0) - proposedBudget) < 0.01 ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Matches proposed budget
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Difference: $
                {Math.abs(
                  milestones.reduce((sum, m) => sum + m.amount, 0) - proposedBudget
                ).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <button
          className="rounded-lg border border-gray-200 px-6 py-2 hover:bg-gray-50"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting}
          type="submit"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              Submitting...
            </>
          ) : (
            'Submit Proposal'
          )}
        </button>
      </div>
    </form>
  );
}

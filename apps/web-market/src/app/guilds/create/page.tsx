'use client';

/**
 * Create Guild Page
 * Sprint M8: Guild & Agency Accounts
 */

import { Users, Upload, X, Plus, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface FoundingMember {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export default function CreateGuildPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    skills: [] as string[],
    location: '',
    website: '',
  });

  const [newSkill, setNewSkill] = useState('');
  const [foundingMembers, setFoundingMembers] = useState<FoundingMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          foundingMembers: foundingMembers.map((m) => ({
            email: m.email,
            role: m.role,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create guild');
      }

      const data = await res.json();
      router.push(`/guilds/${data.data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  const addFoundingMember = () => {
    if (newMemberEmail.trim() && !foundingMembers.find((m) => m.email === newMemberEmail)) {
      setFoundingMembers([...foundingMembers, { email: newMemberEmail.trim(), role: 'MEMBER' }]);
      setNewMemberEmail('');
    }
  };

  const removeFoundingMember = (email: string) => {
    setFoundingMembers(foundingMembers.filter((m) => m.email !== email));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Guild</h1>
          <p className="mt-2 text-gray-600">
            Bring together talented freelancers and tackle bigger projects together.
          </p>
        </div>

        {/* Form */}
        <form className="space-y-8" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div className="text-red-700">{error}</div>
            </div>
          )}

          {/* Basic Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Guild Name *</label>
                <input
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Digital Innovators Collective"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tagline</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="A short description of your guild"
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell clients about your guild, your expertise, and what makes you unique..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., San Francisco, CA"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Website</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="https://yourguild.com"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Skills & Expertise</h2>

            <div className="mb-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Add a skill..."
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                type="button"
                onClick={addSkill}
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700"
                >
                  {skill}
                  <button
                    className="hover:text-blue-900"
                    type="button"
                    onClick={() => removeSkill(skill)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
              {formData.skills.length === 0 && (
                <span className="text-sm text-gray-500">No skills added yet</span>
              )}
            </div>
          </div>

          {/* Founding Members */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Founding Members</h2>
            <p className="mb-4 text-sm text-gray-600">
              Invite team members to join your guild. You will be the guild leader.
            </p>

            <div className="mb-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="member@example.com"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <button
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
                type="button"
                onClick={addFoundingMember}
              >
                <Plus className="h-4 w-4" />
                Invite
              </button>
            </div>

            <div className="space-y-2">
              {foundingMembers.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <span className="text-gray-700">{member.email}</span>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      value={member.role}
                      onChange={(e) =>
                        setFoundingMembers(
                          foundingMembers.map((m) =>
                            m.email === member.email
                              ? { ...m, role: e.target.value as 'ADMIN' | 'MEMBER' }
                              : m
                          )
                        )
                      }
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      className="text-gray-400 hover:text-red-500"
                      type="button"
                      onClick={() => removeFoundingMember(member.email)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {foundingMembers.length === 0 && (
                <div className="py-4 text-center text-sm text-gray-500">
                  No members invited yet. You can always invite more later.
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <button
              className="px-6 py-2 text-gray-700 hover:text-gray-900"
              type="button"
              onClick={() => router.back()}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || !formData.name}
              type="submit"
            >
              {loading ? 'Creating...' : 'Create Guild'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

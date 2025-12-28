'use client';

import { cn } from '@skillancer/ui';
import { MessageSquare, X, Send, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface WriteRecommendationProps {
  readonly recipientName: string;
  readonly recipientAvatar?: string;
  readonly onSubmit?: (data: RecommendationData) => void;
  readonly onClose?: () => void;
  readonly isOpen?: boolean;
}

interface RecommendationData {
  relationship: string;
  duration: string;
  text: string;
  skillsHighlighted: string[];
}

const relationshipOptions = [
  { value: 'client', label: 'They worked for me' },
  { value: 'employer', label: 'I worked for them' },
  { value: 'colleague', label: 'We collaborated together' },
  { value: 'other', label: 'Other' },
];

const suggestedTopics = [
  'What did they do well?',
  'What makes them stand out?',
  'Would you work with them again?',
  'What was the impact of their work?',
  'How did they handle challenges?',
];

export function WriteRecommendation({
  recipientName,
  recipientAvatar: _recipientAvatar,
  onSubmit,
  onClose,
  isOpen = true,
}: WriteRecommendationProps) {
  const [formData, setFormData] = useState<RecommendationData>({
    relationship: '',
    duration: '',
    text: '',
    skillsHighlighted: [],
  });

  const [skillInput, setSkillInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.relationship && formData.text.trim()) {
      onSubmit?.(formData);
      onClose?.();
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skillsHighlighted.includes(skillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skillsHighlighted: [...prev.skillsHighlighted, skillInput.trim()],
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skillsHighlighted: prev.skillsHighlighted.filter((s) => s !== skill),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Write Recommendation</h2>
              <p className="text-sm text-gray-500">For {recipientName}</p>
            </div>
          </div>
          {onClose && (
            <button
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>

        <form className="space-y-6 p-6" onSubmit={handleSubmit}>
          {/* Relationship */}
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">
              Your relationship *
            </span>
            <div className="grid grid-cols-2 gap-3">
              {relationshipOptions.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    'rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                    formData.relationship === option.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, relationship: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="duration">
              Duration of relationship
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              id="duration"
              placeholder="e.g., 6 months, 2 years"
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
            />
          </div>

          {/* Testimonial Text */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="text">
              Your testimonial *
            </label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              id="text"
              placeholder={`Share your experience working with ${recipientName}...`}
              rows={8}
              value={formData.text}
              onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{formData.text.length} / 500 characters</span>
              <span className="text-xs text-gray-400">Minimum 50 characters</span>
            </div>
          </div>

          {/* Suggested Topics */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="mb-2 text-sm font-medium text-blue-900">Suggested topics:</p>
                <ul className="space-y-1 text-sm text-blue-800">
                  {suggestedTopics.map((topic) => (
                    <li key={topic}>• {topic}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Skills to Highlight */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="skill-input">
              Skills to highlight (optional)
            </label>
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                id="skill-input"
                placeholder="Type a skill and press Enter"
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <button
                className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
                type="button"
                onClick={addSkill}
              >
                Add
              </button>
            </div>
            {formData.skillsHighlighted.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.skillsHighlighted.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
                  >
                    {skill}
                    <button
                      className="hover:text-indigo-900"
                      type="button"
                      onClick={() => removeSkill(skill)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-gray-100 pt-4">
            {onClose && (
              <button
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
            )}
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!formData.relationship || formData.text.length < 50}
              type="submit"
            >
              <Send className="h-4 w-4" />
              Submit Recommendation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WriteRecommendation;

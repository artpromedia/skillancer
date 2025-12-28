'use client';

import { cn } from '@skillancer/ui';
import { CheckCircle2, Award, TrendingUp, Users, Shield } from 'lucide-react';

interface FreelancerComparison {
  id: string;
  name: string;
  avatar?: string;
  skillsVerifiedPercent: number;
  credentialsCount: number;
  trustScore: number;
  endorsementCount: number;
  assessmentsPassed: number;
  hourlyRate: number;
  responseTime: string;
}

interface VerificationComparisonProps {
  freelancers: FreelancerComparison[];
  onSelect?: (freelancerId: string) => void;
  className?: string;
}

export function VerificationComparison({
  freelancers,
  onSelect,
  className,
}: VerificationComparisonProps) {
  const getRecommendation = (freelancer: FreelancerComparison): string | null => {
    if (freelancer.trustScore >= 90 && freelancer.skillsVerifiedPercent >= 80) {
      return 'Best Match';
    }
    if (freelancer.credentialsCount >= 5 && freelancer.assessmentsPassed >= 3) {
      return 'Highly Verified';
    }
    if (freelancer.endorsementCount >= 10) {
      return 'Well Endorsed';
    }
    return null;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-gray-600';
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="border-b border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900">Verification Comparison</h3>
        <p className="mt-1 text-sm text-gray-500">
          Compare candidates by their verified credentials and trust signals
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Freelancer
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Trust Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Skills Verified
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Credentials
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Endorsements
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Assessments
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {freelancers.map((freelancer) => {
              const recommendation = getRecommendation(freelancer);
              return (
                <tr key={freelancer.id} className="hover:bg-gray-50">
                  {/* Freelancer */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 font-medium text-white">
                        {freelancer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{freelancer.name}</p>
                        {recommendation && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {recommendation}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Trust Score */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn('text-2xl font-bold', getScoreColor(freelancer.trustScore))}
                      >
                        {freelancer.trustScore}
                      </span>
                      <span className="text-xs text-gray-500">/ 100</span>
                    </div>
                  </td>

                  {/* Skills Verified */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="mb-1 flex items-center gap-1">
                        <Shield className="h-4 w-4 text-indigo-600" />
                        <span className="font-semibold text-gray-900">
                          {freelancer.skillsVerifiedPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${freelancer.skillsVerifiedPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Credentials */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <Award className="mb-1 h-5 w-5 text-amber-500" />
                      <span className="font-semibold text-gray-900">
                        {freelancer.credentialsCount}
                      </span>
                    </div>
                  </td>

                  {/* Endorsements */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <Users className="mb-1 h-5 w-5 text-blue-500" />
                      <span className="font-semibold text-gray-900">
                        {freelancer.endorsementCount}
                      </span>
                    </div>
                  </td>

                  {/* Assessments */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="mb-1 h-5 w-5 text-green-500" />
                      <span className="font-semibold text-gray-900">
                        {freelancer.assessmentsPassed}
                      </span>
                    </div>
                  </td>

                  {/* Rate */}
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className="font-semibold text-gray-900">${freelancer.hourlyRate}</span>
                    <span className="text-xs text-gray-500">/hr</span>
                  </td>

                  {/* Action */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                      onClick={() => onSelect?.(freelancer.id)}
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recommendation Note */}
      <div className="border-t border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-4 w-4 text-blue-600" />
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Freelancers with higher trust scores and verified skills tend to
            deliver better outcomes and are more reliable for long-term engagements.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerificationComparison;

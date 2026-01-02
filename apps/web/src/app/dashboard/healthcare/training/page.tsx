'use client';

import {
  AcademicCapIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

/**
 * HIPAA Training Page
 * Sprint M9: Healthcare Vertical Module
 */

type TrainingStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'EXPIRED';

interface TrainingModule {
  id: string;
  type: string;
  name: string;
  description: string;
  duration: string;
  required: boolean;
  status: TrainingStatus;
  completedAt: Date | null;
  expiresAt: Date | null;
  score: number | null;
  passingScore: number;
  certificateUrl: string | null;
}

// Placeholder training data
const mockTrainings: TrainingModule[] = [
  {
    id: '1',
    type: 'HIPAA_BASICS',
    name: 'HIPAA Basics',
    description: 'Introduction to HIPAA regulations and compliance requirements',
    duration: '45 min',
    required: true,
    status: 'COMPLETED',
    completedAt: new Date('2024-01-15'),
    expiresAt: new Date('2025-01-15'),
    score: 92,
    passingScore: 80,
    certificateUrl: '/certificates/hipaa-basics.pdf',
  },
  {
    id: '2',
    type: 'HIPAA_SECURITY',
    name: 'HIPAA Security Rule',
    description: 'Technical and administrative safeguards for protecting PHI',
    duration: '60 min',
    required: true,
    status: 'COMPLETED',
    completedAt: new Date('2024-01-16'),
    expiresAt: new Date('2025-01-16'),
    score: 88,
    passingScore: 80,
    certificateUrl: '/certificates/hipaa-security.pdf',
  },
  {
    id: '3',
    type: 'HIPAA_PRIVACY',
    name: 'HIPAA Privacy Rule',
    description: 'Patient rights and proper handling of protected health information',
    duration: '45 min',
    required: true,
    status: 'IN_PROGRESS',
    completedAt: null,
    expiresAt: null,
    score: null,
    passingScore: 80,
    certificateUrl: null,
  },
  {
    id: '4',
    type: 'PHI_HANDLING',
    name: 'PHI Handling Best Practices',
    description: 'Practical guidance for working with protected health information',
    duration: '30 min',
    required: true,
    status: 'NOT_STARTED',
    completedAt: null,
    expiresAt: null,
    score: null,
    passingScore: 80,
    certificateUrl: null,
  },
  {
    id: '5',
    type: 'BREACH_RESPONSE',
    name: 'Breach Response Training',
    description: 'How to identify and respond to potential data breaches',
    duration: '30 min',
    required: false,
    status: 'NOT_STARTED',
    completedAt: null,
    expiresAt: null,
    score: null,
    passingScore: 80,
    certificateUrl: null,
  },
  {
    id: '6',
    type: 'ANNUAL_REFRESHER',
    name: 'Annual HIPAA Refresher',
    description: 'Yearly refresher course covering HIPAA updates and best practices',
    duration: '20 min',
    required: true,
    status: 'EXPIRED',
    completedAt: new Date('2023-01-10'),
    expiresAt: new Date('2024-01-10'),
    score: 95,
    passingScore: 80,
    certificateUrl: null,
  },
];

export default function TrainingPage() {
  const [trainings] = useState<TrainingModule[]>(mockTrainings);
  const [filter, setFilter] = useState<'all' | 'required' | 'completed' | 'pending'>('all');

  const filteredTrainings = trainings.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'required') return t.required;
    if (filter === 'completed') return t.status === 'COMPLETED';
    if (filter === 'pending') return t.status !== 'COMPLETED';
    return true;
  });

  const completedRequired = trainings.filter((t) => t.required && t.status === 'COMPLETED').length;
  const totalRequired = trainings.filter((t) => t.required).length;
  const compliancePercentage = Math.round((completedRequired / totalRequired) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HIPAA Training</h1>
              <p className="mt-1 text-sm text-gray-500">
                Complete required training to maintain HIPAA compliance
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Training Compliance</p>
              <p className="text-2xl font-bold text-gray-900">{compliancePercentage}%</p>
              <p className="text-sm text-gray-500">
                {completedRequired} of {totalRequired} required completed
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Progress Banner */}
        {compliancePercentage < 100 && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              <p className="ml-3 text-sm text-yellow-700">
                <strong>Action Required:</strong> Complete all required training to maintain HIPAA
                compliance. Incomplete training may restrict access to healthcare jobs.
              </p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <FilterTab
              active={filter === 'all'}
              label="All Training"
              onClick={() => setFilter('all')}
            />
            <FilterTab
              active={filter === 'required'}
              label="Required"
              onClick={() => setFilter('required')}
            />
            <FilterTab
              active={filter === 'completed'}
              label="Completed"
              onClick={() => setFilter('completed')}
            />
            <FilterTab
              active={filter === 'pending'}
              label="Pending"
              onClick={() => setFilter('pending')}
            />
          </nav>
        </div>

        {/* Training List */}
        <div className="space-y-4">
          {filteredTrainings.map((training) => (
            <TrainingCard key={training.id} training={training} />
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="text-sm font-medium text-blue-800">About HIPAA Training Requirements</h3>
          <p className="mt-2 text-sm text-blue-700">
            The Health Insurance Portability and Accountability Act (HIPAA) requires all healthcare
            workers to complete training on privacy, security, and proper handling of protected
            health information (PHI). Training must be renewed annually to maintain compliance.
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TrainingCard({ training }: { training: TrainingModule }) {
  const statusConfig = {
    COMPLETED: {
      icon: CheckCircleIcon,
      color: 'text-green-500',
      bg: 'bg-green-100',
      label: 'Completed',
    },
    IN_PROGRESS: {
      icon: ClockIcon,
      color: 'text-blue-500',
      bg: 'bg-blue-100',
      label: 'In Progress',
    },
    NOT_STARTED: {
      icon: PlayIcon,
      color: 'text-gray-500',
      bg: 'bg-gray-100',
      label: 'Not Started',
    },
    EXPIRED: {
      icon: ExclamationTriangleIcon,
      color: 'text-red-500',
      bg: 'bg-red-100',
      label: 'Expired',
    },
  };

  const config = statusConfig[training.status];
  const StatusIcon = config.icon;

  const isExpiringSoon =
    training.expiresAt &&
    training.expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 &&
    training.status === 'COMPLETED';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className={`rounded-lg p-2 ${config.bg}`}>
            <AcademicCapIcon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="ml-4">
            <div className="flex items-center">
              <h3 className="font-medium text-gray-900">{training.name}</h3>
              {training.required && (
                <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  Required
                </span>
              )}
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
              >
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">{training.description}</p>
            <p className="mt-2 text-sm text-gray-400">Duration: {training.duration}</p>
          </div>
        </div>
        <div className="text-right">
          {training.score !== null && (
            <p className="text-sm text-gray-500">
              Score: <span className="font-medium">{training.score}%</span>
            </p>
          )}
          {training.expiresAt && (
            <p className={`text-sm ${isExpiringSoon ? 'text-orange-600' : 'text-gray-500'}`}>
              {isExpiringSoon && <ExclamationTriangleIcon className="mr-1 inline h-4 w-4" />}
              Expires: {training.expiresAt.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex space-x-4">
        {training.status === 'NOT_STARTED' && (
          <a
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            href={`/dashboard/healthcare/training/${training.id}/start`}
          >
            <PlayIcon className="mr-1.5 h-4 w-4" />
            Start Training
          </a>
        )}
        {training.status === 'IN_PROGRESS' && (
          <a
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            href={`/dashboard/healthcare/training/${training.id}/continue`}
          >
            Continue
          </a>
        )}
        {training.status === 'COMPLETED' && training.certificateUrl && (
          <a
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
            href={training.certificateUrl}
          >
            Download Certificate
          </a>
        )}
        {training.status === 'EXPIRED' && (
          <a
            className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
            href={`/dashboard/healthcare/training/${training.id}/retake`}
          >
            Retake Training
          </a>
        )}
      </div>
    </div>
  );
}

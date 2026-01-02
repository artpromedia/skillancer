'use client';

import {
  ShieldCheckIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

/**
 * Healthcare Credentials Page
 * Sprint M9: Healthcare Vertical Module
 */

type CredentialStatus = 'VERIFIED' | 'PENDING' | 'EXPIRED' | 'REJECTED';

interface Credential {
  id: string;
  type: string;
  typeName: string;
  licenseNumber: string;
  issuingState: string | null;
  issuingAuthority: string;
  issuedAt: Date;
  expiresAt: Date | null;
  status: CredentialStatus;
  verifiedAt: Date | null;
  lastVerificationCheck: Date | null;
}

// Placeholder credentials data
const mockCredentials: Credential[] = [
  {
    id: '1',
    type: 'RN',
    typeName: 'Registered Nurse',
    licenseNumber: 'RN123456',
    issuingState: 'CA',
    issuingAuthority: 'California Board of Registered Nursing',
    issuedAt: new Date('2020-03-15'),
    expiresAt: new Date('2025-03-15'),
    status: 'VERIFIED',
    verifiedAt: new Date('2024-01-10'),
    lastVerificationCheck: new Date('2024-06-01'),
  },
  {
    id: '2',
    type: 'BLS',
    typeName: 'Basic Life Support',
    licenseNumber: 'BLS789012',
    issuingState: null,
    issuingAuthority: 'American Heart Association',
    issuedAt: new Date('2023-06-01'),
    expiresAt: new Date('2025-06-01'),
    status: 'VERIFIED',
    verifiedAt: new Date('2023-06-15'),
    lastVerificationCheck: new Date('2024-06-01'),
  },
  {
    id: '3',
    type: 'ACLS',
    typeName: 'Advanced Cardiac Life Support',
    licenseNumber: 'ACLS345678',
    issuingState: null,
    issuingAuthority: 'American Heart Association',
    issuedAt: new Date('2023-06-01'),
    expiresAt: new Date('2024-12-01'),
    status: 'PENDING',
    verifiedAt: null,
    lastVerificationCheck: null,
  },
  {
    id: '4',
    type: 'NP',
    typeName: 'Nurse Practitioner',
    licenseNumber: 'NP901234',
    issuingState: 'CA',
    issuingAuthority: 'California Board of Registered Nursing',
    issuedAt: new Date('2021-09-01'),
    expiresAt: new Date('2024-09-01'),
    status: 'EXPIRED',
    verifiedAt: new Date('2021-10-01'),
    lastVerificationCheck: new Date('2024-06-01'),
  },
];

export default function CredentialsPage() {
  const [credentials] = useState<Credential[]>(mockCredentials);
  const [filter, setFilter] = useState<'all' | CredentialStatus>('all');

  const filteredCredentials =
    filter === 'all' ? credentials : credentials.filter((c) => c.status === filter);

  const statusCounts = {
    all: credentials.length,
    VERIFIED: credentials.filter((c) => c.status === 'VERIFIED').length,
    PENDING: credentials.filter((c) => c.status === 'PENDING').length,
    EXPIRED: credentials.filter((c) => c.status === 'EXPIRED').length,
    REJECTED: credentials.filter((c) => c.status === 'REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Medical Credentials</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your professional licenses and certifications
              </p>
            </div>
            <a
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              href="/dashboard/healthcare/credentials/add"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Credential
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <FilterTab
              active={filter === 'all'}
              count={statusCounts.all}
              label="All"
              onClick={() => setFilter('all')}
            />
            <FilterTab
              active={filter === 'VERIFIED'}
              count={statusCounts.VERIFIED}
              label="Verified"
              onClick={() => setFilter('VERIFIED')}
            />
            <FilterTab
              active={filter === 'PENDING'}
              count={statusCounts.PENDING}
              label="Pending"
              onClick={() => setFilter('PENDING')}
            />
            <FilterTab
              active={filter === 'EXPIRED'}
              count={statusCounts.EXPIRED}
              label="Expired"
              onClick={() => setFilter('EXPIRED')}
            />
          </nav>
        </div>

        {/* Credentials List */}
        <div className="space-y-4">
          {filteredCredentials.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No credentials found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Add your first credential to get started.
              </p>
              <a
                className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                href="/dashboard/healthcare/credentials/add"
              >
                <PlusIcon className="mr-1 h-4 w-4" />
                Add Credential
              </a>
            </div>
          ) : (
            filteredCredentials.map((credential) => (
              <CredentialCard key={credential.id} credential={credential} />
            ))
          )}
        </div>

        {/* Verification Info */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="text-sm font-medium text-blue-800">About Credential Verification</h3>
          <p className="mt-2 text-sm text-blue-700">
            We verify credentials through primary source verification (PSV) to ensure compliance
            with healthcare industry standards. Verification typically takes 1-3 business days
            depending on the credential type and issuing authority.
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
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
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
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
          active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function CredentialCard({ credential }: { credential: Credential }) {
  const statusConfig = {
    VERIFIED: {
      icon: CheckCircleIcon,
      color: 'text-green-500',
      bg: 'bg-green-100',
      label: 'Verified',
    },
    PENDING: {
      icon: ClockIcon,
      color: 'text-yellow-500',
      bg: 'bg-yellow-100',
      label: 'Pending Verification',
    },
    EXPIRED: {
      icon: ExclamationTriangleIcon,
      color: 'text-red-500',
      bg: 'bg-red-100',
      label: 'Expired',
    },
    REJECTED: {
      icon: XCircleIcon,
      color: 'text-red-500',
      bg: 'bg-red-100',
      label: 'Rejected',
    },
  };

  const config = statusConfig[credential.status];
  const StatusIcon = config.icon;

  const isExpiringSoon =
    credential.expiresAt && credential.expiresAt.getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className={`rounded-lg p-2 ${config.bg}`}>
            <ShieldCheckIcon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="ml-4">
            <div className="flex items-center">
              <h3 className="font-medium text-gray-900">{credential.typeName}</h3>
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
              >
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {credential.licenseNumber}
              {credential.issuingState && ` • ${credential.issuingState}`}
            </p>
            <p className="mt-1 text-sm text-gray-500">{credential.issuingAuthority}</p>
          </div>
        </div>
        <div className="text-right">
          {credential.expiresAt && (
            <p className={`text-sm ${isExpiringSoon ? 'text-orange-600' : 'text-gray-500'}`}>
              {isExpiringSoon && <ExclamationTriangleIcon className="mr-1 inline h-4 w-4" />}
              Expires: {credential.expiresAt.toLocaleDateString()}
            </p>
          )}
          {credential.verifiedAt && (
            <p className="text-sm text-gray-400">
              Verified: {credential.verifiedAt.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex space-x-4">
        <a
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
          href={`/dashboard/healthcare/credentials/${credential.id}`}
        >
          View Details
        </a>
        {credential.status === 'EXPIRED' && (
          <a
            className="text-sm font-medium text-orange-600 hover:text-orange-500"
            href={`/dashboard/healthcare/credentials/${credential.id}/renew`}
          >
            Renew
          </a>
        )}
        {credential.status === 'PENDING' && (
          <span className="text-sm text-gray-500">Verification in progress...</span>
        )}
      </div>
    </div>
  );
}

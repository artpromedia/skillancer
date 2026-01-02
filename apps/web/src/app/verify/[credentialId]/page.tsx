'use client';

/**
 * Public Credential Verification Page
 * Verify and display credential authenticity
 * Sprint M4: Portable Verified Work History
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Clock,
  Lock,
  Copy,
  Download,
  QrCode,
  BadgeCheck,
  Star,
  TrendingUp,
  FileText,
  Award,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type VerificationStatus = 'verifying' | 'valid' | 'expired' | 'revoked' | 'invalid';

// Mock credential data
const mockCredential = {
  id: 'cred-abc123',
  type: 'CompleteProfile',
  title: 'Verified Freelancer Profile',
  holder: {
    name: 'Alex Johnson',
    profileUrl: 'https://skillancer.com/u/alexjohnson',
    avatarUrl: null,
  },
  issuer: {
    name: 'Skillancer',
    did: 'did:web:skillancer.com',
    logoUrl: '/logo.svg',
  },
  issuedAt: '2024-01-15T10:30:00Z',
  expiresAt: '2025-01-15T10:30:00Z',
  verificationLevel: 'CRYPTOGRAPHICALLY_SEALED',
  signature: {
    type: 'RsaSignature2018',
    created: '2024-01-15T10:30:00Z',
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:web:skillancer.com#key-1',
    signatureValue: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  blockchainAnchor: {
    network: 'polygon',
    txHash: '0x1234567890abcdef...',
    blockNumber: 45678901,
    timestamp: '2024-01-15T10:31:00Z',
  },
  claims: {
    platforms: [
      { name: 'Upwork', connected: true, verified: true },
      { name: 'Fiverr', connected: true, verified: true },
      { name: 'Freelancer.com', connected: true, verified: true },
    ],
    statistics: {
      totalProjects: 156,
      completedProjects: 152,
      totalEarnings: '$127,450',
      avgRating: 4.9,
      totalReviews: 142,
      memberSince: '2019-03-15',
    },
    topSkills: [
      { name: 'React', level: 'Expert', projects: 67 },
      { name: 'TypeScript', level: 'Expert', projects: 58 },
      { name: 'Node.js', level: 'Expert', projects: 45 },
      { name: 'PostgreSQL', level: 'Advanced', projects: 32 },
    ],
    badges: [
      { name: 'Elite Earner', icon: '💎', description: '$100K+ earned' },
      { name: 'Top Rated', icon: '⭐', description: '4.9+ rating' },
      { name: 'Verified Pro', icon: '✅', description: '3+ platforms' },
    ],
  },
};

const verificationLevelInfo: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  SELF_REPORTED: {
    label: 'Self-Reported',
    color: 'text-gray-600 bg-gray-100',
    icon: <FileText className="h-5 w-5" />,
  },
  PLATFORM_CONNECTED: {
    label: 'Platform Connected',
    color: 'text-blue-600 bg-blue-100',
    icon: <Link2 className="h-5 w-5" />,
  },
  PLATFORM_VERIFIED: {
    label: 'Platform Verified',
    color: 'text-green-600 bg-green-100',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  CRYPTOGRAPHICALLY_SEALED: {
    label: 'Cryptographically Sealed',
    color: 'text-purple-600 bg-purple-100',
    icon: <Lock className="h-5 w-5" />,
  },
};

export default function VerifyCredentialPage() {
  const params = useParams();
  const credentialId = params.credentialId as string;

  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Simulate verification process
    const timer = setTimeout(() => {
      setStatus('valid');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const levelInfo = verificationLevelInfo[mockCredential.verificationLevel] ?? {
    label: 'Unknown',
    color: 'text-gray-600 bg-gray-100',
    icon: null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-600" />
            <span className="font-semibold text-gray-900">Skillancer Verify</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyUrl}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <a
              href="https://skillancer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              <ExternalLink className="h-4 w-4" />
              Skillancer
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Verification Status */}
        <div className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {status === 'verifying' && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-indigo-100">
                <Shield className="h-8 w-8 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Verifying Credential...</h2>
              <p className="mt-2 text-gray-600">
                Checking cryptographic signatures and blockchain anchors
              </p>
            </div>
          )}

          {status === 'valid' && (
            <>
              <div className="border-b border-green-100 bg-green-50 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-green-800">Credential Verified</h2>
                    <p className="text-green-700">
                      This credential is authentic and has not been tampered with
                    </p>
                  </div>
                </div>
              </div>

              {/* Holder Info */}
              <div className="border-b p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white">
                    {mockCredential.holder.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {mockCredential.holder.name}
                    </h3>
                    <p className="text-gray-600">{mockCredential.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${levelInfo.color}`}
                      >
                        {levelInfo.icon}
                        {levelInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="border-b bg-gray-50 p-6">
                <div className="flex items-center justify-center gap-4">
                  {mockCredential.claims.badges.map((badge, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2"
                    >
                      <span className="text-xl">{badge.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{badge.name}</div>
                        <div className="text-xs text-gray-500">{badge.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statistics */}
              <div className="border-b p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Verified Statistics</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {mockCredential.claims.statistics.totalProjects}
                    </div>
                    <div className="text-sm text-gray-600">Total Projects</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {mockCredential.claims.statistics.totalEarnings}
                    </div>
                    <div className="text-sm text-gray-600">Verified Earnings</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold text-yellow-600">
                      <Star className="h-5 w-5 fill-current" />
                      {mockCredential.claims.statistics.avgRating}
                    </div>
                    <div className="text-sm text-gray-600">Average Rating</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {mockCredential.claims.statistics.totalReviews}
                    </div>
                    <div className="text-sm text-gray-600">Client Reviews</div>
                  </div>
                </div>
              </div>

              {/* Connected Platforms */}
              <div className="border-b p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Connected Platforms</h3>
                <div className="flex gap-3">
                  {mockCredential.claims.platforms.map((platform, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${
                        platform.verified ? 'border-green-200 bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      {platform.verified && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      <span className="font-medium text-gray-900">{platform.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Skills */}
              <div className="border-b p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Verified Skills</h3>
                <div className="grid grid-cols-2 gap-3">
                  {mockCredential.claims.topSkills.map((skill, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{skill.name}</div>
                        <div className="text-sm text-gray-500">{skill.projects} projects</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          skill.level === 'Expert'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {skill.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issuance Details */}
              <div className="border-b p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Credential Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Credential ID</span>
                    <span className="font-mono text-gray-900">{mockCredential.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issued By</span>
                    <span className="text-gray-900">{mockCredential.issuer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issued At</span>
                    <span className="text-gray-900">
                      {new Date(mockCredential.issuedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expires At</span>
                    <span className="text-gray-900">
                      {new Date(mockCredential.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Details (Collapsible) */}
              <div className="border-b">
                <button
                  onClick={() => setShowTechnical(!showTechnical)}
                  className="flex w-full items-center justify-between p-4 text-gray-700 hover:bg-gray-50"
                >
                  <span className="font-medium">Technical Verification Details</span>
                  {showTechnical ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                {showTechnical && (
                  <div className="px-6 pb-6">
                    <div className="overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-xs text-green-400">
                      <div className="mb-2 text-gray-500">// Cryptographic Signature</div>
                      <div>Type: {mockCredential.signature.type}</div>
                      <div>Created: {mockCredential.signature.created}</div>
                      <div>Purpose: {mockCredential.signature.proofPurpose}</div>
                      <div>Method: {mockCredential.signature.verificationMethod}</div>
                      <div className="mt-2 text-gray-500">// Blockchain Anchor</div>
                      <div>Network: {mockCredential.blockchainAnchor.network}</div>
                      <div>TX: {mockCredential.blockchainAnchor.txHash}</div>
                      <div>Block: {mockCredential.blockchainAnchor.blockNumber}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 bg-gray-50 p-6">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-medium hover:bg-white">
                  <Download className="h-5 w-5" />
                  Download PDF
                </button>
                <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-medium hover:bg-white">
                  <QrCode className="h-5 w-5" />
                  QR Code
                </button>
              </div>
            </>
          )}

          {status === 'expired' && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Credential Expired</h2>
              <p className="mt-2 text-gray-600">
                This credential was valid but has expired. The holder can renew it.
              </p>
            </div>
          )}

          {status === 'revoked' && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Credential Revoked</h2>
              <p className="mt-2 text-gray-600">
                This credential has been revoked and is no longer valid.
              </p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Invalid Credential</h2>
              <p className="mt-2 text-gray-600">
                This credential could not be verified. It may have been tampered with.
              </p>
            </div>
          )}
        </div>

        {/* Trust Explanation */}
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-900">Why Trust This Credential?</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <Link2 className="h-5 w-5 text-indigo-600" />
              </div>
              <h4 className="font-medium text-gray-900">Platform Verified</h4>
              <p className="mt-1 text-sm text-gray-600">
                Data was imported directly from connected freelance platforms via secure OAuth
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900">Cryptographically Signed</h4>
              <p className="mt-1 text-sm text-gray-600">
                Digital signature ensures the credential hasn't been modified since issuance
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900">Blockchain Anchored</h4>
              <p className="mt-1 text-sm text-gray-600">
                Proof of existence recorded on Polygon blockchain for permanent verification
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This credential follows the{' '}
            <a
              href="https://www.w3.org/TR/vc-data-model/"
              className="text-indigo-600 hover:underline"
            >
              W3C Verifiable Credentials
            </a>{' '}
            standard
          </p>
        </div>
      </div>
    </div>
  );
}

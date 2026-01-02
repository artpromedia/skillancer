'use client';

/**
 * Credentials Dashboard
 * Manage and export verifiable credentials
 * Sprint M4: Portable Verified Work History
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  FileText,
  Image,
  Code,
  QrCode,
  Linkedin,
  Globe,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Lock,
  BadgeCheck,
  Star,
  TrendingUp,
  Award,
} from 'lucide-react';

// Mock credentials data
const mockCredentials = [
  {
    id: 'cred-1',
    type: 'CompleteProfile',
    title: 'Verified Freelancer Profile',
    issuedAt: '2024-01-15',
    expiresAt: '2025-01-15',
    status: 'active',
    verificationLevel: 'CRYPTOGRAPHICALLY_SEALED',
    data: {
      platforms: ['upwork', 'fiverr', 'freelancer'],
      totalEarnings: '$127,450',
      projectCount: 156,
      avgRating: 4.9,
    },
  },
  {
    id: 'cred-2',
    type: 'WorkHistory',
    title: 'Work History Certificate',
    issuedAt: '2024-01-15',
    expiresAt: '2025-01-15',
    status: 'active',
    verificationLevel: 'PLATFORM_VERIFIED',
    data: {
      projectCount: 156,
      categories: ['Web Development', 'Mobile Apps', 'API Integration'],
    },
  },
  {
    id: 'cred-3',
    type: 'Earnings',
    title: 'Verified Earnings Record',
    issuedAt: '2024-01-15',
    expiresAt: '2025-01-15',
    status: 'active',
    verificationLevel: 'CRYPTOGRAPHICALLY_SEALED',
    data: {
      totalEarnings: '$127,450',
      avgProjectValue: '$817',
    },
  },
  {
    id: 'cred-4',
    type: 'Skills',
    title: 'Verified Skills Certificate',
    issuedAt: '2024-01-10',
    expiresAt: '2025-01-10',
    status: 'active',
    verificationLevel: 'PLATFORM_VERIFIED',
    data: {
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      topSkill: 'React',
    },
  },
  {
    id: 'cred-5',
    type: 'Reviews',
    title: 'Client Reviews Summary',
    issuedAt: '2024-01-10',
    expiresAt: '2025-01-10',
    status: 'active',
    verificationLevel: 'PLATFORM_CONNECTED',
    data: {
      totalReviews: 142,
      avgRating: 4.9,
      positiveRate: '98%',
    },
  },
];

const credentialTypeIcons: Record<string, React.ReactNode> = {
  CompleteProfile: <BadgeCheck className="w-5 h-5" />,
  WorkHistory: <FileText className="w-5 h-5" />,
  Earnings: <TrendingUp className="w-5 h-5" />,
  Skills: <Award className="w-5 h-5" />,
  Reviews: <Star className="w-5 h-5" />,
};

const verificationColors: Record<string, string> = {
  SELF_REPORTED: 'bg-gray-100 text-gray-700',
  PLATFORM_CONNECTED: 'bg-blue-100 text-blue-700',
  PLATFORM_VERIFIED: 'bg-green-100 text-green-700',
  CRYPTOGRAPHICALLY_SEALED: 'bg-purple-100 text-purple-700',
};

const verificationLabels: Record<string, string> = {
  SELF_REPORTED: 'Self-Reported',
  PLATFORM_CONNECTED: 'Connected',
  PLATFORM_VERIFIED: 'Verified',
  CRYPTOGRAPHICALLY_SEALED: 'Sealed',
};

type ExportFormat = 'json-ld' | 'jwt' | 'pdf' | 'png' | 'embed' | 'linkedin' | 'qr';

export default function CredentialsDashboard() {
  const router = useRouter();
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCredential = (id: string) => {
    setSelectedCredentials((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const copyVerificationUrl = (id: string) => {
    navigator.clipboard.writeText(`https://skillancer.com/verify/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = (format: ExportFormat) => {
    setExportFormat(format);
    // In production, this would trigger actual export
    setTimeout(() => {
      setShowExportModal(false);
      setExportFormat(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Verifiable Credentials</h1>
              <p className="mt-1 text-gray-600">
                Export and share your verified professional credentials
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard/work-history')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Work History
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                disabled={selectedCredentials.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => {
              setSelectedCredentials(mockCredentials.map((c) => c.id));
              setShowExportModal(true);
            }}
            className="p-4 bg-white rounded-xl border hover:border-indigo-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="font-medium text-gray-900">Export All as PDF</div>
            <div className="text-sm text-gray-500">Complete credential package</div>
          </button>

          <button
            onClick={() => handleExport('linkedin')}
            className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <Linkedin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="font-medium text-gray-900">Add to LinkedIn</div>
            <div className="text-sm text-gray-500">Add as certification</div>
          </button>

          <button
            onClick={() => handleExport('embed')}
            className="p-4 bg-white rounded-xl border hover:border-green-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <Code className="w-5 h-5 text-green-600" />
            </div>
            <div className="font-medium text-gray-900">Embed Badge</div>
            <div className="text-sm text-gray-500">HTML/Markdown code</div>
          </button>

          <button
            onClick={() => handleExport('qr')}
            className="p-4 bg-white rounded-xl border hover:border-purple-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <QrCode className="w-5 h-5 text-purple-600" />
            </div>
            <div className="font-medium text-gray-900">Generate QR Code</div>
            <div className="text-sm text-gray-500">Scannable verification</div>
          </button>
        </div>

        {/* Trust Badge Preview */}
        <div className="bg-white rounded-2xl border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Trust Badge</h2>
            <button className="text-sm text-indigo-600 hover:text-indigo-700">
              Customize Badge
            </button>
          </div>

          <div className="flex items-center gap-8">
            {/* Badge Preview */}
            <div className="flex-shrink-0">
              <div className="w-48 h-48 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-4 -translate-x-4" />
                <div className="relative z-10">
                  <div className="text-sm font-medium opacity-80">Verified by</div>
                  <div className="text-xl font-bold">Skillancer</div>
                  <div className="mt-4">
                    <div className="text-3xl font-bold">4.9</div>
                    <div className="text-sm opacity-80">Rating • 156 Projects</div>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs">Cryptographically Sealed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge Stats */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">156</div>
                <div className="text-sm text-gray-600">Verified Projects</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">$127K+</div>
                <div className="text-sm text-gray-600">Verified Earnings</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">142</div>
                <div className="text-sm text-gray-600">Client Reviews</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">3</div>
                <div className="text-sm text-gray-600">Connected Platforms</div>
              </div>
            </div>

            {/* Embed Code */}
            <div className="w-80">
              <div className="text-sm font-medium text-gray-700 mb-2">Embed Code</div>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 overflow-x-auto">
                &lt;a href="https://skillancer.com/verify/abc123"&gt;
                <br />
                &nbsp;&nbsp;&lt;img src="https://skillancer.com/badge/abc123.svg" /&gt;
                <br />
                &lt;/a&gt;
              </div>
              <button className="mt-2 w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" />
                Copy Embed Code
              </button>
            </div>
          </div>
        </div>

        {/* Credentials List */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Your Credentials</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {selectedCredentials.length} selected
                </span>
                {selectedCredentials.length > 0 && (
                  <button
                    onClick={() => setSelectedCredentials([])}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y">
            {mockCredentials.map((credential) => (
              <div
                key={credential.id}
                className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedCredentials.includes(credential.id) ? 'bg-indigo-50' : ''
                }`}
                onClick={() => toggleCredential(credential.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      selectedCredentials.includes(credential.id)
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedCredentials.includes(credential.id) && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
                    {credentialTypeIcons[credential.type]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{credential.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          verificationColors[credential.verificationLevel]
                        }`}
                      >
                        {verificationLabels[credential.verificationLevel]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Issued {new Date(credential.issuedAt).toLocaleDateString()} • Expires{' '}
                      {new Date(credential.expiresAt).toLocaleDateString()}
                    </p>

                    {/* Credential Data Preview */}
                    <div className="flex gap-4 mt-3">
                      {Object.entries(credential.data)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-500 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>{' '}
                            <span className="font-medium text-gray-900">
                              {Array.isArray(value) ? value.join(', ') : String(value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => copyVerificationUrl(credential.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Copy verification URL"
                    >
                      {copiedId === credential.id ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => router.push(`/verify/${credential.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Preview"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCredentials([credential.id]);
                        setShowExportModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Export"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verification History */}
        <div className="mt-8 bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">Verification Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                {
                  action: 'Credential verified',
                  detail: 'LinkedIn user viewed your profile',
                  time: '2 hours ago',
                },
                {
                  action: 'Badge embedded',
                  detail: 'Added to portfolio at myportfolio.dev',
                  time: '1 day ago',
                },
                {
                  action: 'QR code scanned',
                  detail: 'Mobile verification from New York, US',
                  time: '3 days ago',
                },
                {
                  action: 'Credential verified',
                  detail: 'Enterprise client: Acme Corp',
                  time: '1 week ago',
                },
              ].map((event, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{event.action}</span>
                    <span className="text-gray-500"> • {event.detail}</span>
                  </div>
                  <div className="text-sm text-gray-400">{event.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Export Credentials</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose a format to export {selectedCredentials.length} credential(s)
              </p>
            </div>

            <div className="p-6 space-y-3">
              {[
                {
                  id: 'pdf',
                  icon: FileText,
                  title: 'PDF Certificate',
                  desc: 'Printable certificate with QR verification',
                },
                {
                  id: 'png',
                  icon: Image,
                  title: 'PNG Badge',
                  desc: 'Visual badge for websites and profiles',
                },
                {
                  id: 'json-ld',
                  icon: Code,
                  title: 'JSON-LD (W3C VC)',
                  desc: 'Standard verifiable credential format',
                },
                {
                  id: 'jwt',
                  icon: Lock,
                  title: 'JWT Token',
                  desc: 'Cryptographically signed token',
                },
                {
                  id: 'linkedin',
                  icon: Linkedin,
                  title: 'Add to LinkedIn',
                  desc: 'Add as LinkedIn certification',
                },
                {
                  id: 'embed',
                  icon: Globe,
                  title: 'Embed Code',
                  desc: 'HTML/Markdown for websites',
                },
              ].map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.id as ExportFormat)}
                  className={`w-full p-4 border rounded-xl text-left hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center gap-4 ${
                    exportFormat === format.id ? 'border-indigo-500 bg-indigo-50' : ''
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <format.icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{format.title}</div>
                    <div className="text-sm text-gray-500">{format.desc}</div>
                  </div>
                  {exportFormat === format.id && (
                    <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportFormat(null);
                }}
                className="w-full py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

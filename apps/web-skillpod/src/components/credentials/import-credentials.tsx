'use client';

import { cn } from '@skillancer/ui';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Award,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

interface ExternalCredential {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  status: 'pending' | 'verified' | 'failed';
  category?: string;
  file?: {
    name: string;
    type: string;
    size: number;
  };
}

interface ImportCredentialsProps {
  onImport?: (credential: ExternalCredential) => void;
  onVerify?: (credentialId: string) => Promise<boolean>;
}

export function ImportCredentials({ onImport, onVerify }: Readonly<ImportCredentialsProps>) {
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'manual'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [credentialUrl, setCredentialUrl] = useState('');
  const [manualData, setManualData] = useState({
    name: '',
    issuer: '',
    credentialId: '',
    issueDate: '',
    expiryDate: '',
  });
  const [importedCredentials, setImportedCredentials] = useState<ExternalCredential[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsUploading(true);
    setError(null);

    try {
      // Simulate file processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock extracted data
      const credential: ExternalCredential = {
        id: `ext-${Date.now()}`,
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        issueDate: '2023-06-15',
        expiryDate: '2026-06-15',
        credentialId: 'AWS-SAA-001234',
        status: 'pending',
        category: 'Cloud',
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
      };

      setImportedCredentials((prev) => [...prev, credential]);
      onImport?.(credential);
    } catch (err) {
      console.error(err);
      setError('Failed to process the credential file');
    } finally {
      setIsUploading(false);
      setUploadedFile(null);
    }
  };

  const handleLinkImport = async () => {
    if (!credentialUrl.trim()) return;

    setIsUploading(true);
    setError(null);

    try {
      // Validate URL
      new URL(credentialUrl);

      // Simulate fetching credential data
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock extracted data based on URL patterns
      let credential: ExternalCredential;

      if (credentialUrl.includes('credly')) {
        credential = {
          id: `ext-${Date.now()}`,
          name: 'Google Cloud Professional Data Engineer',
          issuer: 'Google Cloud',
          issueDate: '2023-09-20',
          credentialId: 'GCP-PDE-56789',
          credentialUrl,
          status: 'pending',
          category: 'Cloud',
        };
      } else if (credentialUrl.includes('linkedin')) {
        credential = {
          id: `ext-${Date.now()}`,
          name: 'LinkedIn Learning Certificate',
          issuer: 'LinkedIn',
          issueDate: '2024-01-10',
          credentialUrl,
          status: 'pending',
          category: 'Professional Development',
        };
      } else {
        credential = {
          id: `ext-${Date.now()}`,
          name: 'External Credential',
          issuer: new URL(credentialUrl).hostname,
          issueDate: new Date().toISOString().split('T')[0],
          credentialUrl,
          status: 'pending',
        };
      }

      setImportedCredentials((prev) => [...prev, credential]);
      onImport?.(credential);
      setCredentialUrl('');
    } catch (err) {
      console.error(err);
      setError('Please enter a valid credential URL');
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualData.name || !manualData.issuer || !manualData.issueDate) {
      setError('Please fill in all required fields');
      return;
    }

    const credential: ExternalCredential = {
      id: `ext-${Date.now()}`,
      name: manualData.name,
      issuer: manualData.issuer,
      credentialId: manualData.credentialId || undefined,
      issueDate: manualData.issueDate,
      expiryDate: manualData.expiryDate || undefined,
      status: 'pending',
    };

    setImportedCredentials((prev) => [...prev, credential]);
    onImport?.(credential);
    setManualData({
      name: '',
      issuer: '',
      credentialId: '',
      issueDate: '',
      expiryDate: '',
    });
    setError(null);
  };

  const handleVerify = async (credentialId: string) => {
    setIsVerifying(true);

    try {
      const success = (await onVerify?.(credentialId)) ?? Math.random() > 0.3;

      setImportedCredentials((prev) =>
        prev.map((c) =>
          c.id === credentialId ? { ...c, status: success ? 'verified' : 'failed' } : c
        )
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemove = (credentialId: string) => {
    setImportedCredentials((prev) => prev.filter((c) => c.id !== credentialId));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-indigo-100 p-2">
          <Upload className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Import External Credentials</h3>
          <p className="text-sm text-gray-500">Add certificates from other platforms</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
            activeTab === 'upload'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('upload')}
        >
          <FileText className="mr-1 inline h-4 w-4" />
          Upload File
        </button>
        <button
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
            activeTab === 'link'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('link')}
        >
          <LinkIcon className="mr-1 inline h-4 w-4" />
          From URL
        </button>
        <button
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
            activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('manual')}
        >
          <Award className="mr-1 inline h-4 w-4" />
          Manual Entry
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <button
          className={cn(
            'w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isUploading ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'
          )}
          type="button"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void handleFileUpload(file);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('credential-file')?.click();
            }
          }}
        >
          <input
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            id="credential-file"
            type="file"
            onChange={(e) => e.target.files?.[0] && void handleFileUpload(e.target.files[0])}
          />

          {isUploading ? (
            <div>
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-gray-600">Processing {uploadedFile?.name}...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="mb-1 text-gray-600">
                Drag and drop your credential file, or{' '}
                <label
                  className="cursor-pointer text-indigo-600 hover:underline"
                  htmlFor="credential-file"
                >
                  browse
                </label>
              </p>
              <p className="text-xs text-gray-400">Supported: PDF, PNG, JPG (max 10MB)</p>
            </>
          )}
        </button>
      )}

      {/* Link Tab */}
      {activeTab === 'link' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Paste a link to your credential from platforms like Credly, Coursera, or LinkedIn
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              placeholder="https://www.credly.com/badges/..."
              type="url"
              value={credentialUrl}
              onChange={(e) => setCredentialUrl(e.target.value)}
            />
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={isUploading || !credentialUrl.trim()}
              onClick={() => void handleLinkImport()}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Supported platforms:</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">Credly</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">Coursera</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">LinkedIn</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">Udemy</span>
          </div>
        </div>
      )}

      {/* Manual Tab */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="credential-name"
              >
                Credential Name *
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                id="credential-name"
                placeholder="AWS Certified Developer"
                type="text"
                value={manualData.name}
                onChange={(e) => setManualData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="credential-issuer"
              >
                Issuing Organization *
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                id="credential-issuer"
                placeholder="Amazon Web Services"
                type="text"
                value={manualData.issuer}
                onChange={(e) => setManualData((p) => ({ ...p, issuer: e.target.value }))}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="credential-id"
              >
                Credential ID
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                id="credential-id"
                placeholder="ABC-123-XYZ"
                type="text"
                value={manualData.credentialId}
                onChange={(e) => setManualData((p) => ({ ...p, credentialId: e.target.value }))}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="credential-issue-date"
              >
                Issue Date *
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                id="credential-issue-date"
                type="date"
                value={manualData.issueDate}
                onChange={(e) => setManualData((p) => ({ ...p, issueDate: e.target.value }))}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="credential-expiry-date"
              >
                Expiry Date
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                id="credential-expiry-date"
                type="date"
                value={manualData.expiryDate}
                onChange={(e) => setManualData((p) => ({ ...p, expiryDate: e.target.value }))}
              />
            </div>
          </div>
          <button
            className="w-full rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700"
            onClick={handleManualAdd}
          >
            Add Credential
          </button>
        </div>
      )}

      {/* Imported Credentials List */}
      {importedCredentials.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="mb-4 font-medium text-gray-900">Imported Credentials</h4>
          <div className="space-y-3">
            {importedCredentials.map((cred) => (
              <div key={cred.id} className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
                <Award className="h-8 w-8 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{cred.name}</p>
                  <p className="text-sm text-gray-500">
                    {cred.issuer} • {new Date(cred.issueDate).toLocaleDateString()}
                  </p>
                </div>

                {/* Status */}
                {cred.status === 'pending' && (
                  <button
                    className="rounded bg-indigo-100 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-200"
                    disabled={isVerifying}
                    onClick={() => void handleVerify(cred.id)}
                  >
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </button>
                )}
                {cred.status === 'verified' && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified
                  </span>
                )}
                {cred.status === 'failed' && (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    Failed
                  </span>
                )}

                <button
                  className="p-1 text-gray-400 hover:text-red-600"
                  onClick={() => handleRemove(cred.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportCredentials;

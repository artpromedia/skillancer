'use client';

import { cn } from '@skillancer/ui';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  QrCode,
  Printer,
  Copy,
  Shield,
  Calendar,
} from 'lucide-react';
import { useState, useRef } from 'react';

interface CredentialCertificateProps {
  credential: {
    id: string;
    name: string;
    badge: string;
    level: string;
    category: string;
    score: number;
    percentile: number;
    issueDate: string;
    expiryDate?: string;
    verificationCode: string;
    verificationUrl: string;
    holder: {
      name: string;
    };
    issuer: {
      name: string;
    };
    skills: string[];
  };
  onDownload?: (format: 'pdf' | 'png') => void;
}

export function CredentialCertificate({
  credential,
  onDownload,
}: Readonly<CredentialCertificateProps>) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'png' | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

  const handleDownload = async (format: 'pdf' | 'png') => {
    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      // Simulate download process
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onDownload?.(format);
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  };

  return (
    <div>
      {/* Certificate Preview */}
      <div
        ref={certificateRef}
        className="relative aspect-[1.414/1] overflow-hidden rounded-xl border border-gray-200 bg-white p-8"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)
          `,
        }}
      >
        {/* Border Pattern */}
        <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-indigo-200" />
        <div className="pointer-events-none absolute inset-6 rounded-lg border border-indigo-100" />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-between py-4 text-center">
          {/* Header */}
          <div>
            <div className="mb-2 flex items-center justify-center gap-2 text-indigo-600">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Skillancer</span>
            </div>
            <h2 className="text-xs uppercase tracking-widest text-gray-500">
              Certificate of Achievement
            </h2>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <span className="mb-4 text-5xl">{credential.badge}</span>
            <h3 className="mb-1 text-xl font-bold text-gray-900">{credential.name}</h3>
            <p className="mb-6 text-sm text-gray-500">
              {credential.category} • {credential.level}
            </p>

            <p className="text-sm text-gray-600">This certifies that</p>
            <p className="my-2 text-2xl font-bold text-gray-900">{credential.holder.name}</p>
            <p className="text-sm text-gray-600">has successfully demonstrated proficiency in</p>

            {/* Skills */}
            <div className="mt-3 flex max-w-md flex-wrap justify-center gap-1">
              {credential.skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {skill}
                </span>
              ))}
              {credential.skills.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-gray-400">
                  +{credential.skills.length - 4} more
                </span>
              )}
            </div>

            {/* Score */}
            <div className="mt-6 flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{credential.score}%</p>
                <p className="text-xs text-gray-500">Score</p>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <p className="text-2xl font-bold text-indigo-600">
                  Top {100 - credential.percentile}%
                </p>
                <p className="text-xs text-gray-500">Percentile</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="w-full">
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Issued: {new Date(credential.issueDate).toLocaleDateString()}</span>
              </div>
              <div className="font-mono">{credential.verificationCode}</div>
              <div>{credential.issuer.name}</div>
            </div>
          </div>
        </div>

        {/* QR Code placeholder */}
        <div className="absolute bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded bg-gray-100">
          <QrCode className="h-8 w-8 text-gray-400" />
        </div>
      </div>

      {/* Download Actions */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
            'bg-indigo-600 text-white hover:bg-indigo-700',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={isDownloading}
          onClick={() => void handleDownload('pdf')}
        >
          {isDownloading && downloadFormat === 'pdf' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Download PDF
            </>
          )}
        </button>

        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
            'border border-gray-200 hover:bg-gray-50',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={isDownloading}
          onClick={() => void handleDownload('png')}
        >
          {isDownloading && downloadFormat === 'png' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4" />
              Download Image
            </>
          )}
        </button>

        <button
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
          onClick={() => globalThis.print()}
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>
    </div>
  );
}

// Compact certificate card for sharing
export function CredentialShareCard({
  credential,
}: Readonly<{
  credential: CredentialCertificateProps['credential'];
}>) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(credential.verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-white/80" />
          <span className="text-sm font-medium text-white/80">Verified Credential</span>
        </div>
        <span className="text-3xl">{credential.badge}</span>
      </div>

      <h3 className="mb-1 text-xl font-bold">{credential.name}</h3>
      <p className="mb-4 text-sm text-white/70">{credential.holder.name}</p>

      <div className="mb-4 flex items-center gap-4">
        <div>
          <p className="text-2xl font-bold">{credential.score}%</p>
          <p className="text-xs text-white/60">Score</p>
        </div>
        <div>
          <p className="text-2xl font-bold">Top {100 - credential.percentile}%</p>
          <p className="text-xs text-white/60">Percentile</p>
        </div>
      </div>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 transition-colors hover:bg-white/20"
        onClick={() => void copyLink()}
      >
        {copied ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Link Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Verification Link
          </>
        )}
      </button>
    </div>
  );
}

export default CredentialCertificate;

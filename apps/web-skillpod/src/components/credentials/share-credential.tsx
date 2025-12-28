'use client';

import { cn } from '@skillancer/ui';
import {
  Share2,
  Copy,
  CheckCircle2,
  Linkedin,
  Twitter,
  Mail,
  Facebook,
  QrCode,
  X,
} from 'lucide-react';
import { useState } from 'react';

type ShareCredentialProps = Readonly<{
  credential: {
    name: string;
    verificationUrl: string;
    verificationCode: string;
    holder: {
      name: string;
    };
    score?: number;
    badge?: string;
  };
  onClose?: () => void;
}>;

export function ShareCredential({ credential, onClose }: ShareCredentialProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'social' | 'embed' | 'qr'>('social');

  const shareText = `I earned the ${credential.name} credential on Skillancer! 🎉`;

  const emailSubject = encodeURIComponent(`My ${credential.name} Credential`);
  const emailBody = encodeURIComponent(
    `${shareText}\n\nVerify it here: ${credential.verificationUrl}`
  );

  const socialLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(credential.verificationUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(credential.verificationUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(credential.verificationUrl)}`,
    email: `mailto:?subject=${emailSubject}&body=${emailBody}`,
  };

  const embedCode = `<a href="${credential.verificationUrl}" target="_blank" rel="noopener noreferrer">
  <img src="https://skillancer.com/api/credential-badge/${credential.verificationCode}" alt="${credential.name} - Verified by Skillancer" />
</a>`;

  const badgeMarkdown = `[![${credential.name}](https://skillancer.com/api/credential-badge/${credential.verificationCode})](${credential.verificationUrl})`;

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2">
              <Share2 className="h-5 w-5 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Share Credential</h2>
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

        {/* Credential Preview */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            {credential.badge && <span className="text-3xl">{credential.badge}</span>}
            <div>
              <h3 className="font-semibold">{credential.name}</h3>
              <p className="text-sm text-white/80">{credential.holder.name}</p>
            </div>
            {credential.score && (
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold">{credential.score}%</p>
                <p className="text-xs text-white/70">Score</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            className={cn(
              '-mb-px flex-1 border-b-2 py-3 text-sm font-medium',
              activeTab === 'social'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500'
            )}
            onClick={() => setActiveTab('social')}
          >
            Social
          </button>
          <button
            className={cn(
              '-mb-px flex-1 border-b-2 py-3 text-sm font-medium',
              activeTab === 'embed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500'
            )}
            onClick={() => setActiveTab('embed')}
          >
            Embed
          </button>
          <button
            className={cn(
              '-mb-px flex-1 border-b-2 py-3 text-sm font-medium',
              activeTab === 'qr'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500'
            )}
            onClick={() => setActiveTab('qr')}
          >
            QR Code
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'social' && (
            <div className="space-y-4">
              {/* Social Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0077b5] px-4 py-3 text-white hover:opacity-90"
                  href={socialLinks.linkedin}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Linkedin className="h-5 w-5" />
                  LinkedIn
                </a>
                <a
                  className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-white hover:opacity-90"
                  href={socialLinks.twitter}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Twitter className="h-5 w-5" />
                  Twitter/X
                </a>
                <a
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#1877f2] px-4 py-3 text-white hover:opacity-90"
                  href={socialLinks.facebook}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Facebook className="h-5 w-5" />
                  Facebook
                </a>
                <a
                  className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-3 text-white hover:opacity-90"
                  href={socialLinks.email}
                >
                  <Mail className="h-5 w-5" />
                  Email
                </a>
              </div>

              {/* Copy Link */}
              <div className="border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm text-gray-500">Or copy the verification link:</p>
                <div className="flex gap-2">
                  <div className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {credential.verificationUrl}
                  </div>
                  <button
                    className={cn(
                      'rounded-lg px-4 py-2 transition-colors',
                      copied === 'link'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    )}
                    onClick={() => void copyToClipboard(credential.verificationUrl, 'link')}
                  >
                    {copied === 'link' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              {/* HTML Embed */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">HTML Embed</span>
                  <button
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    onClick={() => void copyToClipboard(embedCode, 'html')}
                  >
                    {copied === 'html' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied === 'html' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  {embedCode}
                </pre>
              </div>

              {/* Markdown */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Markdown</span>
                  <button
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    onClick={() => void copyToClipboard(badgeMarkdown, 'markdown')}
                  >
                    {copied === 'markdown' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied === 'markdown' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  {badgeMarkdown}
                </pre>
              </div>

              {/* Preview */}
              <div className="border-t border-gray-100 pt-4">
                <p className="mb-3 text-sm text-gray-500">Badge Preview:</p>
                <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white">
                  <span>{credential.badge}</span>
                  <span className="font-medium">{credential.name}</span>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="text-center">
              {/* QR Code Placeholder */}
              <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-xl bg-gray-100">
                <QrCode className="h-24 w-24 text-gray-400" />
              </div>
              <p className="mb-4 text-sm text-gray-500">Scan to verify this credential</p>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
                Download QR Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline share button
export function ShareButton({
  credential,
  variant = 'default',
}: Readonly<{
  credential: ShareCredentialProps['credential'];
  variant?: 'default' | 'compact';
}>) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <button
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
          onClick={() => setIsOpen(true)}
        >
          <Share2 className="h-4 w-4" />
        </button>
        {isOpen && <ShareCredential credential={credential} onClose={() => setIsOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
        onClick={() => setIsOpen(true)}
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>
      {isOpen && <ShareCredential credential={credential} onClose={() => setIsOpen(false)} />}
    </>
  );
}

export default ShareCredential;

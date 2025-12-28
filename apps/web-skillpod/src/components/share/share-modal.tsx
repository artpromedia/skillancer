'use client';

import { cn } from '@skillancer/ui';
import {
  Share2,
  Copy,
  CheckCircle2,
  X,
  Linkedin,
  Twitter,
  Mail,
  Facebook,
  Link as LinkIcon,
  MessageCircle,
  Send,
} from 'lucide-react';
import { useState } from 'react';

interface ShareItem {
  type: 'credential' | 'profile' | 'portfolio' | 'assessment';
  title: string;
  description?: string;
  url: string;
  image?: string;
}

interface ShareModalProps {
  item: ShareItem;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ item, isOpen, onClose }: Readonly<ShareModalProps>) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareText = {
    credential: `Check out my ${item.title} credential on Skillancer! 🎉`,
    profile: `Check out my professional profile on Skillancer!`,
    portfolio: `Take a look at my portfolio: ${item.title}`,
    assessment: `I just completed the ${item.title} assessment on Skillancer!`,
  }[item.type];

  const platforms = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-[#0077b5]',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(item.url)}`,
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: Twitter,
      color: 'bg-black',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(item.url)}`,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-[#1877f2]',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(item.url)}`,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-[#25d366]',
      url: (() => {
        const whatsappText = `${shareText} ${item.url}`;
        return `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
      })(),
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      color: 'bg-[#0088cc]',
      url: `https://t.me/share/url?url=${encodeURIComponent(item.url)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      color: 'bg-gray-800',
      url: (() => {
        const emailBody = `${shareText}\n\n${item.url}`;
        return `mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(emailBody)}`;
      })(),
    },
  ];

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <dialog
        open
        aria-labelledby="share-modal-title"
        className="animate-in fade-in slide-in-from-bottom-4 relative m-0 w-full max-w-md overflow-hidden rounded-2xl bg-white p-0 shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900" id="share-modal-title">
            Share
          </h2>
          <button className="rounded-lg p-2 transition-colors hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="px-6 py-4">
          <div className="flex gap-4 rounded-xl bg-gray-50 p-4">
            {item.image ? (
              <img
                alt={item.title}
                className="h-16 w-16 rounded-lg object-cover"
                src={item.image}
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Share2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{item.title}</p>
              {item.description && (
                <p className="line-clamp-2 text-sm text-gray-500">{item.description}</p>
              )}
              <p className="mt-1 truncate text-xs text-indigo-600">{item.url}</p>
            </div>
          </div>
        </div>

        {/* Social Platforms */}
        <div className="px-6">
          <p className="mb-3 text-sm text-gray-500">Share to</p>
          <div className="grid grid-cols-3 gap-2">
            {platforms.map((platform) => (
              <a
                key={platform.id}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl py-3 text-white transition-transform hover:scale-105',
                  platform.color
                )}
                href={platform.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <platform.icon className="h-5 w-5" />
                <span className="text-xs">{platform.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Copy Link */}
        <div className="p-6">
          <p className="mb-2 text-sm text-gray-500">Or copy link</p>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
              <LinkIcon className="h-4 w-4 text-gray-400" />
              <span className="truncate text-sm text-gray-600">{item.url}</span>
            </div>
            <button
              className={cn(
                'rounded-lg px-4 py-2 font-medium transition-colors',
                copied === 'link'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              )}
              onClick={() => void copyToClipboard(item.url, 'link')}
            >
              {copied === 'link' ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Copied
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-4 w-4" />
                  Copy
                </span>
              )}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

// Hook for share modal
export function useShareModal() {
  const [shareItem, setShareItem] = useState<ShareItem | null>(null);

  const openShare = (item: ShareItem) => setShareItem(item);
  const closeShare = () => setShareItem(null);

  const ShareModalComponent = shareItem ? (
    <ShareModal isOpen={true} item={shareItem} onClose={closeShare} />
  ) : null;

  return {
    openShare,
    closeShare,
    ShareModal: ShareModalComponent,
  };
}

// Quick share button with dropdown
export function QuickShareButton({
  item,
  className,
}: Readonly<{ item: ShareItem; className?: string }>) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>

      {isOpen && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-2 shadow-lg duration-150">
            <button
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                void copyLink();
                setIsOpen(false);
              }}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(item.url)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Linkedin className="h-4 w-4" />
              Share on LinkedIn
            </a>
            <a
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(item.url)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Twitter className="h-4 w-4" />
              Share on Twitter
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export default ShareModal;

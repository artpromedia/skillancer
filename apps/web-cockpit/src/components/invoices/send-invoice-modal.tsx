'use client';

import { cn } from '@skillancer/ui';
import {
  Send,
  Mail,
  Copy,
  Link,
  Eye,
  Clock,
  Calendar,
  CheckCircle,
  Info,
  Paperclip,
  X,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: SendOptions) => void;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  total: number;
  dueDate: string;
}

interface SendOptions {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message: string;
  attachPdf: boolean;
  sendCopy: boolean;
  scheduleDate?: string;
}

export function SendInvoiceModal({
  isOpen,
  onClose,
  onSend,
  invoiceNumber,
  clientName,
  clientEmail,
  total,
  dueDate,
}: Readonly<SendInvoiceModalProps>) {
  const [to, setTo] = useState(clientEmail);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber} from Skillancer`);
  const [message, setMessage] = useState(
    `Hi ${clientName},\n\nPlease find attached invoice ${invoiceNumber} for $${total.toLocaleString()}.\n\nPayment is due by ${new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.\n\nPlease let me know if you have any questions.\n\nThank you for your business!`
  );
  const [attachPdf, setAttachPdf] = useState(true);
  const [sendCopy, setSendCopy] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onSend({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      message,
      attachPdf,
      sendCopy,
      scheduleDate: scheduleMode === 'later' ? scheduleDate : undefined,
    });
    setIsSending(false);
    onClose();
  };

  const copyPaymentLink = async () => {
    await navigator.clipboard.writeText(
      `https://pay.skillancer.com/inv/${invoiceNumber.toLowerCase()}`
    );
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Send Invoice</h2>
            <p className="mt-1 text-sm text-gray-500">
              {invoiceNumber} • ${total.toLocaleString()}
            </p>
          </div>
          <button className="rounded-lg p-2 transition-colors hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Recipients */}
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700"
                htmlFor="send-invoice-to"
              >
                To
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  id="send-invoice-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            {showCcBcc ? (
              <>
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="send-invoice-cc"
                  >
                    Cc
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="send-invoice-cc"
                    placeholder="Add cc recipients"
                    type="email"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="send-invoice-bcc"
                  >
                    Bcc
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="send-invoice-bcc"
                    placeholder="Add bcc recipients"
                    type="email"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <button
                className="text-sm text-indigo-600 hover:text-indigo-700"
                onClick={() => setShowCcBcc(true)}
              >
                Add Cc/Bcc
              </button>
            )}
          </div>

          {/* Subject */}
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="send-invoice-subject"
            >
              Subject
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="send-invoice-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="send-invoice-message"
            >
              Message
            </label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="send-invoice-message"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                checked={attachPdf}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                type="checkbox"
                onChange={(e) => setAttachPdf(e.target.checked)}
              />
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">Attach PDF copy of invoice</span>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                checked={sendCopy}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                type="checkbox"
                onChange={(e) => setSendCopy(e.target.checked)}
              />
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">Send me a copy</span>
              </div>
            </label>
          </div>

          {/* Schedule */}
          <div className="space-y-4 rounded-lg bg-gray-50 p-4">
            <div className="flex gap-4">
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
                  scheduleMode === 'now'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => setScheduleMode('now')}
              >
                <Send className="h-4 w-4" />
                Send Now
              </button>
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
                  scheduleMode === 'later'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => setScheduleMode('later')}
              >
                <Clock className="h-4 w-4" />
                Schedule
              </button>
            </div>

            {scheduleMode === 'later' && (
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="send-invoice-schedule-date"
                >
                  Send on
                </label>
                <div className="relative w-48">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="send-invoice-schedule-date"
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment Link */}
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">Payment link included</p>
                <p className="mt-1 text-sm text-blue-700">
                  Your client will receive a secure link to pay online via credit card, bank
                  transfer, or PayPal.
                </p>
                <button
                  className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  onClick={() => void copyPaymentLink()}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4" />
                      Copy payment link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 p-6">
          <button
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            onClick={onClose}
          >
            <Eye className="h-4 w-4" />
            Preview Email
          </button>
          <div className="flex gap-3">
            <button
              className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={cn(
                'flex items-center gap-2 rounded-lg px-6 py-2 transition-colors',
                to && !isSending
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              )}
              disabled={!to || isSending}
              onClick={() => void handleSend()}
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {scheduleMode === 'later' ? 'Schedule' : 'Send Invoice'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SendInvoiceModal;

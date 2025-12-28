'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Camera,
  Upload,
  Search,
  Receipt,
  Eye,
  Check,
  Clock,
  AlertCircle,
  Sparkles,
  FileText,
  Calendar,
  DollarSign,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

type ReceiptStatus = 'pending' | 'processed' | 'matched' | 'error';

interface ReceiptItem {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: ReceiptStatus;
  thumbnailUrl: string;
  extractedData?: {
    merchant?: string;
    amount?: number;
    date?: string;
    category?: string;
  };
  matchedExpenseId?: string;
}

const statusConfig: Record<
  ReceiptStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string | undefined }> }
> = {
  pending: { label: 'Processing', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  processed: { label: 'Processed', color: 'bg-blue-100 text-blue-700', icon: Sparkles },
  matched: { label: 'Matched', color: 'bg-green-100 text-green-700', icon: Check },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// Mock data
const mockReceipts: ReceiptItem[] = [
  {
    id: '1',
    fileName: 'receipt_adobe_jan.jpg',
    uploadedAt: '2024-01-15T10:30:00Z',
    status: 'matched',
    thumbnailUrl: '/receipts/adobe.jpg',
    extractedData: {
      merchant: 'Adobe Inc',
      amount: 54.99,
      date: '2024-01-15',
      category: 'Software & Tools',
    },
    matchedExpenseId: 'exp-1',
  },
  {
    id: '2',
    fileName: 'coffee_meeting.jpg',
    uploadedAt: '2024-01-14T14:22:00Z',
    status: 'processed',
    thumbnailUrl: '/receipts/coffee.jpg',
    extractedData: {
      merchant: 'Starbucks',
      amount: 24.5,
      date: '2024-01-14',
      category: 'Meals & Entertainment',
    },
  },
  {
    id: '3',
    fileName: 'uber_receipt.pdf',
    uploadedAt: '2024-01-13T09:15:00Z',
    status: 'processed',
    thumbnailUrl: '/receipts/uber.jpg',
    extractedData: {
      merchant: 'Uber',
      amount: 32,
      date: '2024-01-13',
      category: 'Travel',
    },
  },
  {
    id: '4',
    fileName: 'hardware_store.jpg',
    uploadedAt: '2024-01-12T16:45:00Z',
    status: 'pending',
    thumbnailUrl: '/receipts/hardware.jpg',
  },
  {
    id: '5',
    fileName: 'blurry_receipt.jpg',
    uploadedAt: '2024-01-11T11:00:00Z',
    status: 'error',
    thumbnailUrl: '/receipts/error.jpg',
  },
];

export default function ReceiptsPage() {
  const [receipts] = useState<ReceiptItem[]>(mockReceipts);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredReceipts = receipts.filter((receipt) => {
    const matchesSearch =
      receipt.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.extractedData?.merchant?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || receipt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      await processFiles(files);
    }
  };

  const processFiles = async (_files: FileList) => {
    setIsUploading(true);
    // Simulate upload and OCR processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsUploading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const stats = {
    total: receipts.length,
    pending: receipts.filter((r) => r.status === 'pending').length,
    processed: receipts.filter((r) => r.status === 'processed').length,
    matched: receipts.filter((r) => r.status === 'matched').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="mb-4 flex items-center gap-4">
            <Link className="rounded-lg p-2 transition-colors hover:bg-gray-100" href="/expenses">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Receipt Scanner</h1>
              <p className="text-sm text-gray-500">
                Upload receipts and we&apos;ll extract the details automatically
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total:</span>
              <span className="ml-1 font-semibold text-gray-900">{stats.total}</span>
            </div>
            <div>
              <span className="text-gray-500">Processing:</span>
              <span className="ml-1 font-semibold text-yellow-600">{stats.pending}</span>
            </div>
            <div>
              <span className="text-gray-500">Ready to match:</span>
              <span className="ml-1 font-semibold text-blue-600">{stats.processed}</span>
            </div>
            <div>
              <span className="text-gray-500">Matched:</span>
              <span className="ml-1 font-semibold text-green-600">{stats.matched}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Upload Area - Drop zone for drag and drop file uploads */}
        <section
          aria-label="Drop files here to upload"
          className={cn(
            'mb-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => {
            void handleDrop(e);
          }}
        >
          <div className="flex flex-col items-center">
            <div
              className={cn('mb-4 rounded-full p-4', dragActive ? 'bg-indigo-100' : 'bg-gray-100')}
            >
              {isUploading ? (
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              ) : (
                <Camera
                  className={cn('h-8 w-8', dragActive ? 'text-indigo-600' : 'text-gray-500')}
                />
              )}
            </div>
            <h3 className="mb-1 text-lg font-medium text-gray-900">
              {isUploading ? 'Processing receipts...' : 'Drop receipts here'}
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              or click to upload. We support JPG, PNG, and PDF files
            </p>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
                <Upload className="h-4 w-4" />
                Upload Files
                <input
                  ref={fileInputRef}
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  type="file"
                  onChange={(e) => {
                    if (e.target.files) {
                      void processFiles(e.target.files);
                    }
                  }}
                />
              </label>
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50">
                <Camera className="h-4 w-4" />
                Take Photo
              </button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-64 rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search receipts..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReceiptStatus | 'all')}
            >
              <option value="all">All Status</option>
              <option value="pending">Processing</option>
              <option value="processed">Processed</option>
              <option value="matched">Matched</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Receipts Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredReceipts.map((receipt) => {
            const StatusIcon = statusConfig[receipt.status].icon;
            return (
              <div
                key={receipt.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                {/* Thumbnail - clickable to open preview */}
                <button
                  className="relative h-40 w-full cursor-pointer bg-gray-100"
                  type="button"
                  onClick={() => setSelectedReceipt(receipt)}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Receipt className="h-12 w-12 text-gray-300" />
                  </div>
                  {receipt.status === 'pending' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <div className="flex flex-col items-center">
                        <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        <span className="text-sm text-gray-600">Extracting data...</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                        statusConfig[receipt.status].color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig[receipt.status].label}
                    </span>
                  </div>
                </button>

                {/* Details */}
                <div className="p-4">
                  <p className="mb-1 truncate font-medium text-gray-900">{receipt.fileName}</p>
                  {receipt.extractedData ? (
                    <div className="space-y-1 text-sm">
                      {receipt.extractedData.merchant && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText className="h-3 w-3" />
                          {receipt.extractedData.merchant}
                        </div>
                      )}
                      {receipt.extractedData.amount && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <DollarSign className="h-3 w-3" />$
                          {receipt.extractedData.amount.toFixed(2)}
                        </div>
                      )}
                      {receipt.extractedData.date && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-3 w-3" />
                          {receipt.extractedData.date}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Uploaded {formatDate(receipt.uploadedAt)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex border-t border-gray-100">
                  {receipt.status === 'processed' && (
                    <button className="flex flex-1 items-center justify-center gap-2 py-2 text-sm text-indigo-600 transition-colors hover:bg-indigo-50">
                      <Check className="h-4 w-4" />
                      Create Expense
                    </button>
                  )}
                  {receipt.status === 'matched' && (
                    <Link
                      className="flex flex-1 items-center justify-center gap-2 py-2 text-sm text-green-600 transition-colors hover:bg-green-50"
                      href={`/expenses/${receipt.matchedExpenseId}`}
                    >
                      <Eye className="h-4 w-4" />
                      View Expense
                    </Link>
                  )}
                  {receipt.status === 'error' && (
                    <button className="flex flex-1 items-center justify-center gap-2 py-2 text-sm text-red-600 transition-colors hover:bg-red-50">
                      <Upload className="h-4 w-4" />
                      Retry Upload
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredReceipts.length === 0 && (
          <div className="py-12 text-center">
            <div className="mb-4 inline-block rounded-full bg-gray-100 p-4">
              <Receipt className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-1 text-lg font-medium text-gray-900">No receipts found</h3>
            <p className="text-sm text-gray-500">Upload your first receipt to get started</p>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900">{selectedReceipt.fileName}</h3>
              <button
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                onClick={() => setSelectedReceipt(null)}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2">
              {/* Image Preview */}
              <div className="flex h-96 items-center justify-center bg-gray-100">
                <Receipt className="h-16 w-16 text-gray-300" />
              </div>
              {/* Extracted Data */}
              <div className="p-6">
                <h4 className="mb-4 text-sm font-medium text-gray-500">EXTRACTED DATA</h4>
                {selectedReceipt.extractedData ? (
                  <div className="space-y-4">
                    <div>
                      <span className="block text-sm text-gray-500">Merchant</span>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedReceipt.extractedData.merchant}
                      </p>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Amount</span>
                      <p className="text-lg font-medium text-gray-900">
                        ${selectedReceipt.extractedData.amount?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Date</span>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedReceipt.extractedData.date}
                      </p>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Category</span>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedReceipt.extractedData.category}
                      </p>
                    </div>
                    <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
                      <Check className="h-4 w-4" />
                      Create Expense from Receipt
                    </button>
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center">
                    <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    <p className="text-sm text-gray-500">Extracting data...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

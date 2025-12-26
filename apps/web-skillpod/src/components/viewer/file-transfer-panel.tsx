/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * File Transfer Panel Component
 *
 * Slide-in panel for file transfers:
 * - Upload with drag-and-drop
 * - Download available files
 * - Pending approval requests
 * - Transfer history
 */

import {
  Badge,
  Button,
  cn,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  File,
  FileText,
  Image,
  Loader2,
  Shield,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type TransferDirection = 'upload' | 'download';
export type TransferStatus =
  | 'pending'
  | 'scanning'
  | 'approved'
  | 'rejected'
  | 'transferring'
  | 'completed'
  | 'failed';

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface PolicyRestrictions {
  maxFileSize: number;
  allowedTypes: string[];
  blockedTypes: string[];
  requireApproval: boolean;
  dlpEnabled: boolean;
}

interface FileTransferPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transfers: FileTransfer[];
  restrictions: PolicyRestrictions;
  onUpload: (files: File[]) => Promise<void>;
  onDownload: (transferId: string) => Promise<void>;
  onCancelTransfer: (transferId: string) => void;
  onRequestApproval: (transferId: string) => Promise<void>;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  return File;
}

function getStatusBadge(status: TransferStatus) {
  const config: Record<
    TransferStatus,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    pending: { variant: 'secondary', label: 'Pending' },
    scanning: { variant: 'secondary', label: 'Scanning' },
    approved: { variant: 'default', label: 'Approved' },
    rejected: { variant: 'destructive', label: 'Rejected' },
    transferring: { variant: 'outline', label: 'Transferring' },
    completed: { variant: 'default', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  const { variant, label } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ============================================================================
// UPLOAD SECTION
// ============================================================================

interface UploadSectionProps {
  restrictions: PolicyRestrictions;
  transfers: FileTransfer[];
  onUpload: (files: File[]) => Promise<void>;
  onCancel: (id: string) => void;
}

function UploadSection({ restrictions, transfers, onUpload, onCancel }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadTransfers = transfers.filter((t) => t.direction === 'upload');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setIsUploading(true);
        await onUpload(files);
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        setIsUploading(true);
        await onUpload(files);
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  return (
    <div className="space-y-4">
      {/* Policy restrictions */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <div className="text-muted-foreground mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="font-medium">Policy Restrictions</span>
        </div>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>• Max file size: {formatFileSize(restrictions.maxFileSize)}</li>
          {restrictions.allowedTypes.length > 0 && (
            <li>• Allowed: {restrictions.allowedTypes.join(', ')}</li>
          )}
          {restrictions.dlpEnabled && <li>• DLP scanning enabled</li>}
          {restrictions.requireApproval && <li>• Requires approval before transfer</li>}
        </ul>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
        ) : (
          <Upload className="text-muted-foreground mx-auto h-8 w-8" />
        )}
        <p className="text-muted-foreground mt-2 text-sm">
          {isDragging ? 'Drop files here' : 'Drag and drop files here'}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">or</p>
        <Button
          className="mt-2"
          disabled={isUploading}
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Files
        </Button>
        <input
          ref={fileInputRef}
          multiple
          className="hidden"
          type="file"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload queue */}
      {uploadTransfers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Upload Queue</h4>
          {uploadTransfers.map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              onCancel={() => onCancel(transfer.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DOWNLOAD SECTION
// ============================================================================

interface DownloadSectionProps {
  transfers: FileTransfer[];
  onDownload: (id: string) => Promise<void>;
}

function DownloadSection({ transfers, onDownload }: DownloadSectionProps) {
  const downloadTransfers = transfers.filter(
    (t) => t.direction === 'download' && t.status !== 'pending'
  );

  if (downloadTransfers.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Download className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No files available for download</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {downloadTransfers.map((transfer) => (
        <div key={transfer.id} className="flex items-center gap-3 rounded-lg border p-3">
          <File className="text-muted-foreground h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{transfer.name}</p>
            <p className="text-muted-foreground text-xs">{formatFileSize(transfer.size)}</p>
          </div>
          {getStatusBadge(transfer.status)}
          {transfer.status === 'approved' && (
            <Button size="sm" onClick={() => onDownload(transfer.id)}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PENDING SECTION
// ============================================================================

interface PendingSectionProps {
  transfers: FileTransfer[];
  onRequestApproval: (id: string) => Promise<void>;
  onCancel: (id: string) => void;
}

function PendingSection({ transfers, onRequestApproval, onCancel }: PendingSectionProps) {
  const pendingTransfers = transfers.filter(
    (t) => t.status === 'pending' || t.status === 'scanning'
  );

  if (pendingTransfers.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No pending transfers</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pendingTransfers.map((transfer) => (
        <div key={transfer.id} className="rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <File className="text-muted-foreground h-5 w-5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{transfer.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatFileSize(transfer.size)} • {transfer.direction}
              </p>
            </div>
            {getStatusBadge(transfer.status)}
          </div>

          {transfer.status === 'scanning' && (
            <div className="mt-2">
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>DLP scan in progress...</span>
              </div>
              <Progress className="h-1" value={transfer.progress} />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onCancel(transfer.id)}>
              Cancel
            </Button>
            {transfer.status === 'pending' && (
              <Button size="sm" onClick={() => onRequestApproval(transfer.id)}>
                Request Approval
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TRANSFER ITEM
// ============================================================================

interface TransferItemProps {
  transfer: FileTransfer;
  onCancel: () => void;
}

function TransferItem({ transfer, onCancel }: TransferItemProps) {
  const FileIcon = getFileIcon(transfer.type);

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <FileIcon className="text-muted-foreground h-5 w-5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{transfer.name}</p>
          {getStatusBadge(transfer.status)}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">{formatFileSize(transfer.size)}</p>
        {transfer.status === 'transferring' && (
          <Progress className="mt-2 h-1" value={transfer.progress} />
        )}
        {transfer.error && <p className="text-destructive mt-1 text-xs">{transfer.error}</p>}
      </div>
      {(transfer.status === 'pending' || transfer.status === 'transferring') && (
        <button className="text-muted-foreground hover:text-foreground p-1" onClick={onCancel}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FileTransferPanel({
  isOpen,
  onClose,
  transfers,
  restrictions,
  onUpload,
  onDownload,
  onCancelTransfer,
  onRequestApproval,
  className,
}: FileTransferPanelProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-96',
          'bg-background border-l shadow-xl',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">File Transfer</h3>
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs className="h-[calc(100%-57px)]" defaultValue="upload">
          <TabsList className="w-full justify-start px-4 pt-2">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="download">Download</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {transfers.filter((t) => t.status === 'pending').length > 0 && (
                <Badge className="ml-1 h-5 px-1.5" variant="secondary">
                  {transfers.filter((t) => t.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="h-[calc(100%-44px)] overflow-y-auto p-4">
            <TabsContent className="mt-0" value="upload">
              <UploadSection
                restrictions={restrictions}
                transfers={transfers}
                onCancel={onCancelTransfer}
                onUpload={onUpload}
              />
            </TabsContent>

            <TabsContent className="mt-0" value="download">
              <DownloadSection transfers={transfers} onDownload={onDownload} />
            </TabsContent>

            <TabsContent className="mt-0" value="pending">
              <PendingSection
                transfers={transfers}
                onCancel={onCancelTransfer}
                onRequestApproval={onRequestApproval}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
}

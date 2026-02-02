'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@skillancer/ui';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { useBusinessVerification } from '@/hooks/use-business-verification';

import type { BusinessType, BusinessDocumentType } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface BusinessVerificationPanelProps {
  readonly className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BusinessVerificationPanel({ className }: BusinessVerificationPanelProps) {
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<BusinessDocumentType | null>(null);

  const {
    status,
    requirements,
    isLoading,
    isLoadingRequirements,
    error,
    startVerification,
    isStarting,
    uploadDocument,
    isUploading,
    refetch,
  } = useBusinessVerification();

  const handleStartVerification = async (data: {
    businessType: BusinessType;
    businessName: string;
    businessAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    taxIdType: 'EIN' | 'SSN' | 'VAT' | 'OTHER';
    taxIdNumber: string;
    website?: string;
  }) => {
    await startVerification(data);
    setShowStartDialog(false);
  };

  const handleUploadDocument = (docType: BusinessDocumentType) => {
    setSelectedDocType(docType);
    setShowUploadDialog(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedDocType) return;

    await uploadDocument({
      documentType: selectedDocType,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      file,
    });

    setShowUploadDialog(false);
    setSelectedDocType(null);
  };

  if (isLoading) {
    return <BusinessVerificationSkeleton />;
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="text-destructive h-12 w-12" />
          <div className="text-center">
            <p className="font-medium">Failed to load business verification</p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not started state
  if (!status?.hasBusinessProfile) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="text-primary h-5 w-5" />
              Business Verification
            </CardTitle>
            <CardDescription>
              Verify your business to access enterprise features and higher limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="bg-muted rounded-full p-6">
                <Building2 className="text-muted-foreground h-12 w-12" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Operate as a Business or Agency?</p>
                <p className="text-muted-foreground mt-1">
                  Verify your business to unlock team features, higher project limits, and
                  enterprise client access
                </p>
              </div>
              <Button size="lg" onClick={() => setShowStartDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Start Business Verification
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Business Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {status?.benefits.map((benefit) => (
                <div
                  key={benefit.label}
                  className="flex items-center gap-2 rounded-lg border border-dashed p-3"
                >
                  <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-sm">{benefit.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Start Verification Dialog */}
        <BusinessStartDialog
          isSubmitting={isStarting}
          open={showStartDialog}
          requirements={requirements}
          onOpenChange={setShowStartDialog}
          onSubmit={handleStartVerification}
        />
      </div>
    );
  }

  // In progress or verified state
  const progressPercent = status.documentsProgress
    ? Math.round((status.documentsProgress.uploaded / status.documentsProgress.required) * 100)
    : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="text-primary h-5 w-5" />
            Business Verification
          </CardTitle>
          <CardDescription>
            {status.status === 'VERIFIED'
              ? 'Your business is verified'
              : 'Complete document upload to verify your business'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'rounded-full p-3',
                status.status === 'VERIFIED'
                  ? 'bg-emerald-100'
                  : status.status === 'IN_REVIEW'
                    ? 'bg-amber-100'
                    : 'bg-muted'
              )}
            >
              {status.status === 'VERIFIED' ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              ) : status.status === 'IN_REVIEW' ? (
                <Clock className="h-8 w-8 text-amber-600" />
              ) : (
                <Building2 className="text-muted-foreground h-8 w-8" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{status.business?.name}</p>
                <Badge
                  variant={
                    status.status === 'VERIFIED'
                      ? 'default'
                      : status.status === 'IN_REVIEW'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {status.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {status.business?.type?.replace('_', ' ')} • {status.business?.address?.city},{' '}
                {status.business?.address?.state}
              </p>
            </div>
          </div>

          {/* Progress */}
          {status.status !== 'VERIFIED' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Document Progress</span>
                <span className="text-muted-foreground">
                  {status.documentsProgress?.uploaded} / {status.documentsProgress?.required}
                </span>
              </div>
              <Progress className="h-2" value={progressPercent} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Required Documents</CardTitle>
          <CardDescription>Upload the following documents to complete verification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.requiredDocuments.map((docType) => {
              const uploadedDoc = status.documents.find((d) => d.type === docType);
              return (
                <DocumentRow
                  key={docType}
                  isUploading={isUploading}
                  type={docType as BusinessDocumentType}
                  uploadedDoc={uploadedDoc}
                  onUpload={() => handleUploadDocument(docType as BusinessDocumentType)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {status.benefits.map((benefit) => (
              <div
                key={benefit.label}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3',
                  benefit.available ? 'border-emerald-200 bg-emerald-50' : 'border-dashed'
                )}
              >
                <CheckCircle2
                  className={cn(
                    'h-4 w-4',
                    benefit.available ? 'text-emerald-600' : 'text-muted-foreground'
                  )}
                />
                <span className={cn('text-sm', !benefit.available && 'text-muted-foreground')}>
                  {benefit.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        documentType={selectedDocType}
        isUploading={isUploading}
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={handleFileUpload}
      />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface DocumentRowProps {
  readonly type: BusinessDocumentType;
  readonly uploadedDoc?: {
    id: string;
    type: string;
    fileName: string;
    status: string;
    uploadedAt: string;
    verifiedAt: string | null;
    rejectionReason: string | null;
  };
  readonly onUpload: () => void;
  readonly isUploading: boolean;
}

function DocumentRow({ type, uploadedDoc, onUpload, isUploading }: DocumentRowProps) {
  const documentNames: Record<BusinessDocumentType, string> = {
    BUSINESS_LICENSE: 'Business License',
    CERTIFICATE_OF_INCORPORATION: 'Certificate of Incorporation',
    TAX_REGISTRATION: 'Tax Registration Certificate',
    PROOF_OF_ADDRESS: 'Proof of Business Address',
    ARTICLES_OF_ORGANIZATION: 'Articles of Organization',
    OPERATING_AGREEMENT: 'Operating Agreement',
    EIN_LETTER: 'EIN Confirmation Letter',
    OTHER: 'Other Document',
  };

  const statusBadge = {
    PENDING_UPLOAD: { variant: 'outline' as const, label: 'Pending' },
    PENDING_REVIEW: { variant: 'secondary' as const, label: 'In Review' },
    VERIFIED: { variant: 'default' as const, label: 'Verified' },
    REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div
        className={cn(
          'rounded-lg p-2',
          uploadedDoc?.status === 'VERIFIED'
            ? 'bg-emerald-100'
            : uploadedDoc
              ? 'bg-blue-100'
              : 'bg-muted'
        )}
      >
        {uploadedDoc?.status === 'VERIFIED' ? (
          <FileCheck className="h-5 w-5 text-emerald-600" />
        ) : (
          <FileText
            className={cn('h-5 w-5', uploadedDoc ? 'text-blue-600' : 'text-muted-foreground')}
          />
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium">{documentNames[type]}</p>
        {uploadedDoc ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span>{uploadedDoc.fileName}</span>
            <Badge variant={statusBadge[uploadedDoc.status as keyof typeof statusBadge]?.variant}>
              {statusBadge[uploadedDoc.status as keyof typeof statusBadge]?.label}
            </Badge>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Not uploaded</p>
        )}
        {uploadedDoc?.rejectionReason && (
          <p className="text-destructive mt-1 text-xs">{uploadedDoc.rejectionReason}</p>
        )}
      </div>
      {!uploadedDoc || uploadedDoc.status === 'REJECTED' ? (
        <Button disabled={isUploading} variant="outline" onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      ) : uploadedDoc.status === 'VERIFIED' ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : (
        <Clock className="h-5 w-5 text-amber-500" />
      )}
    </div>
  );
}

interface BusinessStartDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (data: {
    businessType: BusinessType;
    businessName: string;
    businessAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    taxIdType: 'EIN' | 'SSN' | 'VAT' | 'OTHER';
    taxIdNumber: string;
    website?: string;
  }) => void;
  readonly isSubmitting: boolean;
  readonly requirements: unknown;
}

function BusinessStartDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: BusinessStartDialogProps) {
  const [formData, setFormData] = useState({
    businessType: 'LLC' as BusinessType,
    businessName: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    taxIdType: 'EIN' as const,
    taxIdNumber: '',
    website: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      businessType: formData.businessType,
      businessName: formData.businessName,
      businessAddress: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
      },
      taxIdType: formData.taxIdType,
      taxIdNumber: formData.taxIdNumber,
      website: formData.website || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Start Business Verification</DialogTitle>
          <DialogDescription>
            Enter your business details to begin the verification process
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, businessType: v as BusinessType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOLE_PROPRIETOR">Sole Proprietor</SelectItem>
                  <SelectItem value="LLC">LLC</SelectItem>
                  <SelectItem value="CORPORATION">Corporation</SelectItem>
                  <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                  <SelectItem value="NON_PROFIT">Non-Profit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                required
                id="businessName"
                placeholder="Acme Inc."
                value={formData.businessName}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              required
              id="street"
              placeholder="123 Business Ave"
              value={formData.street}
              onChange={(e) => setFormData((prev) => ({ ...prev, street: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                required
                id="city"
                placeholder="New York"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                required
                id="state"
                placeholder="NY"
                value={formData.state}
                onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                required
                id="postalCode"
                placeholder="10001"
                value={formData.postalCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taxIdType">Tax ID Type</Label>
              <Select
                value={formData.taxIdType}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    taxIdType: v as 'EIN' | 'SSN' | 'VAT' | 'OTHER',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EIN">EIN</SelectItem>
                  <SelectItem value="SSN">SSN</SelectItem>
                  <SelectItem value="VAT">VAT</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxIdNumber">Tax ID Number</Label>
              <Input
                required
                id="taxIdNumber"
                placeholder="XX-XXXXXXX"
                value={formData.taxIdNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxIdNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (Optional)</Label>
            <Input
              id="website"
              placeholder="https://acme.com"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Start Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DocumentUploadDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly documentType: BusinessDocumentType | null;
  readonly onUpload: (file: File) => void;
  readonly isUploading: boolean;
}

function DocumentUploadDialog({
  open,
  onOpenChange,
  documentType,
  onUpload,
  isUploading,
}: DocumentUploadDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload your {documentType?.replace(/_/g, ' ').toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            dragActive && 'border-primary bg-primary/5',
            selectedFile && 'border-emerald-500 bg-emerald-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <>
              <FileCheck className="h-12 w-12 text-emerald-600" />
              <p className="mt-2 font-medium">{selectedFile.name}</p>
              <p className="text-muted-foreground text-sm">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedFile(null)}
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </>
          ) : (
            <>
              <Upload className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground mt-2">Drag and drop your file here, or</p>
              <label className="mt-2">
                <span className="text-primary cursor-pointer hover:underline">browse files</span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  type="file"
                  onChange={handleFileChange}
                />
              </label>
              <p className="text-muted-foreground mt-2 text-xs">
                Supported: PDF, JPEG, PNG, WebP (max 10MB)
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selectedFile || isUploading} onClick={handleUpload}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function BusinessVerificationSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-1 h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

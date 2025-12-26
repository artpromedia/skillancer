/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Edit3,
  FileText,
  Keyboard,
  Lock,
  PenTool,
  Shield,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Contract } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface ContractSignatureProps {
  contract: Contract;
  userRole: 'client' | 'freelancer';
  onSign: (signature: SignatureData) => Promise<void>;
  onCancel: () => void;
}

interface SignatureData {
  type: 'typed' | 'drawn';
  value: string; // Full name or base64 image
  agreedToTerms: boolean;
  timestamp: Date;
  ipAddress?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContractSignature({
  contract,
  userRole,
  onSign,
  onCancel,
}: ContractSignatureProps) {
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [typedName, setTypedName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasReadContract, setHasReadContract] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const contractScrollRef = useRef<HTMLDivElement>(null);

  // Track scroll progress
  useEffect(() => {
    const container = contractScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const progress = Math.min((scrollTop / (scrollHeight - clientHeight)) * 100, 100);
      setScrollProgress(progress);

      // Mark as read when scrolled to 90%
      if (progress >= 90) {
        setHasReadContract(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Canvas drawing handlers
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasSignature(true);
    },
    [isDrawing]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // Handle sign
  const handleSign = async () => {
    setIsSubmitting(true);
    try {
      let signatureValue = '';

      if (signatureType === 'typed') {
        signatureValue = typedName;
      } else {
        const canvas = canvasRef.current;
        if (canvas) {
          signatureValue = canvas.toDataURL('image/png');
        }
      }

      await onSign({
        type: signatureType,
        value: signatureValue,
        agreedToTerms,
        timestamp: new Date(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSign =
    hasReadContract &&
    agreedToTerms &&
    (signatureType === 'typed' ? typedName.trim().length > 0 : hasSignature);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Sign Contract</h2>
        <p className="text-muted-foreground">
          Please review the contract terms carefully before signing
        </p>
      </div>

      {/* Contract Details Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{contract.title}</CardTitle>
              <CardDescription>Contract ID: {contract.id}</CardDescription>
            </div>
            <Badge variant={contract.type === 'FIXED' ? 'default' : 'secondary'}>
              {contract.type === 'FIXED' ? 'Fixed Price' : 'Hourly'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Budget</p>
              <p className="text-lg font-semibold">
                ${contract.budget.toLocaleString()}
                {contract.type === 'HOURLY' && '/hr'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-medium">{new Date(contract.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">End Date</p>
              <p className="font-medium">
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Ongoing'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Terms - Scrollable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Terms
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasReadContract ? (
                <Badge className="bg-green-100 text-green-800">
                  <Check className="mr-1 h-3 w-3" />
                  Read
                </Badge>
              ) : (
                <Badge variant="outline">
                  <ChevronDown className="mr-1 h-3 w-3 animate-bounce" />
                  Scroll to read
                </Badge>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div ref={contractScrollRef} className="h-64 overflow-y-auto rounded-lg border p-4">
            {/* Contract terms content */}
            <div className="prose prose-sm max-w-none space-y-4">
              <h4>1. Scope of Work</h4>
              <p>{contract.description}</p>

              <h4>2. Payment Terms</h4>
              <p>
                {contract.type === 'FIXED' ? (
                  <>
                    This is a fixed-price contract with a total value of $
                    {contract.budget.toLocaleString()}. Payment will be released upon successful
                    completion and approval of each milestone.
                  </>
                ) : (
                  <>
                    This is an hourly contract at a rate of ${contract.budget}/hour. The
                    {userRole === 'freelancer' ? ' Client' : ' Freelancer'} will track time using
                    Skillancer&apos;s time tracker. Payments are processed weekly.
                  </>
                )}
              </p>

              <h4>3. Escrow Protection</h4>
              <p>
                All funds are held in escrow by Skillancer until work is completed and approved.
                This protects both parties in the transaction.
              </p>

              <h4>4. Intellectual Property</h4>
              <p>
                Upon full payment, all intellectual property rights for work created under this
                contract transfer to the Client, unless otherwise specified.
              </p>

              <h4>5. Confidentiality</h4>
              <p>
                Both parties agree to keep all project information confidential and not disclose it
                to third parties without written consent.
              </p>

              <h4>6. Dispute Resolution</h4>
              <p>
                In case of disputes, parties agree to first attempt resolution through
                Skillancer&apos;s mediation service. Unresolved disputes may be escalated to binding
                arbitration.
              </p>

              <h4>7. Termination</h4>
              <p>
                Either party may terminate this contract with written notice. In case of
                termination, the Client pays for all approved work completed to date.
              </p>

              <h4>8. Warranties</h4>
              <p>
                The Freelancer warrants that all work will be original and does not infringe on any
                third-party rights. Work will be performed in a professional and workmanlike manner.
              </p>

              <h4>9. Limitation of Liability</h4>
              <p>
                Neither party shall be liable for indirect, incidental, or consequential damages.
                Total liability shall not exceed the contract value.
              </p>

              <h4>10. Governing Law</h4>
              <p>
                This contract shall be governed by the laws of the jurisdiction where Skillancer
                Inc. is incorporated.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Your Signature
          </CardTitle>
          <CardDescription>Choose how you&apos;d like to sign this contract</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={signatureType} onValueChange={(v: 'typed' | 'drawn') => setSignatureType(v)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger className="gap-2" value="typed">
                <Keyboard className="h-4 w-4" />
                Type Signature
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="drawn">
                <Edit3 className="h-4 w-4" />
                Draw Signature
              </TabsTrigger>
            </TabsList>

            <TabsContent className="mt-4" value="typed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Legal Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                </div>
                {typedName && (
                  <div className="rounded-lg border bg-white p-6 text-center">
                    <p className="text-3xl" style={{ fontFamily: 'cursive' }}>
                      {typedName}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent className="mt-4" value="drawn">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Draw your signature below</Label>
                  <Button size="sm" variant="ghost" onClick={clearCanvas}>
                    Clear
                  </Button>
                </div>
                <div className="rounded-lg border bg-white p-2">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    height={150}
                    width={600}
                    onMouseDown={startDrawing}
                    onMouseLeave={stopDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                  />
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  Use your mouse or touchpad to draw your signature
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Terms Agreement */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={agreedToTerms}
                disabled={!hasReadContract}
                id="terms"
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <div className="space-y-1">
                <Label
                  className={cn('leading-normal', !hasReadContract && 'text-muted-foreground')}
                  htmlFor="terms"
                >
                  I have read and agree to all contract terms
                </Label>
                {!hasReadContract && (
                  <p className="text-muted-foreground text-xs">
                    Please scroll through the contract terms above to enable this checkbox
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Legal Notice */}
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Legally Binding Signature</p>
                  <p className="text-muted-foreground text-sm">
                    By signing, you agree this is a legally binding electronic signature equivalent
                    to a handwritten signature.
                  </p>
                </div>
                <div className="text-muted-foreground text-right text-xs">
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date().toLocaleString()}
                  </p>
                  <p className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Signing as {userRole}
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Escrow Notice */}
          <Alert className="border-green-200 bg-green-50">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <p className="font-medium">Escrow Protection Active</p>
              <p className="text-sm">
                Funds will be held securely in escrow until work is approved. Both parties are
                protected by Skillancer&apos;s payment guarantee.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-4">
          {!canSign && (
            <p className="text-muted-foreground text-sm">
              {!hasReadContract && 'Please read the full contract • '}
              {!agreedToTerms && 'Accept terms • '}
              {signatureType === 'typed' && !typedName && 'Enter your name'}
              {signatureType === 'drawn' && !hasSignature && 'Draw your signature'}
            </p>
          )}
          <Button disabled={!canSign || isSubmitting} onClick={handleSign}>
            {isSubmitting ? (
              'Signing...'
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Sign Contract
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

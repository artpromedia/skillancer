/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, jsx-a11y/label-has-associated-control */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from '@skillancer/ui';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Shield,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { Contract, Proposal } from '@/lib/api/bids';

import { hireFreelancer } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface HireModalProps {
  proposal: Proposal | null;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHireSuccess?: (contract: Contract) => void;
}

type PaymentMethod = 'ESCROW' | 'MILESTONE';
type Step = 'review' | 'payment' | 'message' | 'confirm';

// ============================================================================
// Step Components
// ============================================================================

function ReviewStep({ proposal }: { proposal: Proposal }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const freelancer = proposal.freelancer;

  return (
    <div className="space-y-6">
      {/* Freelancer summary */}
      <div className="flex items-center gap-4 rounded-lg border p-4">
        <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold">
          {freelancer?.name?.charAt(0) ?? 'F'}
        </div>
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {freelancer?.name}
            {freelancer?.verificationLevel !== 'BASIC' && (
              <Shield className="h-4 w-4 text-blue-500" />
            )}
          </h3>
          <p className="text-muted-foreground">{freelancer?.title}</p>
        </div>
      </div>

      {/* Bid details */}
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
        <div>
          <p className="text-muted-foreground text-xs">Agreed Amount</p>
          <p className="text-xl font-bold">
            {formatCurrency(proposal.bidAmount)}
            {proposal.contractType === 'HOURLY' && (
              <span className="text-muted-foreground text-sm font-normal">/hr</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Delivery Time</p>
          <p className="text-xl font-bold">{proposal.deliveryDays} days</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Contract Type</p>
          <p className="text-xl font-bold">{proposal.contractType}</p>
        </div>
      </div>

      {/* Milestones summary */}
      {proposal.milestones && proposal.milestones.length > 0 && (
        <div>
          <h4 className="mb-3 font-medium">Agreed Milestones</h4>
          <div className="space-y-2">
            {proposal.milestones.map((milestone, index) => (
              <div key={milestone.id} className="flex items-center gap-3 rounded border p-3">
                <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {index + 1}
                </div>
                <span className="flex-1">{milestone.title}</span>
                <span className="font-medium">{formatCurrency(milestone.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="mb-1 font-medium">Before you proceed:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Review the freelancer&apos;s proposal and terms carefully</li>
            <li>Funds will be held in escrow until milestones are approved</li>
            <li>You can request modifications before approving deliverables</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PaymentStep({
  proposal,
  paymentMethod,
  setPaymentMethod,
}: {
  proposal: Proposal;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
}) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  // Calculate fees (platform takes from freelancer, but client pays processing)
  const processingFee = proposal.bidAmount * 0.029 + 0.3; // 2.9% + $0.30
  const totalAmount = proposal.bidAmount + processingFee;

  const hasMilestones = proposal.milestones && proposal.milestones.length > 0;
  const firstMilestone = proposal.milestones?.[0];
  const firstPayment = hasMilestones ? (firstMilestone?.amount ?? 0) : proposal.bidAmount;
  const firstProcessingFee = firstPayment * 0.029 + 0.3;

  return (
    <div className="space-y-6">
      {/* Payment method selection */}
      <div>
        <h4 className="mb-3 font-medium">Payment Method</h4>
        <RadioGroup
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
              paymentMethod === 'ESCROW' ? 'border-primary bg-primary/5' : 'hover:border-slate-300'
            )}
          >
            <RadioGroupItem className="mt-0.5" id="escrow" value="ESCROW" />
            <div>
              <p className="font-medium">Full Escrow Payment</p>
              <p className="text-muted-foreground text-sm">
                Fund the entire project upfront. Amount is held securely until work is approved.
              </p>
            </div>
          </label>

          {hasMilestones && (
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                paymentMethod === 'MILESTONE'
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-slate-300'
              )}
            >
              <RadioGroupItem className="mt-0.5" id="milestone" value="MILESTONE" />
              <div>
                <p className="font-medium">Pay Per Milestone</p>
                <p className="text-muted-foreground text-sm">
                  Fund each milestone as it becomes due. Start with the first milestone.
                </p>
              </div>
            </label>
          )}
        </RadioGroup>
      </div>

      {/* Payment summary */}
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h4 className="font-medium">Payment Summary</h4>
        </div>
        <div className="p-4">
          {paymentMethod === 'ESCROW' ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Project Amount</span>
                <span>{formatCurrency(proposal.bidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee (2.9% + $0.30)</span>
                <span className="text-muted-foreground">{formatCurrency(processingFee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Due Now</span>
                <span className="text-lg">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>First Milestone: {firstMilestone?.title}</span>
                <span>{formatCurrency(firstPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="text-muted-foreground">{formatCurrency(firstProcessingFee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Due Now</span>
                <span className="text-lg">{formatCurrency(firstPayment + firstProcessingFee)}</span>
              </div>
              <div className="text-muted-foreground flex justify-between text-sm">
                <span>Remaining milestones</span>
                <span>{formatCurrency(proposal.bidAmount - firstPayment)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Escrow protection notice */}
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
        <div className="text-sm text-green-800">
          <p className="mb-1 font-medium">Protected by Skillancer Escrow</p>
          <p>
            Your payment is securely held until you approve the delivered work. If there&apos;s a
            dispute, our support team will help resolve it.
          </p>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <Label className="mb-2 block">Payment Card</Label>
        <Select defaultValue="card-1">
          <SelectTrigger>
            <SelectValue placeholder="Select a payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                •••• 4242
              </div>
            </SelectItem>
            <SelectItem value="add-new">+ Add new card</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MessageStep({
  message,
  setMessage,
  startDate,
  setStartDate,
}: {
  message: string;
  setMessage: (msg: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Start date */}
      <div>
        <Label htmlFor="start-date">Preferred Start Date</Label>
        <div className="relative mt-1">
          <Calendar className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-10"
            id="start-date"
            min={new Date().toISOString().split('T')[0]}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          When would you like the freelancer to start?
        </p>
      </div>

      {/* Welcome message */}
      <div>
        <Label htmlFor="welcome-message">Welcome Message (Optional)</Label>
        <Textarea
          className="mt-1"
          id="welcome-message"
          placeholder="Share any additional details, requirements, or a warm welcome message..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-muted-foreground mt-1 text-sm">
          This message will be sent to the freelancer when the contract starts
        </p>
      </div>

      {/* Tips */}
      <Card className="bg-blue-50">
        <CardContent className="p-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium">
            <MessageSquare className="h-4 w-4" />
            Tips for a Great Start
          </h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>• Share any project files or documentation</li>
            <li>• Clarify your preferred communication schedule</li>
            <li>• Mention any tools or platforms you use</li>
            <li>• Set clear expectations for updates and check-ins</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmStep({
  proposal,
  paymentMethod,
  message,
  startDate,
}: {
  proposal: Proposal;
  paymentMethod: PaymentMethod;
  message: string;
  startDate: string;
}) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  const processingFee = proposal.bidAmount * 0.029 + 0.3;
  const totalAmount = proposal.bidAmount + processingFee;

  const firstMilestone = proposal.milestones?.[0];
  const firstPayment =
    paymentMethod === 'MILESTONE'
      ? (firstMilestone?.amount ?? proposal.bidAmount)
      : proposal.bidAmount;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <FileText className="text-primary h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Ready to Start Your Project</h3>
        <p className="text-muted-foreground">Review the details below before confirming</p>
      </div>

      {/* Summary */}
      <div className="divide-y rounded-lg border">
        <div className="flex items-center justify-between p-3">
          <span className="text-muted-foreground">Freelancer</span>
          <span className="flex items-center gap-2 font-medium">
            <User className="h-4 w-4" />
            {proposal.freelancer?.name}
          </span>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-muted-foreground">Contract Type</span>
          <Badge variant="outline">{proposal.contractType}</Badge>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-muted-foreground">Payment Method</span>
          <span className="font-medium">
            {paymentMethod === 'ESCROW' ? 'Full Escrow' : 'Per Milestone'}
          </span>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-muted-foreground">Start Date</span>
          <span className="flex items-center gap-2 font-medium">
            <Calendar className="h-4 w-4" />
            {startDate ? new Date(startDate).toLocaleDateString() : 'Immediately'}
          </span>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-muted-foreground">Delivery Time</span>
          <span className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4" />
            {proposal.deliveryDays} days
          </span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 p-3">
          <span className="font-medium">Amount Due Now</span>
          <span className="flex items-center gap-2 text-lg font-bold">
            <DollarSign className="h-4 w-4" />
            {formatCurrency(
              paymentMethod === 'ESCROW' ? totalAmount : firstPayment + firstPayment * 0.029 + 0.3
            )}
          </span>
        </div>
      </div>

      {/* Welcome message preview */}
      {message && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">Your welcome message:</p>
          <div className="rounded-lg bg-slate-50 p-3 text-sm italic">&ldquo;{message}&rdquo;</div>
        </div>
      )}

      {/* Terms */}
      <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <p className="text-muted-foreground">
          By clicking &ldquo;Confirm &amp; Pay&rdquo;, you agree to the{' '}
          <a className="text-primary underline" href="/terms">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="text-primary underline" href="/escrow-policy">
            Escrow Payment Policy
          </a>
          . Your payment will be held securely until you approve the delivered work.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HireModal({
  proposal,
  jobId: _jobId,
  open,
  onOpenChange,
  onHireSuccess,
}: HireModalProps) {
  const [step, setStep] = useState<Step>('review');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ESCROW');
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('review');
        setPaymentMethod('ESCROW');
        setMessage('');
        setStartDate('');
        setSuccess(false);
        setError(null);
      }, 300);
    }
  }, [open]);

  // Step config
  const steps: { id: Step; title: string }[] = [
    { id: 'review', title: 'Review' },
    { id: 'payment', title: 'Payment' },
    { id: 'message', title: 'Message' },
    { id: 'confirm', title: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!proposal) return;

    setIsProcessing(true);
    setError(null);

    try {
      const contract = await hireFreelancer(proposal.id, {
        agreedAmount: proposal.bidAmount,
        agreedDeliveryDays: proposal.deliveryDays,
        milestones: proposal.milestones?.map((m) => ({
          title: m.title,
          description: m.description,
          amount: m.amount,
          durationDays: m.durationDays,
        })),
        welcomeMessage: message || undefined,
        startDate: startDate || undefined,
      });

      setSuccess(true);
      onHireSuccess?.(contract);

      // Close after animation
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch {
      setError('Failed to create contract. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [proposal, message, startDate, onHireSuccess, onOpenChange]);

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {success ? 'Contract Created!' : `Hire ${proposal.freelancer?.name}`}
          </DialogTitle>
          {!success && (
            <DialogDescription>
              Create a contract and start working with this freelancer
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Success state */}
        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">You&apos;re All Set!</h3>
            <p className="text-muted-foreground mb-4">
              The contract has been created and {proposal.freelancer?.name} has been notified.
            </p>
            <p className="text-muted-foreground text-sm">Redirecting to your contract...</p>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="mb-6 flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      index < currentStepIndex && 'bg-green-500 text-white',
                      index === currentStepIndex && 'bg-primary text-primary-foreground',
                      index > currentStepIndex && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'mx-2 h-px w-12',
                        index < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="min-h-[300px]">
              {step === 'review' && <ReviewStep proposal={proposal} />}
              {step === 'payment' && (
                <PaymentStep
                  paymentMethod={paymentMethod}
                  proposal={proposal}
                  setPaymentMethod={setPaymentMethod}
                />
              )}
              {step === 'message' && (
                <MessageStep
                  message={message}
                  setMessage={setMessage}
                  setStartDate={setStartDate}
                  startDate={startDate}
                />
              )}
              {step === 'confirm' && (
                <ConfirmStep
                  message={message}
                  paymentMethod={paymentMethod}
                  proposal={proposal}
                  startDate={startDate}
                />
              )}
            </div>

            {/* Error */}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {/* Navigation */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                disabled={currentStepIndex === 0 || isProcessing}
                variant="ghost"
                onClick={() => setStep(steps[currentStepIndex - 1]?.id ?? 'review')}
              >
                Back
              </Button>

              {step !== 'confirm' ? (
                <Button onClick={() => setStep(steps[currentStepIndex + 1]?.id ?? 'confirm')}>
                  Continue
                </Button>
              ) : (
                <Button disabled={isProcessing} onClick={() => void handleConfirm()}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Confirm &amp; Pay
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

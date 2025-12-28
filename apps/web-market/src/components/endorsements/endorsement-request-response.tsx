'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@skillancer/ui';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface EndorsementRequest {
  id: string;
  requester: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
    headline?: string;
  };
  skill: {
    id: string;
    name: string;
    category: string;
  };
  message?: string;
  projectContext?: {
    id: string;
    title: string;
    completedAt: string;
    description?: string;
  };
  createdAt: string;
  expiresAt?: string;
}

export type RelationshipType =
  | 'client'
  | 'colleague'
  | 'manager'
  | 'mentor'
  | 'collaborator'
  | 'other';

export interface EndorsementResponseData {
  requestId: string;
  accepted: boolean;
  relationship?: RelationshipType;
  testimonial?: string;
  declineReason?: string;
}

export interface EndorsementRequestResponseProps {
  request: EndorsementRequest;
  onSubmit: (data: EndorsementResponseData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export interface EndorsementRequestResponseModalProps extends Omit<
  EndorsementRequestResponseProps,
  'onCancel'
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const relationshipOptions: Array<{
  value: RelationshipType;
  label: string;
  description: string;
}> = [
  { value: 'client', label: 'As their client', description: 'They worked on a project for me' },
  { value: 'colleague', label: 'As their colleague', description: 'We worked on the same team' },
  { value: 'manager', label: 'As their manager', description: 'I supervised their work' },
  {
    value: 'collaborator',
    label: 'As a collaborator',
    description: 'We worked together on a project',
  },
  { value: 'mentor', label: 'As their mentor', description: 'I mentored or taught them' },
  { value: 'other', label: 'Other', description: 'Another professional relationship' },
];

const declineReasons = [
  { value: 'no-experience', label: "I haven't seen them use this skill" },
  { value: 'dont-remember', label: "I don't remember our collaboration clearly" },
  { value: 'not-comfortable', label: "I'm not comfortable providing an endorsement" },
  { value: 'wrong-skill', label: 'I would endorse a different skill instead' },
  { value: 'other', label: 'Other reason' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysRemaining(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Request Preview Card
// ============================================================================

function RequestPreviewCard({ request }: Readonly<{ request: EndorsementRequest }>) {
  const daysRemaining = request.expiresAt ? getDaysRemaining(request.expiresAt) : null;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage alt={request.requester.name} src={request.requester.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-700">
              {getInitials(request.requester.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  className="font-semibold hover:underline"
                  href={`/freelancers/${request.requester.id}`}
                >
                  {request.requester.name}
                </Link>
                {request.requester.title && (
                  <p className="text-muted-foreground text-sm">{request.requester.title}</p>
                )}
              </div>
              {daysRemaining !== null && daysRemaining <= 7 && (
                <Badge
                  className={cn(
                    daysRemaining <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  )}
                  variant="secondary"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  {daysRemaining} days left
                </Badge>
              )}
            </div>

            <div className="mt-2">
              <p className="text-sm">
                Wants your endorsement for:{' '}
                <Badge className="ml-1 font-medium" variant="outline">
                  {request.skill.name}
                </Badge>
              </p>
            </div>

            {request.message && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <div className="text-muted-foreground mb-1 flex items-center text-xs">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Personal message
                </div>
                <p className="text-sm">&quot;{request.message}&quot;</p>
              </div>
            )}

            {request.projectContext && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Briefcase className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">Related project:</span>
                <Link
                  className="font-medium hover:underline"
                  href={`/contracts/${request.projectContext.id}`}
                >
                  {request.projectContext.title}
                </Link>
                <span className="text-muted-foreground text-xs">
                  (completed {formatDate(request.projectContext.completedAt)})
                </span>
              </div>
            )}

            <p className="text-muted-foreground mt-2 text-xs">
              <Calendar className="mr-1 inline h-3 w-3" />
              Requested on {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Accept Form
// ============================================================================

function AcceptForm({
  request,
  onSubmit,
  onBack,
  isSubmitting,
}: Readonly<{
  request: EndorsementRequest;
  onSubmit: (relationship: RelationshipType, testimonial: string) => Promise<void> | void;
  onBack: () => void;
  isSubmitting: boolean;
}>) {
  const [relationship, setRelationship] = useState<RelationshipType>('client');
  const [testimonial, setTestimonial] = useState('');

  return (
    <div className="space-y-6">
      {/* Relationship Selection */}
      <div className="space-y-3">
        <span className="text-sm font-medium">
          How do you know {request.requester.name.split(' ')[0]}?
        </span>
        <RadioGroup
          className="space-y-2"
          value={relationship}
          onValueChange={(v) => setRelationship(v as RelationshipType)}
        >
          {relationshipOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <RadioGroupItem id={`rel-${option.value}`} value={option.value} />
              <Label
                className="flex cursor-pointer flex-col text-sm"
                htmlFor={`rel-${option.value}`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs">{option.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Testimonial */}
      <div className="space-y-2">
        <Label htmlFor="endorsement-testimonial">
          Add a testimonial{' '}
          <span className="text-muted-foreground font-normal">(optional but recommended)</span>
        </Label>
        <Textarea
          id="endorsement-testimonial"
          maxLength={500}
          placeholder={`Share your experience working with ${request.requester.name.split(' ')[0]} on ${request.skill.name}...`}
          rows={4}
          value={testimonial}
          onChange={(e) => setTestimonial(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Testimonials make endorsements more impactful
          </p>
          <span className="text-muted-foreground text-xs">{testimonial.length}/500</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <Button disabled={isSubmitting} variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button disabled={isSubmitting} onClick={() => void onSubmit(relationship, testimonial)}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <ThumbsUp className="mr-2 h-4 w-4" />
              Endorse {request.skill.name}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Decline Form
// ============================================================================

function DeclineForm({
  request,
  onSubmit,
  onBack,
  isSubmitting,
}: Readonly<{
  request: EndorsementRequest;
  onSubmit: (reason: string) => Promise<void> | void;
  onBack: () => void;
  isSubmitting: boolean;
}>) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          Declining won&apos;t notify {request.requester.name.split(' ')[0]} of the reason. The
          request will simply expire.
        </p>
      </div>

      {/* Reason Selection */}
      <div className="space-y-3">
        <span className="text-sm font-medium">
          Why can&apos;t you endorse this skill?{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </span>
        <RadioGroup className="space-y-2" value={reason} onValueChange={setReason}>
          {declineReasons.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <RadioGroupItem id={`decline-${option.value}`} value={option.value} />
              <Label className="cursor-pointer text-sm" htmlFor={`decline-${option.value}`}>
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Custom reason */}
      {reason === 'other' && (
        <div className="space-y-2">
          <Label htmlFor="decline-custom-reason">Please specify</Label>
          <Textarea
            id="decline-custom-reason"
            placeholder="Your reason (for your records only)..."
            rows={2}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        </div>
      )}

      {/* Alternative action suggestion */}
      {reason === 'wrong-skill' && (
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <p className="text-sm">
              <Sparkles className="mr-2 inline h-4 w-4 text-amber-500" />
              Would you like to endorse a different skill instead?
            </p>
            <Button className="mt-1 h-auto p-0 text-sm" variant="link">
              Browse {request.requester.name.split(' ')[0]}&apos;s other skills →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <Button disabled={isSubmitting} variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={isSubmitting}
          variant="outline"
          onClick={() => void onSubmit(reason === 'other' ? customReason : reason)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Decline Request
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EndorsementRequestResponse({
  request,
  onSubmit,
  onCancel,
  className,
}: Readonly<EndorsementRequestResponseProps>) {
  const [step, setStep] = useState<'initial' | 'accept' | 'decline'>('initial');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (relationship: RelationshipType, testimonial: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        requestId: request.id,
        accepted: true,
        relationship,
        testimonial: testimonial.trim() || undefined,
      });
    } catch (err) {
      console.error('Failed to submit endorsement:', err);
      setError('Failed to submit endorsement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (reason: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        requestId: request.id,
        accepted: false,
        declineReason: reason || undefined,
      });
    } catch (err) {
      console.error('Failed to decline request:', err);
      setError('Failed to decline request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Request Preview */}
      <RequestPreviewCard request={request} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Initial Choice */}
      {step === 'initial' && (
        <div className="space-y-4">
          <p className="text-center text-sm">
            Would you like to endorse {request.requester.name.split(' ')[0]}&apos;s{' '}
            <span className="font-medium">{request.skill.name}</span> skills?
          </p>

          <div className="flex justify-center gap-4">
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={() => setStep('accept')}
            >
              <ThumbsUp className="h-5 w-5" />
              Yes, Endorse
            </Button>
            <Button
              className="gap-2"
              size="lg"
              variant="outline"
              onClick={() => setStep('decline')}
            >
              <ThumbsDown className="h-5 w-5" />
              Decline
            </Button>
          </div>

          {onCancel && (
            <div className="text-center">
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Decide later
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Accept Flow */}
      {step === 'accept' && (
        <AcceptForm
          isSubmitting={isSubmitting}
          request={request}
          onBack={() => setStep('initial')}
          onSubmit={handleAccept}
        />
      )}

      {/* Decline Flow */}
      {step === 'decline' && (
        <DeclineForm
          isSubmitting={isSubmitting}
          request={request}
          onBack={() => setStep('initial')}
          onSubmit={handleDecline}
        />
      )}
    </div>
  );
}

// ============================================================================
// Modal Wrapper
// ============================================================================

export function EndorsementRequestResponseModal({
  open,
  onOpenChange,
  ...props
}: Readonly<EndorsementRequestResponseModalProps>) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasAccepted, setWasAccepted] = useState(false);

  const handleSubmit = async (data: EndorsementResponseData) => {
    await props.onSubmit(data);
    setWasAccepted(data.accepted);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onOpenChange(false);
    }, 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {showSuccess ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div
              className={cn('mb-4 rounded-full p-4', wasAccepted ? 'bg-green-100' : 'bg-slate-100')}
            >
              {wasAccepted ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-slate-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold">
              {wasAccepted ? 'Endorsement Sent!' : 'Request Declined'}
            </h3>
            <p className="text-muted-foreground mt-1">
              {wasAccepted
                ? `Thank you for endorsing ${props.request.requester.name.split(' ')[0]}'s skills.`
                : 'The request has been declined.'}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Endorsement Request</DialogTitle>
              <DialogDescription>
                {props.request.requester.name} would like your endorsement
              </DialogDescription>
            </DialogHeader>

            <EndorsementRequestResponse
              {...props}
              onCancel={() => onOpenChange(false)}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Compact Inline Response (for notifications/lists)
// ============================================================================

export interface InlineEndorsementRequestProps {
  request: EndorsementRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onViewDetails: (id: string) => void;
  className?: string;
}

export function InlineEndorsementRequest({
  request,
  onAccept,
  onDecline,
  onViewDetails,
  className,
}: Readonly<InlineEndorsementRequestProps>) {
  const daysRemaining = request.expiresAt ? getDaysRemaining(request.expiresAt) : null;

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors hover:bg-slate-50',
        className
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage alt={request.requester.name} src={request.requester.avatar} />
        <AvatarFallback>{getInitials(request.requester.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{request.requester.name}</span> wants your endorsement for{' '}
          <Badge className="ml-1" variant="outline">
            {request.skill.name}
          </Badge>
        </p>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3" />
          {daysRemaining === null ? (
            <span>Requested {formatDate(request.createdAt)}</span>
          ) : (
            <span className={cn(daysRemaining <= 3 && 'text-red-600')}>
              {daysRemaining} days remaining
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => onViewDetails(request.id)}>
          View
        </Button>
        <Button
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          size="sm"
          variant="outline"
          onClick={() => onDecline(request.id)}
        >
          Decline
        </Button>
        <Button
          className="bg-green-600 hover:bg-green-700"
          size="sm"
          onClick={() => onAccept(request.id)}
        >
          Endorse
        </Button>
      </div>
    </div>
  );
}

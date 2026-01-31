/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * ContractTermsReview Component
 *
 * Review and accept contract terms. Both client and freelancer
 * must accept before the contract becomes active.
 */

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Checkbox,
  Separator,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Shield,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import type { Contract } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

export interface ContractTermsReviewProps {
  contract: Contract;
  userRole: 'CLIENT' | 'FREELANCER';
  onAccept: () => Promise<void>;
  isAccepting?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContractTermsReview({
  contract,
  userRole,
  onAccept,
  isAccepting = false,
  className,
}: Readonly<ContractTermsReviewProps>) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  const canAccept = agreedToTerms && agreedToPolicy;

  const clientAccepted = !!contract.clientSignature?.signedAt;
  const freelancerAccepted = !!contract.freelancerSignature?.signedAt;
  const currentUserAccepted = userRole === 'CLIENT' ? clientAccepted : freelancerAccepted;
  const otherPartyAccepted = userRole === 'CLIENT' ? freelancerAccepted : clientAccepted;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const handleAccept = useCallback(async () => {
    if (!canAccept) return;
    await onAccept();
  }, [canAccept, onAccept]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Status Banner */}
      <Card
        className={cn(
          'border-2',
          currentUserAccepted
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
            : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          {currentUserAccepted ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  You have accepted the contract terms
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {otherPartyAccepted
                    ? 'Both parties have agreed. Contract is ready to start.'
                    : 'Waiting for the other party to accept.'}
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Review and accept contract terms
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Please review all terms carefully before accepting.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contract Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Summary
          </CardTitle>
          <CardDescription>{contract.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Parties */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Client</p>
                <p className="font-medium">{contract.client.name}</p>
                {clientAccepted && (
                  <Badge className="mt-1 bg-green-100 text-green-700" variant="secondary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Accepted
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-950">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Freelancer</p>
                <p className="font-medium">{contract.freelancer.name}</p>
                {freelancerAccepted && (
                  <Badge className="mt-1 bg-green-100 text-green-700" variant="secondary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Accepted
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Contract Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <DollarSign className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-sm">Contract Value</p>
                <p className="font-semibold">{formatCurrency(contract.amount)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-sm">Start Date</p>
                <p className="font-semibold">
                  {format(new Date(contract.startDate), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {contract.type === 'HOURLY' && contract.hourlyRate && (
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Hourly Rate</p>
                  <p className="font-semibold">{formatCurrency(contract.hourlyRate)}/hr</p>
                </div>
              </div>
            )}

            {contract.type === 'HOURLY' && contract.weeklyHoursLimit && (
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Weekly Limit</p>
                  <p className="font-semibold">{contract.weeklyHoursLimit} hours</p>
                </div>
              </div>
            )}
          </div>

          {/* Milestones Preview */}
          {contract.milestones.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-3 font-medium">Milestones ({contract.milestones.length})</p>
                <div className="space-y-2">
                  {contract.milestones.slice(0, 3).map((milestone, i) => (
                    <div
                      key={milestone.id}
                      className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                          {i + 1}
                        </span>
                        <span className="text-sm">{milestone.title}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(milestone.amount)}
                      </span>
                    </div>
                  ))}
                  {contract.milestones.length > 3 && (
                    <p className="text-muted-foreground text-sm">
                      + {contract.milestones.length - 3} more milestones
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 max-h-48 overflow-y-auto rounded-lg p-4 text-sm">
            {contract.terms || (
              <div className="space-y-3">
                <p>
                  <strong>1. Scope of Work:</strong> The freelancer agrees to complete all work as
                  described in the contract and milestone descriptions.
                </p>
                <p>
                  <strong>2. Payment Terms:</strong> Payments will be released upon milestone
                  approval. Funds are held securely in escrow until work is approved.
                </p>
                <p>
                  <strong>3. Intellectual Property:</strong> Upon full payment, all intellectual
                  property rights transfer to the client unless otherwise specified.
                </p>
                <p>
                  <strong>4. Confidentiality:</strong> Both parties agree to keep project details
                  confidential unless given written permission.
                </p>
                <p>
                  <strong>5. Dispute Resolution:</strong> Any disputes will be handled through
                  Skillancer&apos;s mediation process before external arbitration.
                </p>
                <p>
                  <strong>6. Cancellation:</strong> Either party may request cancellation. Refunds
                  will be processed based on work completed.
                </p>
              </div>
            )}
          </div>

          {contract.skillPodEnabled && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
              <p className="mb-1 font-medium text-blue-800 dark:text-blue-200">
                SkillPod Time Tracking Enabled
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This contract uses SkillPod for time tracking. Activity screenshots and work logs
                may be captured during work sessions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accept Terms */}
      {!currentUserAccepted && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={agreedToTerms}
                id="terms"
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label className="cursor-pointer text-sm" htmlFor="terms">
                I have read and agree to the contract terms and conditions outlined above.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={agreedToPolicy}
                id="policy"
                onCheckedChange={(checked) => setAgreedToPolicy(checked === true)}
              />
              <label className="cursor-pointer text-sm" htmlFor="policy">
                I agree to Skillancer&apos;s{' '}
                <a className="text-primary hover:underline" href="/terms">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a className="text-primary hover:underline" href="/privacy">
                  Privacy Policy
                </a>
                .
              </label>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={!canAccept || isAccepting}
              size="lg"
              onClick={() => void handleAccept()}
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept Contract Terms
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default ContractTermsReview;

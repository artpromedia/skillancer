'use client';

import { cn } from '@skillancer/ui';
import { AlertTriangle, X, CheckCircle2, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface MissingVerificationAlertProps {
  skill: string;
  impactPercent: number;
  onVerify?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function MissingVerificationAlert({
  skill,
  impactPercent,
  onVerify,
  onDismiss,
  className,
}: Readonly<MissingVerificationAlertProps>) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4',
        className
      )}
    >
      <div className="rounded-lg bg-amber-100 p-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="font-medium text-gray-900">Verify your {skill} skills</h4>
        <p className="mt-1 text-sm text-gray-600">Clients prefer verified skills when hiring</p>

        <div className="mt-2 flex items-center gap-2 rounded border border-amber-100 bg-white p-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-sm text-gray-700">
            <span className="font-semibold text-green-600">+{impactPercent}%</span> more likely to
            be hired with verification
          </span>
        </div>

        {onVerify && (
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            onClick={onVerify}
          >
            <CheckCircle2 className="h-4 w-4" />
            Verify {skill}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          aria-label="Dismiss"
          className="rounded p-1 text-gray-400 hover:text-gray-600"
          onClick={handleDismiss}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

// Batch alert for multiple unverified skills
export function MissingVerificationBanner({
  skills,
  onVerifyAll,
  onDismiss,
  className,
}: Readonly<{
  skills: string[];
  onVerifyAll?: () => void;
  onDismiss?: () => void;
  className?: string;
}>) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || skills.length === 0) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4',
        className
      )}
    >
      <div className="rounded-lg bg-white p-2">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
      </div>

      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">
          Verify {skills.length} key skill{skills.length > 1 ? 's' : ''}
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          Stand out to clients by verifying: <strong>{skills.slice(0, 3).join(', ')}</strong>
          {skills.length > 3 && ` and ${skills.length - 3} more`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {onVerifyAll && (
          <button
            className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            onClick={onVerifyAll}
          >
            Verify Skills
          </button>
        )}
        {onDismiss && (
          <button
            aria-label="Dismiss"
            className="rounded p-2 text-gray-400 hover:text-gray-600"
            onClick={handleDismiss}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default MissingVerificationAlert;

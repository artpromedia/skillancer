'use client';

import { cn } from '@skillancer/ui';
import { ThumbsUp, Users, X } from 'lucide-react';

interface EndorsementNotificationProps {
  readonly type: 'received' | 'request' | 'given';
  readonly data: {
    readonly endorser?: {
      readonly name: string;
      readonly avatar?: string;
    };
    readonly requester?: {
      readonly name: string;
      readonly avatar?: string;
    };
    readonly recipient?: {
      readonly name: string;
      readonly avatar?: string;
    };
    readonly skill: string;
    readonly message?: string;
  };
  readonly onViewProfile?: () => void;
  readonly onRespond?: () => void;
  readonly onReciprocate?: () => void;
  readonly onDismiss?: () => void;
  readonly className?: string;
}

export function EndorsementNotification({
  type,
  data,
  onViewProfile,
  onRespond,
  onReciprocate,
  onDismiss,
  className,
}: EndorsementNotificationProps) {
  const renderContent = () => {
    switch (type) {
      case 'received':
        return (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white">
                {data.endorser?.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <strong>{data.endorser?.name}</strong> endorsed your <strong>{data.skill}</strong>{' '}
                  skills
                </p>
                <p className="mt-1 text-xs text-gray-500">Just now</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {onViewProfile && (
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                  onClick={onViewProfile}
                >
                  View Profile
                </button>
              )}
              {onReciprocate && (
                <button
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  onClick={onReciprocate}
                >
                  Endorse Back
                </button>
              )}
            </div>
          </>
        );

      case 'request':
        return (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                {data.requester?.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <strong>{data.requester?.name}</strong> requested an endorsement for{' '}
                  <strong>{data.skill}</strong>
                </p>
                {data.message && (
                  <p className="mt-1 text-sm italic text-gray-600">&ldquo;{data.message}&rdquo;</p>
                )}
                <p className="mt-1 text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {onRespond && (
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                  onClick={onRespond}
                >
                  Respond
                </button>
              )}
            </div>
          </>
        );

      case 'given':
        return (
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <ThumbsUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                Thanks for endorsing <strong>{data.recipient?.name}</strong>!
              </p>
              <p className="mt-1 text-xs text-gray-500">Your endorsement has been recorded</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={cn('relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm', className)}
    >
      {renderContent()}
      {onDismiss && (
        <button
          className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:text-gray-600"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Batch notification for multiple endorsements
export function EndorsementBatchNotification({
  endorsements,
  onViewAll,
  onDismiss,
  className,
}: Readonly<{
  endorsements: ReadonlyArray<{ endorser: string; skill: string }>;
  onViewAll?: () => void;
  onDismiss?: () => void;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-green-100 p-2">
          <Users className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{endorsements.length} new endorsements!</p>
          <p className="mt-1 text-sm text-gray-600">
            Your skills are being recognized by your connections
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {endorsements.slice(0, 3).map((e) => (
              <span
                key={`${e.endorser}-${e.skill}`}
                className="rounded bg-white px-2 py-1 text-xs text-gray-700"
              >
                {e.skill}
              </span>
            ))}
            {endorsements.length > 3 && (
              <span className="rounded bg-white px-2 py-1 text-xs text-gray-500">
                +{endorsements.length - 3} more
              </span>
            )}
          </div>
        </div>
        {onDismiss && (
          <button className="p-1 text-gray-400 hover:text-gray-600" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {onViewAll && (
        <button
          className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          onClick={onViewAll}
        >
          View All Endorsements
        </button>
      )}
    </div>
  );
}

export default EndorsementNotification;

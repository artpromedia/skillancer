/**
 * User Admin Actions Component
 *
 * Administrative actions for user management including suspend, ban,
 * password reset, session management, and GDPR operations.
 *
 * @module components/users/user-actions
 */

'use client';

import {
  ShieldCheck,
  UserX,
  Ban,
  Key,
  LogOut,
  Users,
  Trash2,
  MessageSquare,
  TrendingUp,
  Award,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface UserActionsProps {
  userId: string;
  userName: string;
  userStatus: 'active' | 'suspended' | 'banned' | 'pending';
  onActionComplete?: (action: string, success: boolean) => void;
}

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  onConfirm: () => void;
  children?: React.ReactNode;
}

// ============================================================================
// Action Modal Component
// ============================================================================

function ActionModal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  children,
}: Readonly<ActionModalProps>) {
  if (!isOpen) return null;

  const confirmStyles = {
    primary: 'admin-btn-primary',
    danger: 'admin-btn-danger',
    warning: 'admin-btn bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        className="fixed inset-0 cursor-default border-0 bg-black/50"
        type="button"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <p className="mb-4 text-gray-600 dark:text-gray-400">{description}</p>

        {children}

        <div className="mt-6 flex justify-end gap-3">
          <button className="admin-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={confirmStyles[confirmVariant]} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Suspend User Modal
// ============================================================================

function SuspendUserModal({
  isOpen,
  onClose,
  userName,
  onConfirm,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onConfirm: (reason: string, duration: string) => void;
}>) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7d');

  const handleConfirm = () => {
    onConfirm(reason, duration);
    onClose();
  };

  return (
    <ActionModal
      confirmLabel="Suspend User"
      confirmVariant="warning"
      description={`Suspending ${userName} will temporarily restrict their access to the platform.`}
      isOpen={isOpen}
      title="Suspend User"
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Suspension Reason <span className="text-red-500">*</span>
          </label>
          <select
            className="admin-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Select a reason...</option>
            <option value="policy_violation">Policy Violation</option>
            <option value="suspicious_activity">Suspicious Activity</option>
            <option value="payment_issues">Payment Issues</option>
            <option value="user_request">User Request</option>
            <option value="investigation">Under Investigation</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Duration
          </label>
          <select
            className="admin-input"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="14d">14 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="indefinite">Indefinite (Until Manually Lifted)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Additional Notes
          </label>
          <textarea
            className="admin-input min-h-[80px]"
            placeholder="Add any additional context..."
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            User will be notified via email about the suspension and can appeal the decision.
          </p>
        </div>
      </div>
    </ActionModal>
  );
}

// ============================================================================
// Ban User Modal
// ============================================================================

function BanUserModal({
  isOpen,
  onClose,
  userName,
  onConfirm,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onConfirm: (reason: string) => void;
}>) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleConfirm = () => {
    if (confirmText === 'BAN') {
      onConfirm(reason);
      onClose();
    }
  };

  return (
    <ActionModal
      confirmLabel="Permanently Ban User"
      confirmVariant="danger"
      description={`This will permanently ban ${userName} from the platform.`}
      isOpen={isOpen}
      title="Ban User Permanently"
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            ⚠️ This action is permanent and cannot be undone!
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-red-600 dark:text-red-400">
            <li>User will lose access immediately</li>
            <li>All active contracts will be flagged</li>
            <li>Pending payouts will be held for review</li>
            <li>Profile will be hidden from public</li>
          </ul>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ban Reason <span className="text-red-500">*</span>
          </label>
          <select
            className="admin-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Select a reason...</option>
            <option value="fraud">Fraud / Scam</option>
            <option value="spam">Spam / Fake Account</option>
            <option value="harassment">Harassment / Abuse</option>
            <option value="illegal_content">Illegal Content</option>
            <option value="repeated_violations">Repeated Policy Violations</option>
            <option value="identity_theft">Identity Theft</option>
            <option value="money_laundering">Suspected Money Laundering</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type &quot;BAN&quot; to confirm
          </label>
          <input
            className="admin-input"
            placeholder="Type BAN to confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          />
        </div>
      </div>
    </ActionModal>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserActions({
  userId,
  userName,
  userStatus,
  onActionComplete,
}: Readonly<UserActionsProps>) {
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (action: string, handler: () => void | Promise<void>) => {
    setIsLoading(action);
    try {
      await handler();
      onActionComplete?.(action, true);
    } catch {
      onActionComplete?.(action, false);
    } finally {
      setIsLoading(null);
    }
  };

  const handleVerifyIdentity = () => {
    void handleAction('verify', async () => {
      // API call to verify identity
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('Identity verified for user:', userId);
    });
  };

  const handleResetPassword = () => {
    void handleAction('reset_password', async () => {
      // API call to reset password
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('Password reset sent to user:', userId);
    });
  };

  const handleForceLogout = () => {
    void handleAction('force_logout', async () => {
      // API call to force logout
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('All sessions terminated for user:', userId);
    });
  };

  const handleSuspend = (reason: string, duration: string) => {
    void handleAction('suspend', async () => {
      // API call to suspend user
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('User suspended:', userId, reason, duration);
    });
  };

  const handleBan = (reason: string) => {
    void handleAction('ban', async () => {
      // API call to ban user
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('User banned:', userId, reason);
    });
  };

  const handleMergeDuplicate = () => {
    void handleAction('merge', () => {
      // Open merge wizard
      // eslint-disable-next-line no-console
      console.log('Opening merge wizard for user:', userId);
    });
  };

  const handleDeleteAccount = () => {
    void handleAction('delete', async () => {
      // API call to delete account (GDPR)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-console
      console.log('Account deletion initiated for user:', userId);
    });
  };

  const handleAddNote = () => {
    // eslint-disable-next-line no-console
    console.log('Adding note for user:', userId);
  };

  const handleAdjustTrustScore = () => {
    // eslint-disable-next-line no-console
    console.log('Adjusting trust score for user:', userId);
  };

  const handleManageBadges = () => {
    // eslint-disable-next-line no-console
    console.log('Managing badges for user:', userId);
  };

  return (
    <>
      <div className="space-y-3">
        {/* Verification */}
        <button
          className="admin-btn-secondary w-full justify-start"
          disabled={isLoading === 'verify'}
          onClick={handleVerifyIdentity}
        >
          <ShieldCheck className="h-4 w-4" />
          {isLoading === 'verify' ? 'Verifying...' : 'Verify Identity Manually'}
        </button>

        {/* Suspend (only for active users) */}
        {userStatus === 'active' && (
          <button
            className="admin-btn-secondary w-full justify-start text-yellow-600 hover:text-yellow-700"
            onClick={() => setSuspendModalOpen(true)}
          >
            <UserX className="h-4 w-4" />
            Suspend User
          </button>
        )}

        {/* Ban (only for non-banned users) */}
        {userStatus !== 'banned' && (
          <button
            className="admin-btn-secondary w-full justify-start text-red-600 hover:text-red-700"
            onClick={() => setBanModalOpen(true)}
          >
            <Ban className="h-4 w-4" />
            Ban User Permanently
          </button>
        )}

        {/* Password Reset */}
        <button
          className="admin-btn-secondary w-full justify-start"
          disabled={isLoading === 'reset_password'}
          onClick={handleResetPassword}
        >
          <Key className="h-4 w-4" />
          {isLoading === 'reset_password' ? 'Sending...' : 'Reset Password'}
        </button>

        {/* Force Logout */}
        <button
          className="admin-btn-secondary w-full justify-start"
          disabled={isLoading === 'force_logout'}
          onClick={handleForceLogout}
        >
          <LogOut className="h-4 w-4" />
          {isLoading === 'force_logout' ? 'Logging Out...' : 'Force Logout All Sessions'}
        </button>

        {/* Merge Duplicate */}
        <button className="admin-btn-secondary w-full justify-start" onClick={handleMergeDuplicate}>
          <Users className="h-4 w-4" />
          Merge Duplicate Account
        </button>

        {/* Add Note */}
        <button className="admin-btn-secondary w-full justify-start" onClick={handleAddNote}>
          <MessageSquare className="h-4 w-4" />
          Add Admin Note
        </button>

        {/* Adjust Trust Score */}
        <button
          className="admin-btn-secondary w-full justify-start"
          onClick={handleAdjustTrustScore}
        >
          <TrendingUp className="h-4 w-4" />
          Adjust Trust Score
        </button>

        {/* Manage Badges */}
        <button className="admin-btn-secondary w-full justify-start" onClick={handleManageBadges}>
          <Award className="h-4 w-4" />
          Grant/Revoke Badges
        </button>

        {/* Delete Account */}
        <button
          className="admin-btn-secondary w-full justify-start text-red-600 hover:text-red-700"
          disabled={isLoading === 'delete'}
          onClick={handleDeleteAccount}
        >
          <Trash2 className="h-4 w-4" />
          {isLoading === 'delete' ? 'Processing...' : 'Delete Account (GDPR)'}
        </button>
      </div>

      {/* Modals */}
      <SuspendUserModal
        isOpen={suspendModalOpen}
        userName={userName}
        onClose={() => setSuspendModalOpen(false)}
        onConfirm={handleSuspend}
      />
      <BanUserModal
        isOpen={banModalOpen}
        userName={userName}
        onClose={() => setBanModalOpen(false)}
        onConfirm={handleBan}
      />
    </>
  );
}

export default UserActions;

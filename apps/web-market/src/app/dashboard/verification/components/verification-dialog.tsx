'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@skillancer/ui';
import { AlertCircle, CheckCircle2, Loader2, Mail, Phone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useSendVerificationCode,
  useVerifyCode,
  type VerificationType,
} from '@/hooks/use-verification';

// ============================================================================
// Types
// ============================================================================

interface VerificationDialogProps {
  /** Type of verification (email or phone) */
  readonly type: VerificationType;
  /** Whether the dialog is open */
  readonly open: boolean;
  /** Callback when dialog closes */
  readonly onOpenChange: (open: boolean) => void;
  /** Current email/phone to verify (optional for email if using account email) */
  readonly destination?: string;
  /** Callback when verification is successful */
  readonly onSuccess?: () => void;
}

type Step = 'input' | 'verify' | 'success';

// ============================================================================
// Component
// ============================================================================

export function VerificationDialog({
  type,
  open,
  onOpenChange,
  destination,
  onSuccess,
}: VerificationDialogProps) {
  const [step, setStep] = useState<Step>('input');
  const [inputValue, setInputValue] = useState(destination ?? '');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    sendCode,
    isPending: isSending,
    isSuccess: codeSent,
    error: sendError,
    expiresAt,
    reset: resetSend,
  } = useSendVerificationCode();

  const {
    verifyCode,
    isPending: isVerifying,
    isSuccess: verified,
    error: verifyError,
    reset: resetVerify,
  } = useVerifyCode();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setCode('');
      setInputValue(destination ?? '');
      resetSend();
      resetVerify();
    }
  }, [open, destination, resetSend, resetVerify]);

  // Move to verify step when code is sent
  useEffect(() => {
    if (codeSent && expiresAt) {
      setStep('verify');
      // Start countdown (assuming 5 minutes expiry)
      const expiryTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.floor((expiryTime - now) / 1000);
      setCountdown(Math.max(0, remaining));
    }
  }, [codeSent, expiresAt]);

  // Move to success step when verified
  useEffect(() => {
    if (verified) {
      setStep('success');
      // Auto-close after 2 seconds
      const timer = setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verified, onOpenChange, onSuccess]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const handleSendCode = useCallback(() => {
    if (type === 'phone' && !inputValue) return;
    sendCode({ type, destination: type === 'phone' ? inputValue : undefined });
  }, [type, inputValue, sendCode]);

  const handleVerifyCode = useCallback(() => {
    if (code.length !== 6) return;
    verifyCode({ type, code });
  }, [type, code, verifyCode]);

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replaceAll(/\D/g, '').slice(0, 6);
      setCode(digits);
      // Focus the last filled input or the next empty one
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    setCode((prev) => {
      const codeArray = prev.split('');
      codeArray[index] = value;
      return codeArray.join('').slice(0, 6);
    });

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code]
  );

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const Icon = type === 'email' ? Mail : Phone;
  const title = type === 'email' ? 'Verify Email Address' : 'Verify Phone Number';
  const inputLabel = type === 'email' ? 'Email Address' : 'Phone Number';
  const inputPlaceholder = type === 'email' ? 'your@email.com' : '+1 (555) 000-0000';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icon className="text-primary h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {step === 'input' &&
              (type === 'email'
                ? "We'll send a 6-digit verification code to your email address."
                : 'Enter your phone number to receive a 6-digit verification code via SMS.')}
            {step === 'verify' && (
              <>
                Enter the 6-digit code we sent to <span className="font-medium">{inputValue}</span>
              </>
            )}
            {step === 'success' && 'Your verification was successful!'}
          </DialogDescription>
        </DialogHeader>

        {/* Input Step */}
        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="verification-input">
                {inputLabel}
              </label>
              <Input
                id="verification-input"
                placeholder={inputPlaceholder}
                type={type === 'email' ? 'email' : 'tel'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>

            {sendError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sendError.message}
              </div>
            )}

            <DialogFooter>
              <Button
                className="w-full"
                disabled={isSending || (type === 'phone' && !inputValue)}
                onClick={handleSendCode}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className={cn(
                    'h-12 w-12 text-center text-lg font-semibold',
                    verifyError && 'border-red-500'
                  )}
                  inputMode="numeric"
                  maxLength={6}
                  type="text"
                  value={code[index] ?? ''}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                />
              ))}
            </div>

            {verifyError && (
              <div className="flex items-center justify-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Invalid code. Please try again.
              </div>
            )}

            <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              {countdown > 0 ? (
                <>Code expires in {formatCountdown(countdown)}</>
              ) : (
                <Button
                  className="h-auto p-0 text-sm"
                  disabled={isSending}
                  variant="link"
                  onClick={handleSendCode}
                >
                  <RefreshCw className={cn('mr-1 h-3 w-3', isSending && 'animate-spin')} />
                  Resend code
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button
                className="w-full"
                disabled={isVerifying || code.length !== 6}
                onClick={handleVerifyCode}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-muted-foreground text-sm">
              {type === 'email' ? 'Email verified' : 'Phone number verified'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

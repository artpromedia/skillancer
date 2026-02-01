'use client';

import { Button, cn } from '@skillancer/ui';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type VerificationTier = 'BASIC' | 'ENHANCED' | 'PREMIUM';
type InquiryStatus = 'loading' | 'ready' | 'completed' | 'failed' | 'expired';

interface PersonaEmbedProps {
  tier: VerificationTier;
  onComplete: (inquiryId: string) => void;
  onCancel: () => void;
  className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:4000/api/auth';

const PERSONA_TEMPLATE_IDS: Record<VerificationTier, string> = {
  BASIC: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_BASIC ?? 'itmpl_basic',
  ENHANCED: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ENHANCED ?? 'itmpl_enhanced',
  PREMIUM: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_PREMIUM ?? 'itmpl_premium',
};

const PERSONA_ENVIRONMENT = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT ?? 'sandbox';

// ============================================================================
// Component
// ============================================================================

export function PersonaEmbed({
  tier,
  onComplete,
  onCancel,
  className,
}: Readonly<PersonaEmbedProps>) {
  const [status, setStatus] = useState<InquiryStatus>('loading');
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Persona inquiry
  const initializeInquiry = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);

      // Call backend to create inquiry session
      const response = await fetch(`${AUTH_API_URL}/verification/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verificationType: tier }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize verification');
      }

      const data = (await response.json()) as { inquiryId: string; sessionToken: string };
      setInquiryId(data.inquiryId);

      // Load Persona SDK
      await loadPersonaSDK();

      // Start Persona client
      startPersonaClient(data.inquiryId, data.sessionToken);

      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start verification');
      setStatus('failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  // Load Persona SDK script
  const loadPersonaSDK = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((globalThis as unknown as { Persona?: unknown }).Persona) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.withpersona.com/dist/persona-v5.0.0.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Persona SDK'));
      document.body.appendChild(script);
    });
  };

  // Start Persona client
  const startPersonaClient = (inquiryId: string, sessionToken: string) => {
    const Persona = (globalThis as unknown as { Persona: PersonaClient }).Persona;

    const client = new Persona.Client({
      templateId: PERSONA_TEMPLATE_IDS[tier],
      environment: PERSONA_ENVIRONMENT,
      inquiryId,
      sessionToken,
      onReady: () => {
        setStatus('ready');
        client.open();
      },
      onComplete: ({ inquiryId: completedId }: { inquiryId: string }) => {
        setStatus('completed');
        onComplete(completedId);
      },
      onCancel: () => {
        onCancel();
      },
      onError: (error: Error) => {
        setError(error.message);
        setStatus('failed');
      },
    });
  };

  useEffect(() => {
    void initializeInquiry();
  }, [initializeInquiry]);

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div
        className={cn(
          'bg-card relative w-full max-w-lg rounded-lg border p-6 shadow-lg',
          className
        )}
      >
        {/* Close button */}
        <Button className="absolute right-4 top-4" size="icon" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>

        {/* Loading state */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <div className="text-center">
              <p className="font-medium">Preparing verification...</p>
              <p className="text-muted-foreground text-sm">This will only take a moment</p>
            </div>
          </div>
        )}

        {/* Ready state - Persona will open in modal */}
        {status === 'ready' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="bg-primary/10 rounded-full p-4">
              <CheckCircle2 className="text-primary h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-medium">Verification Ready</p>
              <p className="text-muted-foreground text-sm">
                The verification window should open automatically. If it doesn&apos;t, click below.
              </p>
            </div>
            <Button onClick={() => void initializeInquiry()}>Open Verification</Button>
          </div>
        )}

        {/* Completed state */}
        {status === 'completed' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="font-medium">Verification Submitted!</p>
              <p className="text-muted-foreground text-sm">
                We&apos;re reviewing your information. This usually takes a few minutes.
              </p>
            </div>
            <Button onClick={() => onComplete(inquiryId ?? '')}>Continue</Button>
          </div>
        )}

        {/* Error state */}
        {status === 'failed' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="bg-destructive/10 rounded-full p-4">
              <AlertCircle className="text-destructive h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-medium">Verification Failed</p>
              <p className="text-muted-foreground text-sm">
                {error ?? 'Something went wrong. Please try again.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => void initializeInquiry()}>Try Again</Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-muted/50 mt-6 rounded-lg p-4">
          <h4 className="text-sm font-medium">What you&apos;ll need:</h4>
          <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
            <li>• Government-issued ID (passport, driver&apos;s license, or ID card)</li>
            <li>• Good lighting for photo capture</li>
            <li>• A few minutes to complete the process</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Persona SDK Type Declaration
// ============================================================================

interface PersonaClient {
  Client: new (options: {
    templateId: string;
    environment: string;
    inquiryId: string;
    sessionToken: string;
    onReady: () => void;
    onComplete: (data: { inquiryId: string }) => void;
    onCancel: () => void;
    onError: (error: Error) => void;
  }) => {
    open: () => void;
    destroy: () => void;
  };
}

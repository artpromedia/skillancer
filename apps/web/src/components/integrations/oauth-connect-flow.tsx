'use client';

import { Button } from '@skillancer/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@skillancer/ui/dialog';
import { useToast } from '@skillancer/ui/use-toast';
import { RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface OAuthConnectFlowProps {
  integration: {
    slug: string;
    name: string;
    logoUrl?: string;
    description?: string;
  };
  workspaceId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

type FlowState = 'initial' | 'initiating' | 'processing' | 'success' | 'error';

export function OAuthConnectFlow({
  integration,
  workspaceId,
  onSuccess,
  onError,
  children,
}: OAuthConnectFlowProps) {
  const { toast } = useToast();
  const [flowState, setFlowState] = useState<FlowState>('initial');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConnect = async () => {
    setFlowState('initiating');
    setErrorMessage('');

    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/integrations/${integration.slug}/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate connection');
      }

      if (data.authorizationUrl) {
        // Option 1: Redirect in same window
        // window.location.href = data.authorizationUrl;

        // Option 2: Open in popup
        const popup = openOAuthPopup(data.authorizationUrl);
        if (popup) {
          setFlowState('processing');
          waitForPopupClose(popup);
        } else {
          // Popup blocked, fallback to redirect
          window.location.href = data.authorizationUrl;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setErrorMessage(message);
      setFlowState('error');
      onError?.(message);
    }
  };

  const openOAuthPopup = (url: string): Window | null => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return window.open(
      url,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  };

  const waitForPopupClose = (popup: Window) => {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        handlePopupClosed();
      }
    }, 500);

    // Also listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth_callback') {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);

        if (event.data.success) {
          setFlowState('success');
          onSuccess?.();
          toast({
            title: 'Connection successful',
            description: `${integration.name} has been connected.`,
          });
        } else {
          setErrorMessage(event.data.error || 'Connection failed');
          setFlowState('error');
          onError?.(event.data.error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
  };

  const handlePopupClosed = () => {
    // Check if connection was successful by querying the API
    checkConnectionStatus();
  };

  const checkConnectionStatus = async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/integrations`);
      const data = await res.json();

      const connected = data.integrations?.some(
        (i: { integrationType: { slug: string }; status: string }) =>
          i.integrationType.slug === integration.slug && i.status === 'CONNECTED'
      );

      if (connected) {
        setFlowState('success');
        onSuccess?.();
        toast({
          title: 'Connection successful',
          description: `${integration.name} has been connected.`,
        });
      } else {
        // User may have cancelled
        setFlowState('initial');
      }
    } catch {
      setFlowState('initial');
    }
  };

  const handleRetry = () => {
    setFlowState('initial');
    setErrorMessage('');
    handleConnect();
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setFlowState('initial');
    setErrorMessage('');
  };

  const renderContent = () => {
    switch (flowState) {
      case 'initial':
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {integration.description ||
                `Connect ${integration.name} to access its features in your workspace.`}
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleConnect}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect {integration.name}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'initiating':
        return (
          <div className="flex flex-col items-center py-8">
            <RefreshCw className="text-primary mb-4 h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Preparing connection...</p>
          </div>
        );

      case 'processing':
        return (
          <div className="flex flex-col items-center py-8">
            <RefreshCw className="text-primary mb-4 h-8 w-8 animate-spin" />
            <p className="mb-2 font-medium">Completing connection...</p>
            <p className="text-muted-foreground text-sm">
              Please complete the authorization in the popup window.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
            <p className="mb-2 font-medium">Connected successfully!</p>
            <p className="text-muted-foreground mb-4 text-sm">
              {integration.name} is now connected to your workspace.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-8">
            <XCircle className="mb-4 h-12 w-12 text-red-500" />
            <p className="mb-2 font-medium">Connection failed</p>
            <p className="text-muted-foreground mb-4 text-center text-sm">{errorMessage}</p>
            <div className="flex gap-3">
              <Button onClick={handleRetry}>Try Again</Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {/* Trigger element */}
      <div onClick={() => setIsDialogOpen(true)}>{children}</div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {integration.logoUrl && (
                <img
                  alt={integration.name}
                  className="h-10 w-10 rounded"
                  src={integration.logoUrl}
                />
              )}
              <div>
                <DialogTitle>Connect {integration.name}</DialogTitle>
                <DialogDescription>
                  Authorize access to your {integration.name} account
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OAuthConnectFlow;

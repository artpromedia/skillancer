'use client';

/**
 * Widget Error Boundary
 * Handles widget errors with appropriate recovery actions
 */

import { Button } from '@skillancer/ui/components/button';
import { Card, CardContent } from '@skillancer/ui/components/card';
import { AlertTriangle, RefreshCw, Link2, Clock, WifiOff } from 'lucide-react';
import { Component } from 'react';

import type { ReactNode } from 'react';
import type React from 'react';

interface IntegrationError {
  type: string;
  message: string;
  recoveryAction?: string;
  retryAfter?: number;
  reconnectUrl?: string;
}

interface Props {
  children: ReactNode;
  widgetId: string;
  integrationId?: string;
  onRetry?: () => void;
  onReconnect?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: IntegrationError | null;
  countdown: number;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  private countdownInterval?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, countdown: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error: {
        type: 'UNKNOWN',
        message: error.message,
        recoveryAction: 'retry',
      },
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget error:', this.props.widgetId, error, errorInfo);
  }

  override componentWillUnmount() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  handleReconnect = () => {
    this.props.onReconnect?.();
  };

  startCountdown = (seconds: number) => {
    this.setState({ countdown: seconds });
    this.countdownInterval = setInterval(() => {
      this.setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(this.countdownInterval);
          this.handleRetry();
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, countdown } = this.state;
    const errorType = error?.type || 'UNKNOWN';

    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          {errorType === 'RATE_LIMITED' ? (
            <>
              <Clock className="mb-3 h-8 w-8 text-yellow-500" />
              <p className="mb-1 font-medium">Rate Limited</p>
              <p className="text-muted-foreground mb-3 text-sm">
                {countdown > 0 ? `Retrying in ${countdown}s...` : error?.message}
              </p>
              {countdown === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => this.startCountdown(error?.retryAfter || 60)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Wait & Retry
                </Button>
              )}
            </>
          ) : errorType === 'AUTH_EXPIRED' ? (
            <>
              <Link2 className="mb-3 h-8 w-8 text-orange-500" />
              <p className="mb-1 font-medium">Reconnection Required</p>
              <p className="text-muted-foreground mb-3 text-sm">{error?.message}</p>
              <Button size="sm" onClick={this.handleReconnect}>
                <Link2 className="mr-2 h-4 w-4" />
                Reconnect
              </Button>
            </>
          ) : errorType === 'NETWORK_ERROR' ? (
            <>
              <WifiOff className="mb-3 h-8 w-8 text-gray-500" />
              <p className="mb-1 font-medium">Connection Lost</p>
              <p className="text-muted-foreground mb-3 text-sm">Check your internet connection.</p>
              <Button size="sm" variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </>
          ) : (
            <>
              <AlertTriangle className="text-destructive mb-3 h-8 w-8" />
              <p className="mb-1 font-medium">Something went wrong</p>
              <p className="text-muted-foreground mb-3 text-sm">
                {error?.message || 'An error occurred.'}
              </p>
              <Button size="sm" variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
}

export default WidgetErrorBoundary;

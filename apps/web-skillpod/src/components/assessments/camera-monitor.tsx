'use client';

import { cn } from '@skillancer/ui';
import { Camera, AlertTriangle, CheckCircle2, XCircle, Loader2, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface CameraMonitorProps {
  onFaceDetected?: (detected: boolean) => void;
  onMultipleFaces?: () => void;
  onNoFace?: () => void;
  onLookingAway?: () => void;
  minimized?: boolean;
  showFeedback?: boolean;
  onConfidenceChange?: (confidence: number) => void;
}

export function CameraMonitor({
  onFaceDetected,
  onMultipleFaces,
  onNoFace,
  onLookingAway,
  minimized = false,
  showFeedback = true,
  onConfidenceChange,
}: Readonly<CameraMonitorProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<'ok' | 'no-face' | 'multiple' | 'looking-away'>(
    'ok'
  );
  const [confidence, setConfidence] = useState(100);

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 320 },
            height: { ideal: 240 },
          },
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError('Failed to access camera');
          setIsLoading(false);
        }
      }
    };

    void initCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Simulate face detection (in real app, use TensorFlow.js or similar)
  useEffect(() => {
    if (!stream || isLoading) return;

    const checkFace = () => {
      // Simulate face detection with random events for demo
      const random = Math.random();

      if (random > 0.95) {
        setFaceStatus('no-face');
        setConfidence((prev) => Math.max(50, prev - 5));
        onNoFace?.();
        onFaceDetected?.(false);
      } else if (random > 0.92) {
        setFaceStatus('looking-away');
        setConfidence((prev) => Math.max(60, prev - 3));
        onLookingAway?.();
      } else if (random > 0.99) {
        setFaceStatus('multiple');
        setConfidence((prev) => Math.max(30, prev - 10));
        onMultipleFaces?.();
      } else {
        setFaceStatus('ok');
        setConfidence((prev) => Math.min(100, prev + 1));
        onFaceDetected?.(true);
      }

      onConfidenceChange?.(confidence);
    };

    const interval = setInterval(checkFace, 2000);
    return () => clearInterval(interval);
  }, [
    stream,
    isLoading,
    confidence,
    onFaceDetected,
    onMultipleFaces,
    onNoFace,
    onLookingAway,
    onConfidenceChange,
  ]);

  const getFeedbackMessage = () => {
    switch (faceStatus) {
      case 'no-face':
        return { icon: XCircle, text: 'Face not visible', color: 'text-red-600 bg-red-50' };
      case 'multiple':
        return {
          icon: AlertTriangle,
          text: 'Multiple faces detected',
          color: 'text-red-600 bg-red-50',
        };
      case 'looking-away':
        return {
          icon: AlertTriangle,
          text: 'Please look at the screen',
          color: 'text-amber-600 bg-amber-50',
        };
      default:
        return { icon: CheckCircle2, text: 'Face verified', color: 'text-green-600 bg-green-50' };
    }
  };

  const feedback = getFeedbackMessage();
  const FeedbackIcon = feedback.icon;

  if (minimized) {
    return (
      <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-gray-200">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <span
              className={cn(
                'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                faceStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'
              )}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-900">
            <User className="h-6 w-6 text-gray-600" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-gray-900">
      {/* Video Container */}
      <div className="relative aspect-[4/3] bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <Camera className="mb-2 h-10 w-10 text-gray-600" />
            <p className="text-center text-sm text-gray-400">{error}</p>
          </div>
        )}

        {stream && !isLoading && (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {/* Face detection overlay */}
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

            {/* Face guide circle */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  'h-32 w-32 rounded-full border-2 border-dashed transition-colors',
                  faceStatus === 'ok' ? 'border-green-400' : 'border-red-400'
                )}
              />
            </div>

            {/* Status indicator */}
            <div className="absolute right-2 top-2">
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                  feedback.color
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    faceStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'
                  )}
                />
                {faceStatus === 'ok' ? 'OK' : '!'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Feedback Bar */}
      {showFeedback && stream && !isLoading && (
        <div className={cn('flex items-center gap-2 px-3 py-2', feedback.color)}>
          <FeedbackIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{feedback.text}</span>
        </div>
      )}
    </div>
  );
}

// Compact camera indicator for header
export function CameraIndicator({
  stream,
  faceDetected,
}: Readonly<{
  stream?: MediaStream | null;
  faceDetected: boolean;
}>) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative">
      <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-gray-300">
        {stream ? (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <Camera className="h-5 w-5 text-gray-400" />
          </div>
        )}
      </div>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white',
          faceDetected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    </div>
  );
}

export default CameraMonitor;

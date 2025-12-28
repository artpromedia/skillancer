'use client';

import { cn } from '@skillancer/ui';
import {
  Camera,
  Mic,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ProctoringSetupProps {
  requireCamera: boolean;
  requireScreenShare: boolean;
  requireMicrophone?: boolean;
  onComplete: (status: {
    cameraEnabled: boolean;
    screenShareEnabled: boolean;
    microphoneEnabled: boolean;
    fullscreenEnabled: boolean;
  }) => void;
  onCancel: () => void;
}

type SetupStep = 'camera' | 'screen' | 'microphone' | 'fullscreen' | 'complete';

export function ProctoringSetup({
  requireCamera,
  requireScreenShare,
  requireMicrophone = false,
  onComplete,
  onCancel,
}: Readonly<ProctoringSetupProps>) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('camera');
  const [permissions, setPermissions] = useState({
    camera: false,
    screen: false,
    microphone: false,
    fullscreen: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Steps to complete based on requirements
  const steps: SetupStep[] = [
    ...(requireCamera ? ['camera' as const] : []),
    ...(requireScreenShare ? ['screen' as const] : []),
    ...(requireMicrophone ? ['microphone' as const] : []),
    'fullscreen' as const,
    'complete' as const,
  ];

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Request camera permission
  const requestCamera = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setPermissions((prev) => ({ ...prev, camera: true }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ camera: `Camera access denied: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Request screen share permission
  const requestScreenShare = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
      });

      // Check if user shared entire screen
      const track = screenStream.getVideoTracks()[0];
      const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };

      if (settings.displaySurface !== 'monitor') {
        screenStream.getTracks().forEach((t) => t.stop());
        setErrors({ screen: 'Please share your entire screen, not just a window or tab.' });
        setIsLoading(false);
        return;
      }

      setPermissions((prev) => ({ ...prev, screen: true }));

      // Stop screen stream preview (we'll restart it when assessment begins)
      screenStream.getTracks().forEach((t) => t.stop());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ screen: `Screen share denied: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Request microphone permission
  const requestMicrophone = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach((t) => t.stop());
      setPermissions((prev) => ({ ...prev, microphone: true }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ microphone: `Microphone access denied: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Request fullscreen
  const requestFullscreen = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      await document.documentElement.requestFullscreen();
      setPermissions((prev) => ({ ...prev, fullscreen: true }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ fullscreen: `Fullscreen mode failed: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Move to next step
  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  // Handle step completion
  useEffect(() => {
    if (currentStep === 'complete') {
      onComplete({
        cameraEnabled: permissions.camera,
        screenShareEnabled: permissions.screen,
        microphoneEnabled: permissions.microphone,
        fullscreenEnabled: permissions.fullscreen,
      });
    }
  }, [currentStep, permissions, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const renderStep = () => {
    switch (currentStep) {
      case 'camera':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Camera className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Enable Camera Access</h3>
            <p className="mb-6 text-gray-600">
              We need access to your camera to verify your identity during the assessment.
            </p>

            {/* Camera Preview */}
            <div className="relative mx-auto mb-6 h-48 w-64 overflow-hidden rounded-lg bg-gray-900">
              {permissions.camera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Camera className="h-12 w-12 text-gray-600" />
                </div>
              )}
            </div>

            {errors.camera && (
              <div className="mb-4 flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{errors.camera}</span>
              </div>
            )}

            {permissions.camera ? (
              <div className="mb-6 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Camera access granted</span>
              </div>
            ) : (
              <button
                className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void requestCamera()}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Requesting...
                  </span>
                ) : (
                  'Allow Camera Access'
                )}
              </button>
            )}
          </div>
        );

      case 'screen':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Monitor className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Share Your Screen</h3>
            <p className="mb-6 text-gray-600">
              Screen sharing helps ensure assessment integrity. Please share your entire screen.
            </p>

            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-amber-800">Important</p>
                  <p className="text-sm text-amber-700">
                    Select &quot;Entire Screen&quot; when prompted, not a specific window or tab.
                  </p>
                </div>
              </div>
            </div>

            {errors.screen && (
              <div className="mb-4 flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{errors.screen}</span>
              </div>
            )}

            {permissions.screen ? (
              <div className="mb-6 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Screen share configured</span>
              </div>
            ) : (
              <button
                className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void requestScreenShare()}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting...
                  </span>
                ) : (
                  'Share Screen'
                )}
              </button>
            )}
          </div>
        );

      case 'microphone':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Mic className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Enable Microphone</h3>
            <p className="mb-6 text-gray-600">
              Microphone access helps detect environmental sounds during the assessment.
            </p>

            {errors.microphone && (
              <div className="mb-4 flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{errors.microphone}</span>
              </div>
            )}

            {permissions.microphone ? (
              <div className="mb-6 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Microphone access granted</span>
              </div>
            ) : (
              <button
                className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void requestMicrophone()}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Requesting...
                  </span>
                ) : (
                  'Allow Microphone Access'
                )}
              </button>
            )}
          </div>
        );

      case 'fullscreen':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
              <Maximize2 className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Enter Fullscreen Mode</h3>
            <p className="mb-6 text-gray-600">
              The assessment will run in fullscreen mode. Exiting fullscreen may be flagged.
            </p>

            {errors.fullscreen && (
              <div className="mb-4 flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{errors.fullscreen}</span>
              </div>
            )}

            {permissions.fullscreen ? (
              <div className="mb-6 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Fullscreen mode active</span>
              </div>
            ) : (
              <button
                className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void requestFullscreen()}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enabling...
                  </span>
                ) : (
                  'Enter Fullscreen'
                )}
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'camera':
        return permissions.camera;
      case 'screen':
        return permissions.screen;
      case 'microphone':
        return permissions.microphone;
      case 'fullscreen':
        return permissions.fullscreen;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Setup Progress</span>
            <span className="text-sm font-medium text-gray-900">
              Step {currentStepIndex + 1} of {steps.length - 1}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Step Content */}
        {renderStep()}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-900" onClick={onCancel}>
            Cancel
          </button>

          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors',
              canProceed()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'cursor-not-allowed bg-gray-100 text-gray-400'
            )}
            disabled={!canProceed()}
            onClick={nextStep}
          >
            {currentStepIndex === steps.length - 2 ? 'Start Assessment' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProctoringSetup;

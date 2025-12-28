/**
 * Proctoring Service
 *
 * Manages the proctoring session for skill assessments including:
 * - Camera and screen share management
 * - Face detection and monitoring
 * - Violation detection and logging
 * - Session integrity scoring
 */

export interface ProctoringConfig {
  requireCamera: boolean;
  requireScreenShare: boolean;
  requireMicrophone: boolean;
  faceDetectionInterval: number; // ms
  screenshotInterval: number; // ms
  maxViolations: number;
  warningThreshold: number;
}

export interface Violation {
  id: string;
  type: ViolationType;
  timestamp: Date;
  severity: 'warning' | 'critical';
  details?: string;
  screenshot?: string;
}

export type ViolationType =
  | 'no-face'
  | 'multiple-faces'
  | 'looking-away'
  | 'fullscreen-exit'
  | 'tab-switch'
  | 'screen-share-stopped'
  | 'camera-blocked'
  | 'suspicious-movement'
  | 'audio-detected'
  | 'connection-lost';

export interface ProctoringState {
  isActive: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  microphoneEnabled: boolean;
  fullscreenActive: boolean;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  confidenceScore: number;
  violations: Violation[];
  sessionStartTime: Date | null;
}

export type ProctoringEventCallback = (event: ProctoringEvent) => void;

export interface ProctoringEvent {
  type: 'violation' | 'status-change' | 'confidence-update' | 'session-end';
  data: Record<string, unknown>;
}

const DEFAULT_CONFIG: ProctoringConfig = {
  requireCamera: true,
  requireScreenShare: true,
  requireMicrophone: false,
  faceDetectionInterval: 2000,
  screenshotInterval: 30000,
  maxViolations: 10,
  warningThreshold: 5,
};

class ProctoringService {
  private config: ProctoringConfig = DEFAULT_CONFIG;
  private state: ProctoringState = {
    isActive: false,
    cameraEnabled: false,
    screenShareEnabled: false,
    microphoneEnabled: false,
    fullscreenActive: false,
    connectionStatus: 'disconnected',
    confidenceScore: 100,
    violations: [],
    sessionStartTime: null,
  };

  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;

  private faceDetectionInterval: NodeJS.Timeout | null = null;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private readonly eventListeners: Set<ProctoringEventCallback> = new Set();

  private attemptId: string | null = null;

  /**
   * Initialize the proctoring service with configuration
   */
  configure(config: Partial<ProctoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to proctoring events
   */
  subscribe(callback: ProctoringEventCallback) {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: ProctoringEvent) {
    this.eventListeners.forEach((callback) => callback(event));
  }

  /**
   * Start a proctoring session
   */
  startSession(attemptId: string): boolean {
    this.attemptId = attemptId;
    this.state = {
      ...this.state,
      isActive: true,
      sessionStartTime: new Date(),
      violations: [],
      confidenceScore: 100,
    };

    // Setup event listeners for fullscreen changes
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    globalThis.addEventListener('blur', this.handleWindowBlur);
    globalThis.addEventListener('online', this.handleOnline);
    globalThis.addEventListener('offline', this.handleOffline);

    // Start periodic checks
    this.startFaceDetection();
    this.startScreenshotCapture();

    this.updateState({ connectionStatus: 'connected' });
    return true;
  }

  /**
   * End the proctoring session
   */
  endSession(): ProctoringState {
    // Stop all streams
    this.stopCamera();
    this.stopScreenShare();
    this.stopMicrophone();

    // Clear intervals
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }

    // Remove event listeners
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    globalThis.removeEventListener('blur', this.handleWindowBlur);
    globalThis.removeEventListener('online', this.handleOnline);
    globalThis.removeEventListener('offline', this.handleOffline);

    const finalState = { ...this.state };
    this.state.isActive = false;

    this.emit({ type: 'session-end', data: { state: finalState } });
    return finalState;
  }

  /**
   * Initialize camera stream
   */
  async startCamera(): Promise<MediaStream | null> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      this.updateState({ cameraEnabled: true });
      return this.cameraStream;
    } catch (error) {
      console.error(error);
      this.recordViolation('camera-blocked', 'warning', 'Failed to access camera');
      return null;
    }
  }

  /**
   * Stop camera stream
   */
  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
      this.updateState({ cameraEnabled: false });
    }
  }

  /**
   * Initialize screen share
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
      });

      // Listen for screen share stop
      this.screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.updateState({ screenShareEnabled: false });
        if (this.state.isActive) {
          this.recordViolation('screen-share-stopped', 'critical', 'Screen share was stopped');
        }
      });

      this.updateState({ screenShareEnabled: true });
      return this.screenStream;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Stop screen share
   */
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
      this.updateState({ screenShareEnabled: false });
    }
  }

  /**
   * Initialize microphone
   */
  async startMicrophone(): Promise<MediaStream | null> {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.updateState({ microphoneEnabled: true });
      return this.microphoneStream;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Stop microphone
   */
  stopMicrophone() {
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
      this.updateState({ microphoneEnabled: false });
    }
  }

  /**
   * Request fullscreen mode
   */
  async requestFullscreen(): Promise<boolean> {
    try {
      await document.documentElement.requestFullscreen();
      this.updateState({ fullscreenActive: true });
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * Exit fullscreen mode
   */
  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    this.updateState({ fullscreenActive: false });
  }

  /**
   * Handle fullscreen change events
   */
  private readonly handleFullscreenChange = () => {
    const isFullscreen = !!document.fullscreenElement;
    this.updateState({ fullscreenActive: isFullscreen });

    if (!isFullscreen && this.state.isActive) {
      this.recordViolation('fullscreen-exit', 'warning', 'Exited fullscreen mode');
    }
  };

  /**
   * Handle visibility change (tab switch)
   */
  private readonly handleVisibilityChange = () => {
    if (document.hidden && this.state.isActive) {
      this.recordViolation('tab-switch', 'warning', 'Switched to another tab');
    }
  };

  /**
   * Handle window blur
   */
  private readonly handleWindowBlur = () => {
    if (this.state.isActive) {
      this.recordViolation('tab-switch', 'warning', 'Window lost focus');
    }
  };

  /**
   * Handle online event
   */
  private readonly handleOnline = () => {
    this.updateState({ connectionStatus: 'connected' });
  };

  /**
   * Handle offline event
   */
  private readonly handleOffline = () => {
    this.updateState({ connectionStatus: 'disconnected' });
    if (this.state.isActive) {
      this.recordViolation('connection-lost', 'critical', 'Internet connection lost');
    }
  };

  /**
   * Start periodic face detection
   */
  private startFaceDetection() {
    this.faceDetectionInterval = setInterval(() => {
      this.detectFace();
    }, this.config.faceDetectionInterval);
  }

  /**
   * Detect face in camera stream
   * In production, this would use TensorFlow.js or a similar library
   */
  private detectFace() {
    if (!this.cameraStream || !this.state.isActive) return;

    // Simulated face detection for demo
    // In production, use @tensorflow-models/face-detection
    const random = Math.random();

    if (random > 0.97) {
      this.recordViolation('no-face', 'warning', 'Face not detected in camera');
      this.adjustConfidence(-5);
    } else if (random > 0.99) {
      this.recordViolation('multiple-faces', 'critical', 'Multiple faces detected');
      this.adjustConfidence(-15);
    } else if (random > 0.95) {
      this.recordViolation('looking-away', 'warning', 'Looking away from screen');
      this.adjustConfidence(-3);
    } else {
      this.adjustConfidence(1);
    }
  }

  /**
   * Start periodic screenshot capture
   */
  private startScreenshotCapture() {
    this.screenshotInterval = setInterval(() => {
      this.captureScreenshot().catch(() => {});
    }, this.config.screenshotInterval);
  }

  /**
   * Capture screenshot for logging
   */
  private async captureScreenshot(): Promise<string | null> {
    if (!this.screenStream) return null;

    const video = document.createElement('video');
    video.srcObject = this.screenStream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      video.pause();
      return dataUrl;
    }

    video.pause();
    return null;
  }

  /**
   * Record a violation
   */
  recordViolation(type: ViolationType, severity: 'warning' | 'critical', details?: string) {
    const violation: Violation = {
      id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      timestamp: new Date(),
      severity,
      details: details ?? '',
    };

    this.state.violations.push(violation);

    this.emit({
      type: 'violation',
      data: { violation, totalViolations: this.state.violations.length },
    });

    // Check if max violations exceeded
    if (this.state.violations.length >= this.config.maxViolations) {
      this.emit({
        type: 'status-change',
        data: { status: 'max-violations-exceeded' },
      });
    }
  }

  /**
   * Adjust confidence score
   */
  private adjustConfidence(delta: number) {
    const newScore = Math.max(0, Math.min(100, this.state.confidenceScore + delta));
    if (newScore !== this.state.confidenceScore) {
      this.state.confidenceScore = newScore;
      this.emit({
        type: 'confidence-update',
        data: { confidence: newScore },
      });
    }
  }

  /**
   * Update state and emit event
   */
  private updateState(updates: Partial<ProctoringState>) {
    this.state = { ...this.state, ...updates };
    this.emit({
      type: 'status-change',
      data: { state: this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): ProctoringState {
    return { ...this.state };
  }

  /**
   * Get camera stream
   */
  getCameraStream(): MediaStream | null {
    return this.cameraStream;
  }

  /**
   * Get screen stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Check if session is valid (not exceeded violations)
   */
  isSessionValid(): boolean {
    return (
      this.state.isActive &&
      this.state.violations.length < this.config.maxViolations &&
      this.state.confidenceScore > 0
    );
  }

  /**
   * Generate session summary
   */
  generateSessionSummary(): {
    duration: number;
    violations: Violation[];
    finalConfidence: number;
    isValid: boolean;
  } {
    const duration = this.state.sessionStartTime
      ? Math.floor((Date.now() - this.state.sessionStartTime.getTime()) / 1000)
      : 0;

    return {
      duration,
      violations: this.state.violations,
      finalConfidence: this.state.confidenceScore,
      isValid: this.isSessionValid(),
    };
  }
}

// Singleton instance
export const proctoringService = new ProctoringService();

// Export for testing
export { ProctoringService };

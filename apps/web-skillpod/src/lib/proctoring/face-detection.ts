/**
 * Face Detection Service
 *
 * Handles real-time face detection for proctoring using the browser's
 * Face Detection API or TensorFlow.js fallback.
 *
 * Features:
 * - Face presence detection
 * - Multiple face detection
 * - Face position tracking (looking away)
 * - Face landmark detection for gaze estimation
 */

export interface DetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    nose?: { x: number; y: number };
    mouth?: { x: number; y: number };
  };
}

export interface FaceDetectionResult {
  faces: DetectedFace[];
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
}

export interface FaceDetectionConfig {
  minConfidence: number;
  maxFaces: number;
  checkInterval: number;
  lookingAwayThreshold: number;
}

export type FaceDetectionStatus =
  | 'ok'
  | 'no-face'
  | 'multiple-faces'
  | 'looking-away'
  | 'low-confidence'
  | 'error';

export interface FaceDetectionCallback {
  onFaceDetected: (faces: DetectedFace[]) => void;
  onNoFace: () => void;
  onMultipleFaces: (count: number) => void;
  onLookingAway: (direction: string) => void;
  onError: (error: Error) => void;
}

const DEFAULT_CONFIG: FaceDetectionConfig = {
  minConfidence: 0.7,
  maxFaces: 1,
  checkInterval: 500,
  lookingAwayThreshold: 0.3, // 30% offset from center
};

class FaceDetectionService {
  private config: FaceDetectionConfig = DEFAULT_CONFIG;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isRunning: boolean = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private callbacks: Partial<FaceDetectionCallback> = {};

  // Native Face Detection API (Chrome only)
  private nativeDetector: unknown = null;
  private useNativeAPI: boolean = false;

  /**
   * Initialize the face detection service
   */
  initialize(config?: Partial<FaceDetectionConfig>): void {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Try to use native Face Detection API (Chrome 70+)
    if ('FaceDetector' in globalThis) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const FaceDetectorCtor = (
          globalThis as unknown as {
            FaceDetector: new (options: { maxDetectedFaces: number; fastMode: boolean }) => unknown;
          }
        ).FaceDetector;
        this.nativeDetector = new FaceDetectorCtor({
          maxDetectedFaces: this.config.maxFaces + 1, // +1 to detect if there are extra faces
          fastMode: false,
        });
        this.useNativeAPI = true;
      } catch {
        // Native Face Detection API not available, using fallback
        this.useNativeAPI = false;
      }
    }

    // Fallback: Would use TensorFlow.js in production
    // For this demo, we'll simulate face detection
  }

  /**
   * Set the video element to analyze
   */
  setVideoSource(video: HTMLVideoElement): void {
    this.videoElement = video;

    // Create canvas for frame capture
    this.canvasElement = document.createElement('canvas');
    this.ctx = this.canvasElement.getContext('2d');
  }

  /**
   * Set the canvas element for drawing overlays
   */
  setOverlayCanvas(canvas: HTMLCanvasElement): void {
    this.canvasElement = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Subscribe to face detection events
   */
  onDetection(callbacks: Partial<FaceDetectionCallback>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Start face detection
   */
  start(): void {
    if (this.isRunning) return;
    if (!this.videoElement) {
      console.error('No video source set');
      return;
    }

    this.isRunning = true;
    this.detectionInterval = setInterval(() => {
      void this.detectFaces();
    }, this.config.checkInterval);
  }

  /**
   * Stop face detection
   */
  stop(): void {
    this.isRunning = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Perform face detection on current frame
   */
  private async detectFaces(): Promise<FaceDetectionResult | null> {
    if (!this.videoElement || !this.isRunning) return null;

    try {
      let faces: DetectedFace[];

      if (this.useNativeAPI && this.nativeDetector) {
        faces = await this.detectWithNativeAPI();
      } else {
        faces = this.detectSimulated();
      }

      const result: FaceDetectionResult = {
        faces,
        timestamp: Date.now(),
        frameWidth: this.videoElement.videoWidth,
        frameHeight: this.videoElement.videoHeight,
      };

      this.processResult(result);
      return result;
    } catch (error) {
      this.callbacks.onError?.(error as Error);
      return null;
    }
  }

  /**
   * Use native Face Detection API
   */
  private async detectWithNativeAPI(): Promise<DetectedFace[]> {
    if (!this.nativeDetector || !this.videoElement) return [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const detected = (await (
        this.nativeDetector as {
          detect: (source: HTMLVideoElement) => Promise<
            Array<{
              boundingBox: DOMRectReadOnly;
              landmarks?: { type: string; locations: { x: number; y: number }[] }[];
            }>
          >;
        }
      ).detect(this.videoElement)) as Array<{
        boundingBox: DOMRectReadOnly;
        landmarks?: { type: string; locations: { x: number; y: number }[] }[];
      }>;

      return detected.map(
        (face: {
          boundingBox: DOMRectReadOnly;
          landmarks?: { type: string; locations: { x: number; y: number }[] }[];
        }) => ({
          boundingBox: {
            x: face.boundingBox.x,
            y: face.boundingBox.y,
            width: face.boundingBox.width,
            height: face.boundingBox.height,
          },
          confidence: 0.9, // Native API doesn't provide confidence
          landmarks: this.extractLandmarks(face.landmarks),
        })
      );
    } catch (error) {
      console.error('Error detecting faces:', error);
      return [];
    }
  }

  /**
   * Extract landmarks from native API result
   */
  private extractLandmarks(
    landmarks?: { type: string; locations: { x: number; y: number }[] }[]
  ): DetectedFace['landmarks'] {
    if (!landmarks) return undefined;

    const result: DetectedFace['landmarks'] = {};

    for (const landmark of landmarks) {
      if (landmark.locations && landmark.locations.length > 0) {
        const location = landmark.locations[0];
        switch (landmark.type) {
          case 'eye':
            if (result.leftEye === undefined) {
              result.leftEye = location;
            } else {
              result.rightEye = location;
            }
            break;
          case 'nose':
            result.nose = location;
            break;
          case 'mouth':
            result.mouth = location;
            break;
        }
      }
    }

    return result;
  }

  /**
   * Simulated face detection for demo purposes
   * In production, use TensorFlow.js @tensorflow-models/face-landmarks-detection
   */
  private detectSimulated(): DetectedFace[] {
    // Simulate detection with random variations
    const random = Math.random();

    // Most of the time, detect one face in center
    if (random > 0.05) {
      const offsetX = (Math.random() - 0.5) * 0.2; // -10% to +10% offset
      const offsetY = (Math.random() - 0.5) * 0.15;

      return [
        {
          boundingBox: {
            x: 0.3 + offsetX,
            y: 0.2 + offsetY,
            width: 0.4,
            height: 0.5,
          },
          confidence: 0.85 + Math.random() * 0.15,
          landmarks: {
            leftEye: { x: 0.4 + offsetX, y: 0.35 + offsetY },
            rightEye: { x: 0.6 + offsetX, y: 0.35 + offsetY },
            nose: { x: 0.5 + offsetX, y: 0.45 + offsetY },
            mouth: { x: 0.5 + offsetX, y: 0.6 + offsetY },
          },
        },
      ];
    }

    // Occasionally return no face or multiple faces
    if (random < 0.02) {
      // No face
      return [];
    }

    // Multiple faces (rare)
    return [
      {
        boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        confidence: 0.8,
      },
      {
        boundingBox: { x: 0.6, y: 0.25, width: 0.25, height: 0.35 },
        confidence: 0.75,
      },
    ];
  }

  /**
   * Process detection result and trigger callbacks
   */
  private processResult(result: FaceDetectionResult): void {
    const { faces } = result;

    if (faces.length === 0) {
      this.callbacks.onNoFace?.();
      return;
    }

    if (faces.length > this.config.maxFaces) {
      this.callbacks.onMultipleFaces?.(faces.length);
      return;
    }

    // Check if face is centered (not looking away)
    const mainFace = faces[0];
    const centerX = mainFace.boundingBox.x + mainFace.boundingBox.width / 2;
    const centerY = mainFace.boundingBox.y + mainFace.boundingBox.height / 2;

    // Check horizontal offset
    if (Math.abs(centerX - 0.5) > this.config.lookingAwayThreshold) {
      const direction = centerX < 0.5 ? 'left' : 'right';
      this.callbacks.onLookingAway?.(direction);
      return;
    }

    // Check vertical offset
    if (Math.abs(centerY - 0.4) > this.config.lookingAwayThreshold) {
      const direction = centerY < 0.4 ? 'up' : 'down';
      this.callbacks.onLookingAway?.(direction);
      return;
    }

    // Check confidence
    if (mainFace.confidence < this.config.minConfidence) {
      return;
    }

    // All good
    this.callbacks.onFaceDetected?.(faces);
  }

  /**
   * Draw face detection overlay
   */
  drawOverlay(faces: DetectedFace[]): void {
    if (!this.ctx || !this.canvasElement || !this.videoElement) return;

    const { width, height } = this.canvasElement;

    // Clear previous drawings
    this.ctx.clearRect(0, 0, width, height);

    for (const face of faces) {
      const { boundingBox, landmarks } = face;

      // Draw bounding box
      this.ctx.strokeStyle = faces.length === 1 ? '#10b981' : '#ef4444';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        boundingBox.x * width,
        boundingBox.y * height,
        boundingBox.width * width,
        boundingBox.height * height
      );

      // Draw landmarks if available
      if (landmarks) {
        this.ctx.fillStyle = '#6366f1';
        const drawPoint = (point: { x: number; y: number } | undefined) => {
          if (point && this.ctx) {
            this.ctx.beginPath();
            this.ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
            this.ctx.fill();
          }
        };

        drawPoint(landmarks.leftEye);
        drawPoint(landmarks.rightEye);
        drawPoint(landmarks.nose);
        drawPoint(landmarks.mouth);
      }
    }
  }

  /**
   * Get current detection status
   */
  async getStatus(): Promise<FaceDetectionStatus> {
    const result = await this.detectFaces();

    if (!result) return 'error';
    if (result.faces.length === 0) return 'no-face';
    if (result.faces.length > this.config.maxFaces) return 'multiple-faces';

    const mainFace = result.faces[0];
    if (mainFace.confidence < this.config.minConfidence) return 'low-confidence';

    const centerX = mainFace.boundingBox.x + mainFace.boundingBox.width / 2;
    if (Math.abs(centerX - 0.5) > this.config.lookingAwayThreshold) return 'looking-away';

    return 'ok';
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.videoElement = null;
    this.canvasElement = null;
    this.ctx = null;
    this.nativeDetector = null;
    this.callbacks = {};
  }
}

// Singleton instance
export const faceDetectionService = new FaceDetectionService();

// Export for testing
export { FaceDetectionService };

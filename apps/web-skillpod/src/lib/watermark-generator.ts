/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion */
'use client';

/**
 * Watermark Generator Library
 *
 * Generates dynamic watermarks for VDI sessions:
 * - User identification
 * - Timestamp
 * - Session ID
 * - Anti-screenshot patterns
 */

// ============================================================================
// TYPES
// ============================================================================

export type WatermarkPattern = 'tiled' | 'diagonal' | 'corner' | 'center';

export interface WatermarkConfig {
  pattern: WatermarkPattern;
  text: string;
  userId: string;
  sessionId: string;
  fontSize?: number;
  opacity?: number;
  color?: string;
  rotation?: number;
  showTimestamp?: boolean;
  showSessionId?: boolean;
  randomizePosition?: boolean;
}

export interface WatermarkPosition {
  x: number;
  y: number;
  rotation: number;
}

// ============================================================================
// WATERMARK GENERATOR CLASS
// ============================================================================

class WatermarkGenerator {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: WatermarkConfig | null = null;
  private animationFrame: number | null = null;
  private positions: WatermarkPosition[] = [];

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  initialize(canvas: HTMLCanvasElement, config: WatermarkConfig): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;

    // Set canvas size to match parent
    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    // Generate initial positions
    this.generatePositions();

    // Start rendering
    this.render();
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    window.removeEventListener('resize', this.handleResize);
    this.canvas = null;
    this.ctx = null;
    this.config = null;
  }

  updateConfig(config: Partial<WatermarkConfig>): void {
    if (!this.config) return;
    this.config = { ...this.config, ...config };
    this.generatePositions();
    this.render();
  }

  // ==========================================================================
  // CANVAS MANAGEMENT
  // ==========================================================================

  private readonly handleResize = (): void => {
    this.resizeCanvas();
    this.generatePositions();
    this.render();
  };

  private resizeCanvas(): void {
    if (!this.canvas) return;

    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  // ==========================================================================
  // POSITION GENERATION
  // ==========================================================================

  private generatePositions(): void {
    if (!this.canvas || !this.config) return;

    const { pattern, rotation = -30, randomizePosition = false } = this.config;

    this.positions = [];

    switch (pattern) {
      case 'tiled':
        this.generateTiledPositions(randomizePosition);
        break;
      case 'diagonal':
        this.generateDiagonalPositions();
        break;
      case 'corner':
        this.generateCornerPositions();
        break;
      case 'center':
        this.generateCenterPosition();
        break;
    }

    // Add base rotation
    this.positions = this.positions.map((pos) => ({
      ...pos,
      rotation: pos.rotation + rotation,
    }));
  }

  private generateTiledPositions(randomize: boolean): void {
    if (!this.canvas || !this.config) return;

    const { fontSize = 14 } = this.config;
    const spacing = fontSize * 10; // Space between watermarks

    const cols = Math.ceil(this.canvas.width / spacing) + 2;
    const rows = Math.ceil(this.canvas.height / spacing) + 2;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        let x = col * spacing;
        let y = row * spacing;

        // Stagger odd rows
        if (row % 2 === 1) {
          x += spacing / 2;
        }

        // Randomize position for anti-screenshot
        if (randomize) {
          x += (Math.random() - 0.5) * 20;
          y += (Math.random() - 0.5) * 20;
        }

        this.positions.push({
          x,
          y,
          rotation: 0,
        });
      }
    }
  }

  private generateDiagonalPositions(): void {
    if (!this.canvas) return;

    const diagonal = Math.sqrt(Math.pow(this.canvas.width, 2) + Math.pow(this.canvas.height, 2));
    const count = 5; // Number of diagonal watermarks
    const spacing = diagonal / (count + 1);

    for (let i = 1; i <= count; i++) {
      const distance = spacing * i;
      const angle = Math.atan2(this.canvas.height, this.canvas.width);

      this.positions.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotation: -45,
      });
    }
  }

  private generateCornerPositions(): void {
    if (!this.canvas) return;

    const padding = 30;
    const { fontSize = 14 } = this.config!;

    // All four corners
    this.positions = [
      { x: padding, y: padding + fontSize, rotation: 0 },
      { x: this.canvas.width - padding, y: padding + fontSize, rotation: 0 },
      { x: padding, y: this.canvas.height - padding, rotation: 0 },
      { x: this.canvas.width - padding, y: this.canvas.height - padding, rotation: 0 },
    ];
  }

  private generateCenterPosition(): void {
    if (!this.canvas) return;

    this.positions = [
      {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        rotation: 0,
      },
    ];
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  private render(): void {
    if (!this.ctx || !this.canvas || !this.config) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const {
      text,
      userId,
      sessionId,
      fontSize = 14,
      opacity = 0.15,
      color = 'white',
      showTimestamp = true,
      showSessionId = true,
    } = this.config;

    // Build watermark text
    const lines: string[] = [];
    if (text) lines.push(text);
    if (userId) lines.push(userId);
    if (showSessionId && sessionId) lines.push(`Session: ${sessionId.slice(0, 8)}`);
    if (showTimestamp) lines.push(new Date().toLocaleString());

    const fullText = lines.join(' • ');

    // Configure text style
    this.ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = opacity;
    this.ctx.textBaseline = 'middle';

    // Render at each position
    this.positions.forEach((pos) => {
      this.ctx!.save();
      this.ctx!.translate(pos.x, pos.y);
      this.ctx!.rotate((pos.rotation * Math.PI) / 180);

      // Handle text alignment based on pattern
      if (this.config!.pattern === 'corner') {
        const isRight = pos.x > this.canvas!.width / 2;
        this.ctx!.textAlign = isRight ? 'right' : 'left';
      } else {
        this.ctx!.textAlign = 'center';
      }

      this.ctx!.fillText(fullText, 0, 0);
      this.ctx!.restore();
    });

    // Reset alpha
    this.ctx.globalAlpha = 1;
  }

  // ==========================================================================
  // ANIMATION (for anti-screenshot)
  // ==========================================================================

  startAnimation(intervalMs: number = 5000): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= intervalMs) {
        lastTime = currentTime;

        // Regenerate positions with randomization
        if (this.config?.randomizePosition) {
          this.generatePositions();
        }

        // Update timestamp
        this.render();
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // ==========================================================================
  // STATIC WATERMARK GENERATION
  // ==========================================================================

  static generateDataUrl(config: WatermarkConfig): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const {
      text,
      userId,
      sessionId,
      fontSize = 14,
      opacity = 0.15,
      color = 'white',
      rotation = -30,
      showTimestamp = true,
      showSessionId = true,
    } = config;

    // Build watermark text
    const lines: string[] = [];
    if (text) lines.push(text);
    if (userId) lines.push(userId);
    if (showSessionId && sessionId) lines.push(`Session: ${sessionId.slice(0, 8)}`);
    if (showTimestamp) lines.push(new Date().toLocaleString());

    const fullText = lines.join(' • ');

    // Measure text
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const metrics = ctx.measureText(fullText);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.5;

    // Calculate canvas size for rotated text
    const radians = (rotation * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(textWidth * Math.cos(radians)) + Math.abs(textHeight * Math.sin(radians));
    const rotatedHeight =
      Math.abs(textWidth * Math.sin(radians)) + Math.abs(textHeight * Math.cos(radians));

    // Set canvas size with padding
    const padding = fontSize * 5;
    canvas.width = rotatedWidth + padding * 2;
    canvas.height = rotatedHeight + padding * 2;

    // Draw watermark
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.fillText(fullText, 0, 0);
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  // ==========================================================================
  // CSS PATTERN GENERATION
  // ==========================================================================

  static generateCSSPattern(config: WatermarkConfig): string {
    const dataUrl = WatermarkGenerator.generateDataUrl(config);

    return `
      background-image: url("${dataUrl}");
      background-repeat: repeat;
      background-position: center center;
      pointer-events: none;
    `;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const watermarkGenerator = new WatermarkGenerator();

// ============================================================================
// REACT HOOK FOR WATERMARK
// ============================================================================

import { useCallback, useEffect, useRef } from 'react';

export function useWatermark(config: WatermarkConfig | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initialize = useCallback(() => {
    if (!canvasRef.current || !config) return;

    watermarkGenerator.initialize(canvasRef.current, config);

    if (config.randomizePosition) {
      watermarkGenerator.startAnimation(5000);
    }
  }, [config]);

  useEffect(() => {
    initialize();

    return () => {
      watermarkGenerator.destroy();
    };
  }, [initialize]);

  useEffect(() => {
    if (config) {
      watermarkGenerator.updateConfig(config);
    }
  }, [config]);

  return canvasRef;
}

/**
 * @module @skillancer/skillpod-svc/services/watermark/visible-watermark
 * Visible watermark generation service for deterrence and identification
 */

import crypto from 'crypto';

import type { VisibleWatermarkConfig } from '../../repositories/watermark.repository.js';

// =============================================================================
// TYPES
// =============================================================================

export interface WatermarkPayload {
  userId: string;
  userEmail: string;
  sessionId: string;
  tenantId: string;
  podId: string;
  timestamp: Date;
  ipAddress?: string;
  customText?: string;
}

export interface WatermarkOverlayResult {
  css: string;
  html: string;
  text: string;
  hash: string;
}

// Default configuration
const DEFAULT_CONFIG: VisibleWatermarkConfig = {
  pattern: 'TILED',
  content: ['USER_EMAIL', 'TIMESTAMP'],
  opacity: 0.15,
  fontSize: 14,
  fontFamily: 'Arial',
  fontColor: '#000000',
  rotation: -30,
  spacing: 200,
  margin: 20,
  includeCompanyLogo: false,
};

// =============================================================================
// VISIBLE WATERMARK SERVICE
// =============================================================================

export interface VisibleWatermarkService {
  generateOverlay(
    config: Partial<VisibleWatermarkConfig>,
    payload: WatermarkPayload
  ): WatermarkOverlayResult;

  generateCSS(config: Partial<VisibleWatermarkConfig>, payload: WatermarkPayload): string;

  generateHTML(config: Partial<VisibleWatermarkConfig>, payload: WatermarkPayload): string;

  buildWatermarkText(config: VisibleWatermarkConfig, payload: WatermarkPayload): string;

  generateHash(config: VisibleWatermarkConfig, payload: WatermarkPayload): string;
}

export function createVisibleWatermarkService(): VisibleWatermarkService {
  /**
   * Build watermark text from content configuration and payload
   */
  function buildWatermarkText(config: VisibleWatermarkConfig, payload: WatermarkPayload): string {
    const parts: string[] = [];

    for (const contentType of config.content) {
      switch (contentType) {
        case 'USER_EMAIL':
          parts.push(payload.userEmail);
          break;
        case 'SESSION_ID':
          // Show only first 8 chars for readability
          parts.push(`Session: ${payload.sessionId.substring(0, 8)}`);
          break;
        case 'TIMESTAMP':
          parts.push(formatTimestamp(payload.timestamp));
          break;
        case 'CUSTOM_TEXT':
          if (payload.customText) {
            parts.push(payload.customText);
          }
          break;
        case 'IP_ADDRESS':
          if (payload.ipAddress) {
            parts.push(`IP: ${payload.ipAddress}`);
          }
          break;
      }
    }

    return parts.join(' | ');
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Generate CSS for tiled pattern
   */
  function generateTiledCSS(config: VisibleWatermarkConfig, text: string): string {
    // Escape text for CSS content property
    const escapedText = text.replace(/'/g, "\\'").replace(/\n/g, '\\A');

    return `
.skillpod-watermark-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999999;
  overflow: hidden;
  background: transparent;
}

.skillpod-watermark-tiled {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  transform: translate(-50%, -50%) rotate(${config.rotation}deg);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: ${config.spacing}px;
}

.skillpod-watermark-tiled::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent ${config.spacing - 20}px,
    rgba(0, 0, 0, 0.02) ${config.spacing - 20}px,
    rgba(0, 0, 0, 0.02) ${config.spacing}px
  );
}

.skillpod-watermark-text {
  font-size: ${config.fontSize}px;
  font-family: ${config.fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif;
  color: ${config.fontColor};
  opacity: ${config.opacity};
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  pointer-events: none;
  padding: 10px 20px;
}

/* Anti-screenshot measures */
.skillpod-watermark-overlay::after {
  content: '${escapedText}';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(${config.rotation}deg);
  font-size: ${config.fontSize}px;
  font-family: ${config.fontFamily}, sans-serif;
  color: ${config.fontColor};
  opacity: ${config.opacity};
  white-space: nowrap;
  user-select: none;
  animation: watermark-pulse 0.1s infinite;
}

@keyframes watermark-pulse {
  0%, 100% { opacity: ${config.opacity}; }
  50% { opacity: ${config.opacity * 0.95}; }
}
`;
  }

  /**
   * Generate CSS for corner pattern
   */
  function generateCornerCSS(config: VisibleWatermarkConfig, _text: string): string {
    const bgColor = config.backgroundColor || 'transparent';

    return `
.skillpod-watermark-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999999;
}

.skillpod-watermark-corner {
  position: absolute;
  font-size: ${config.fontSize}px;
  font-family: ${config.fontFamily}, sans-serif;
  color: ${config.fontColor};
  opacity: ${config.opacity};
  padding: 8px 12px;
  background-color: ${bgColor};
  border-radius: 4px;
  user-select: none;
}

.skillpod-watermark-corner.top-left {
  top: ${config.margin}px;
  left: ${config.margin}px;
}

.skillpod-watermark-corner.top-right {
  top: ${config.margin}px;
  right: ${config.margin}px;
}

.skillpod-watermark-corner.bottom-left {
  bottom: ${config.margin}px;
  left: ${config.margin}px;
}

.skillpod-watermark-corner.bottom-right {
  bottom: ${config.margin}px;
  right: ${config.margin}px;
}
`;
  }

  /**
   * Generate CSS for center pattern
   */
  function generateCenterCSS(config: VisibleWatermarkConfig, text: string): string {
    const escapedText = text.replace(/'/g, "\\'");

    return `
.skillpod-watermark-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.skillpod-watermark-center {
  font-size: ${config.fontSize * 2}px;
  font-family: ${config.fontFamily}, sans-serif;
  font-weight: bold;
  color: ${config.fontColor};
  opacity: ${config.opacity};
  transform: rotate(${config.rotation}deg);
  user-select: none;
  white-space: nowrap;
}

.skillpod-watermark-center::before {
  content: '${escapedText}';
}
`;
  }

  /**
   * Generate CSS for border pattern
   */
  function generateBorderCSS(config: VisibleWatermarkConfig, _text: string): string {
    return `
.skillpod-watermark-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999999;
}

.skillpod-watermark-border {
  position: absolute;
  font-size: ${config.fontSize}px;
  font-family: ${config.fontFamily}, sans-serif;
  color: ${config.fontColor};
  opacity: ${config.opacity};
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
}

.skillpod-watermark-border.top {
  top: ${config.margin}px;
  left: 0;
  right: 0;
  text-align: center;
}

.skillpod-watermark-border.bottom {
  bottom: ${config.margin}px;
  left: 0;
  right: 0;
  text-align: center;
}

.skillpod-watermark-border.left {
  top: 50%;
  left: ${config.margin}px;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: left center;
}

.skillpod-watermark-border.right {
  top: 50%;
  right: ${config.margin}px;
  transform: translateY(-50%) rotate(90deg);
  transform-origin: right center;
}

.skillpod-watermark-border-text {
  display: inline-block;
  animation: scroll-text 30s linear infinite;
}

@keyframes scroll-text {
  from { transform: translateX(100%); }
  to { transform: translateX(-100%); }
}
`;
  }

  /**
   * Generate CSS based on pattern
   */
  function generateCSS(config: Partial<VisibleWatermarkConfig>, payload: WatermarkPayload): string {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const text = buildWatermarkText(mergedConfig, payload);

    switch (mergedConfig.pattern) {
      case 'TILED':
        return generateTiledCSS(mergedConfig, text);
      case 'CORNER':
        return generateCornerCSS(mergedConfig, text);
      case 'CENTER':
        return generateCenterCSS(mergedConfig, text);
      case 'BORDER':
        return generateBorderCSS(mergedConfig, text);
      default:
        return generateTiledCSS(mergedConfig, text);
    }
  }

  /**
   * Generate HTML for tiled pattern
   */
  function generateTiledHTML(text: string, _config: VisibleWatermarkConfig): string {
    // Generate multiple watermark elements for tiling
    const repetitions = 50; // Enough to cover large screens
    let tiles = '';

    for (let i = 0; i < repetitions; i++) {
      tiles += `<span class="skillpod-watermark-text">${escapeHtml(text)}</span>\n`;
    }

    return `
<div class="skillpod-watermark-overlay" id="skillpod-watermark">
  <div class="skillpod-watermark-tiled">
    ${tiles}
  </div>
</div>
`;
  }

  /**
   * Generate HTML for corner pattern
   */
  function generateCornerHTML(text: string, _config: VisibleWatermarkConfig): string {
    return `
<div class="skillpod-watermark-overlay" id="skillpod-watermark">
  <div class="skillpod-watermark-corner bottom-left">${escapeHtml(text)}</div>
  <div class="skillpod-watermark-corner top-right">${escapeHtml(text)}</div>
</div>
`;
  }

  /**
   * Generate HTML for center pattern
   */
  function generateCenterHTML(text: string, _config: VisibleWatermarkConfig): string {
    return `
<div class="skillpod-watermark-overlay" id="skillpod-watermark">
  <div class="skillpod-watermark-center">${escapeHtml(text)}</div>
</div>
`;
  }

  /**
   * Generate HTML for border pattern
   */
  function generateBorderHTML(text: string, _config: VisibleWatermarkConfig): string {
    return `
<div class="skillpod-watermark-overlay" id="skillpod-watermark">
  <div class="skillpod-watermark-border top">
    <span class="skillpod-watermark-border-text">${escapeHtml(text)}</span>
  </div>
  <div class="skillpod-watermark-border bottom">
    <span class="skillpod-watermark-border-text">${escapeHtml(text)}</span>
  </div>
  <div class="skillpod-watermark-border left">${escapeHtml(text)}</div>
  <div class="skillpod-watermark-border right">${escapeHtml(text)}</div>
</div>
`;
  }

  /**
   * Generate HTML based on pattern
   */
  function generateHTML(
    config: Partial<VisibleWatermarkConfig>,
    payload: WatermarkPayload
  ): string {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const text = buildWatermarkText(mergedConfig, payload);

    switch (mergedConfig.pattern) {
      case 'TILED':
        return generateTiledHTML(text, mergedConfig);
      case 'CORNER':
        return generateCornerHTML(text, mergedConfig);
      case 'CENTER':
        return generateCenterHTML(text, mergedConfig);
      case 'BORDER':
        return generateBorderHTML(text, mergedConfig);
      default:
        return generateTiledHTML(text, mergedConfig);
    }
  }

  /**
   * Generate complete overlay (CSS + HTML)
   */
  function generateOverlay(
    config: Partial<VisibleWatermarkConfig>,
    payload: WatermarkPayload
  ): WatermarkOverlayResult {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const text = buildWatermarkText(mergedConfig, payload);
    const css = generateCSS(config, payload);
    const html = generateHTML(config, payload);
    const hash = generateHash(mergedConfig, payload);

    return { css, html, text, hash };
  }

  /**
   * Generate hash for watermark verification
   */
  function generateHash(config: VisibleWatermarkConfig, payload: WatermarkPayload): string {
    const data = JSON.stringify({
      config: {
        pattern: config.pattern,
        content: config.content,
        opacity: config.opacity,
      },
      payload: {
        userId: payload.userId,
        sessionId: payload.sessionId,
        timestamp: payload.timestamp.getTime(),
      },
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    generateOverlay,
    generateCSS,
    generateHTML,
    buildWatermarkText,
    generateHash,
  };
}

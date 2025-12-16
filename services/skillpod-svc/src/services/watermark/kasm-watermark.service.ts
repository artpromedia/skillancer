/**
 * @module @skillancer/skillpod-svc/services/watermark/kasm-watermark
 * Kasm Workspaces watermark integration service
 * Handles injection of watermark overlays into Kasm streaming sessions
 */

import {
  createVisibleWatermarkService,
  type WatermarkOverlayResult,
} from './visible-watermark.service.js';
import { createWatermarkApplierService, type SessionContext } from './watermark-applier.service.js';

import type { WatermarkRepository } from '../../repositories/watermark.repository.js';
import type { WatermarkConfiguration } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface KasmSession {
  kasmSessionId: string;
  userId: string;
  userEmail: string;
  tenantId: string;
  podId: string;
  ipAddress?: string;
  startTime: Date;
  kasmUrl: string;
  kasmToken?: string;
}

export interface KasmWatermarkConfig {
  enabled: boolean;
  refreshIntervalMs: number;
  configuration?: WatermarkConfiguration;
}

export interface KasmInjectionPayload {
  kasmSessionId: string;
  css: string;
  javascript: string;
  html: string;
  refreshIntervalMs: number;
  hash: string;
}

export interface KasmWebhookPayload {
  event: 'session_start' | 'session_end' | 'screenshot' | 'recording';
  kasmSessionId: string;
  userId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface WebhookResponse {
  success: boolean;
  instanceId?: string;
  overlay?: WatermarkOverlayResult;
  error?: string;
}

// =============================================================================
// KASM WATERMARK SERVICE
// =============================================================================

export interface KasmWatermarkService {
  /**
   * Handle Kasm session start webhook
   */
  handleSessionStart(webhook: KasmWebhookPayload): Promise<WebhookResponse>;

  /**
   * Handle Kasm session end webhook
   */
  handleSessionEnd(webhook: KasmWebhookPayload): WebhookResponse;

  /**
   * Generate injection payload for Kasm session
   */
  generateInjectionPayload(
    session: KasmSession,
    configurationId?: string
  ): Promise<KasmInjectionPayload>;

  /**
   * Generate refreshed watermark overlay
   */
  refreshWatermark(session: KasmSession): Promise<WatermarkOverlayResult>;

  /**
   * Get watermark configuration for Kasm session
   */
  getKasmConfig(tenantId: string): Promise<KasmWatermarkConfig>;

  /**
   * Build JavaScript for watermark injection
   */
  buildInjectionScript(overlay: WatermarkOverlayResult, refreshInterval: number): string;

  /**
   * Build anti-screenshot JavaScript
   */
  buildAntiScreenshotScript(): string;
}

export function createKasmWatermarkService(repository: WatermarkRepository): KasmWatermarkService {
  const _visibleService = createVisibleWatermarkService();
  const applierService = createWatermarkApplierService(repository);

  // Active Kasm sessions cache
  const activeSessions = new Map<
    string,
    {
      instanceId: string;
      lastRefresh: Date;
      configuration: WatermarkConfiguration;
    }
  >();

  /**
   * Convert Kasm session to session context
   */
  function toSessionContext(session: KasmSession): SessionContext {
    return {
      sessionId: session.kasmSessionId,
      userId: session.userId,
      userEmail: session.userEmail,
      tenantId: session.tenantId,
      podId: session.podId,
      ipAddress: session.ipAddress,
    };
  }

  /**
   * Get watermark configuration for Kasm session
   */
  async function getKasmConfig(tenantId: string): Promise<KasmWatermarkConfig> {
    const configuration = await applierService.getConfiguration(tenantId);

    return {
      enabled: configuration.visibleEnabled,
      refreshIntervalMs: 60000, // Refresh every minute by default
      configuration: configuration,
    };
  }

  /**
   * Handle Kasm session start webhook
   */
  async function handleSessionStart(webhook: KasmWebhookPayload): Promise<WebhookResponse> {
    try {
      const tenantId = (webhook.data?.tenantId as string) || '';
      const podId = (webhook.data?.podId as string) || '';
      const userEmail = (webhook.data?.userEmail as string) || '';
      const ipAddress = (webhook.data?.ipAddress as string) || undefined;

      const session: KasmSession = {
        kasmSessionId: webhook.kasmSessionId,
        userId: webhook.userId,
        userEmail,
        tenantId,
        podId,
        ipAddress,
        startTime: new Date(webhook.timestamp),
        kasmUrl: (webhook.data?.kasmUrl as string) || '',
      };

      const sessionContext = toSessionContext(session);
      const { configuration, visibleOverlay, instanceId } =
        await applierService.initializeSession(sessionContext);

      // Cache session
      activeSessions.set(webhook.kasmSessionId, {
        instanceId,
        lastRefresh: new Date(),
        configuration,
      });

      return {
        success: true,
        instanceId,
        overlay: visibleOverlay,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle Kasm session end webhook
   */
  function handleSessionEnd(webhook: KasmWebhookPayload): WebhookResponse {
    try {
      // Remove from cache
      activeSessions.delete(webhook.kasmSessionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate injection payload for Kasm session
   */
  async function generateInjectionPayload(
    session: KasmSession,
    configurationId?: string
  ): Promise<KasmInjectionPayload> {
    const sessionContext = toSessionContext(session);
    const { configuration, visibleOverlay, instanceId } = await applierService.initializeSession(
      sessionContext,
      configurationId
    );

    // Cache session
    activeSessions.set(session.kasmSessionId, {
      instanceId,
      lastRefresh: new Date(),
      configuration,
    });

    const refreshInterval = 60000; // 1 minute
    const javascript = buildInjectionScript(visibleOverlay, refreshInterval);

    return {
      kasmSessionId: session.kasmSessionId,
      css: visibleOverlay.css,
      javascript,
      html: visibleOverlay.html,
      refreshIntervalMs: refreshInterval,
      hash: visibleOverlay.hash,
    };
  }

  /**
   * Generate refreshed watermark overlay
   */
  async function refreshWatermark(session: KasmSession): Promise<WatermarkOverlayResult> {
    const cached = activeSessions.get(session.kasmSessionId);
    const configurationId = cached?.configuration.id;

    const sessionContext = toSessionContext(session);
    const overlay = await applierService.generateOverlay(sessionContext, configurationId);

    // Update cache
    if (cached) {
      cached.lastRefresh = new Date();
    }

    return overlay;
  }

  /**
   * Build JavaScript for watermark injection
   */
  function buildInjectionScript(overlay: WatermarkOverlayResult, refreshInterval: number): string {
    const escapedCss = overlay.css.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const escapedHtml = overlay.html.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `
(function() {
  'use strict';

  // Skillpod Watermark Injection Script
  const WATERMARK_VERSION = '1.0.0';
  const REFRESH_INTERVAL = ${refreshInterval};

  // Prevent removal
  const protectedElements = new Set();

  function injectStyles() {
    let style = document.getElementById('skillpod-watermark-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'skillpod-watermark-styles';
      document.head.appendChild(style);
      protectedElements.add(style);
    }
    style.textContent = \`${escapedCss}\`;
  }

  function injectOverlay() {
    let overlay = document.getElementById('skillpod-watermark');
    if (overlay) {
      overlay.remove();
    }
    
    const container = document.createElement('div');
    container.innerHTML = \`${escapedHtml}\`;
    const newOverlay = container.firstElementChild;
    
    if (newOverlay) {
      document.body.appendChild(newOverlay);
      protectedElements.add(newOverlay);
    }
  }

  // Mutation observer to prevent removal
  function protectWatermark() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (protectedElements.has(node)) {
            // Re-inject removed elements
            setTimeout(() => {
              injectStyles();
              injectOverlay();
            }, 10);
            return;
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Prevent DevTools inspection
  function preventInspection() {
    // Disable right-click on watermark
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#skillpod-watermark')) {
        e.preventDefault();
      }
    });

    // Make watermark elements non-selectable
    const style = document.createElement('style');
    style.textContent = \`
      #skillpod-watermark, #skillpod-watermark * {
        user-select: none !important;
        -webkit-user-select: none !important;
        pointer-events: none !important;
      }
    \`;
    document.head.appendChild(style);
  }

  // Initialize
  function init() {
    injectStyles();
    injectOverlay();
    protectWatermark();
    preventInspection();

    // Periodic refresh to update timestamp
    setInterval(() => {
      injectOverlay();
    }, REFRESH_INTERVAL);

    console.log('[Skillpod] Watermark initialized v' + WATERMARK_VERSION);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
  }

  /**
   * Build anti-screenshot JavaScript
   */
  function buildAntiScreenshotScript(): string {
    return `
(function() {
  'use strict';

  // Anti-screenshot measures
  // Note: These are deterrents, not foolproof solutions

  // Detect PrintScreen key
  document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') {
      // Clear clipboard
      navigator.clipboard.writeText('Screenshot blocked by Skillpod').catch(() => {});
      
      // Show warning
      showWarning('Screenshots are monitored and watermarked');
    }
  });

  // Detect screen capture API
  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    navigator.mediaDevices.getDisplayMedia = async function(...args) {
      console.warn('[Skillpod] Screen capture detected');
      // Allow but log
      return originalGetDisplayMedia.apply(this, args);
    };
  }

  // Flash watermark on screenshot attempts
  function showWarning(message) {
    const warning = document.createElement('div');
    warning.textContent = message;
    warning.style.cssText = \`
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 20px 40px;
      font-size: 18px;
      font-weight: bold;
      border-radius: 8px;
      z-index: 9999999;
      animation: fadeOut 3s forwards;
    \`;
    
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes fadeOut {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; }
      }
    \`;
    
    document.head.appendChild(style);
    document.body.appendChild(warning);
    
    setTimeout(() => {
      warning.remove();
      style.remove();
    }, 3000);
  }

  console.log('[Skillpod] Anti-screenshot protection enabled');
})();
`;
  }

  return {
    handleSessionStart,
    handleSessionEnd,
    generateInjectionPayload,
    refreshWatermark,
    getKasmConfig,
    buildInjectionScript,
    buildAntiScreenshotScript,
  };
}

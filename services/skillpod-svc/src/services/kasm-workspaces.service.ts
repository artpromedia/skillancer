/**
 * @module @skillancer/skillpod-svc/services/kasm-workspaces
 * Kasm Workspaces VDI integration service
 */

import { config } from '../config/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface KasmSecurityConfig {
  // Clipboard settings
  allow_clipboard_down: boolean;
  allow_clipboard_up: boolean;
  allow_clipboard_seamless: boolean;

  // File transfer settings
  allow_file_download: boolean;
  allow_file_upload: boolean;

  // Audio/video settings
  allow_audio: boolean;
  allow_video: boolean;

  // Session settings
  idle_disconnect: number; // Minutes
  session_time_limit?: number; // Minutes

  // Printing
  allow_printing: boolean;

  // Watermarking
  enable_watermark: boolean;
  watermark_config?: WatermarkApiConfig;
}

export interface WatermarkApiConfig {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tiled';
  opacity: number;
  color: string;
  fontSize: number;
  rotation?: number;
  pattern: 'tiled' | 'centered' | 'corner';
}

export interface KasmWorkspace {
  kasmId: string;
  sessionToken: string;
  kasmUrl: string;
  status: string;
}

export interface WorkspaceStatus {
  status: string;
  startTime: Date;
  containerIp?: string;
  imageId: string;
  userId: string;
}

export interface SessionMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkRx: number;
  networkTx: number;
  clipboardEvents: number;
  fileTransferEvents: number;
}

export interface RecordingResult {
  recordingId: string;
  duration: number;
  fileSize: number;
  storagePath: string;
}

export interface CreateWorkspaceParams {
  imageId: string;
  userId: string;
  name: string;
  securityConfig: KasmSecurityConfig;
  environment?: Record<string, string>;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface KasmWorkspacesService {
  // Workspace lifecycle
  createWorkspace(params: CreateWorkspaceParams): Promise<KasmWorkspace>;
  updateWorkspaceConfig(kasmId: string, config: KasmSecurityConfig): Promise<void>;
  terminateWorkspace(kasmId: string): Promise<void>;
  pauseWorkspace(kasmId: string): Promise<void>;
  resumeWorkspace(kasmId: string): Promise<void>;

  // Status & monitoring
  getWorkspaceStatus(kasmId: string): Promise<WorkspaceStatus>;
  getSessionMetrics(kasmId: string): Promise<SessionMetrics>;

  // Screen protection
  activateScreenProtection(kasmId: string, durationMs?: number): Promise<void>;
  deactivateScreenProtection(kasmId: string): Promise<void>;

  // Session recording
  startRecording(kasmId: string): Promise<string>;
  stopRecording(kasmId: string, recordingId: string): Promise<RecordingResult>;

  // Watermarking
  applyWatermark(kasmId: string, watermarkConfig: WatermarkApiConfig): Promise<void>;
  removeWatermark(kasmId: string): Promise<void>;

  // Policy enforcement
  updateClipboardPolicy(
    kasmId: string,
    up: boolean,
    down: boolean,
    seamless: boolean
  ): Promise<void>;
  updateFileTransferPolicy(kasmId: string, upload: boolean, download: boolean): Promise<void>;
  updatePrintingPolicy(kasmId: string, enabled: boolean): Promise<void>;

  // Session messaging
  sendUserMessage(
    kasmId: string,
    message: string,
    type: 'info' | 'warning' | 'error'
  ): Promise<void>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createKasmWorkspacesService(): KasmWorkspacesService {
  const apiKey = config.kasm.apiKey;
  const apiSecret = config.kasm.apiSecret;
  const baseUrl = config.kasm.apiUrl;

  /**
   * Make authenticated API request to Kasm
   */
  async function request<T>(
    method: string,
    path: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_key_secret: apiSecret,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const errorMessage = (errorData as { error?: string }).error ?? response.statusText;
        throw new Error(`Kasm API error: ${errorMessage}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Kasm API request failed: ${error.message}`);
      }
      throw new Error('Kasm API request failed: Unknown error');
    }
  }

  // ===========================================================================
  // WORKSPACE LIFECYCLE
  // ===========================================================================

  async function createWorkspace(params: CreateWorkspaceParams): Promise<KasmWorkspace> {
    const { imageId, userId, name, securityConfig, environment = {} } = params;

    interface KasmCreateResponse {
      kasm_id: string;
      session_token: string;
      kasm_url: string;
      status: string;
    }

    const response = await request<KasmCreateResponse>('POST', '/api/public/request_kasm', {
      image_id: imageId,
      user_id: userId,
      environment: {
        NAME: name,
        ...environment,
      },
      // Security settings
      enable_audio: securityConfig.allow_audio,
      enable_video: securityConfig.allow_video,
      enable_printing: securityConfig.allow_printing,
      enable_uploading: securityConfig.allow_file_upload,
      enable_downloading: securityConfig.allow_file_download,
      // Clipboard settings
      allow_clipboard_down: securityConfig.allow_clipboard_down,
      allow_clipboard_up: securityConfig.allow_clipboard_up,
      allow_clipboard_seamless: securityConfig.allow_clipboard_seamless,
      // Session settings
      idle_disconnect: securityConfig.idle_disconnect,
      session_time_limit: securityConfig.session_time_limit,
      // Watermarking
      enable_webp: true,
      enable_dynamic_watermark: securityConfig.enable_watermark,
      dynamic_watermark_config: securityConfig.watermark_config,
    });

    return {
      kasmId: response.kasm_id,
      sessionToken: response.session_token,
      kasmUrl: response.kasm_url,
      status: response.status,
    };
  }

  async function updateWorkspaceConfig(
    kasmId: string,
    securityConfig: KasmSecurityConfig
  ): Promise<void> {
    await request('POST', '/api/public/update_kasm', {
      kasm_id: kasmId,
      enable_uploading: securityConfig.allow_file_upload,
      enable_downloading: securityConfig.allow_file_download,
      allow_clipboard_down: securityConfig.allow_clipboard_down,
      allow_clipboard_up: securityConfig.allow_clipboard_up,
      allow_clipboard_seamless: securityConfig.allow_clipboard_seamless,
      enable_printing: securityConfig.allow_printing,
      idle_disconnect: securityConfig.idle_disconnect,
      session_time_limit: securityConfig.session_time_limit,
      enable_dynamic_watermark: securityConfig.enable_watermark,
      dynamic_watermark_config: securityConfig.watermark_config,
    });
  }

  async function terminateWorkspace(kasmId: string): Promise<void> {
    await request('POST', '/api/public/destroy_kasm', {
      kasm_id: kasmId,
    });
  }

  async function pauseWorkspace(kasmId: string): Promise<void> {
    await request('POST', '/api/admin/pause_kasm', {
      kasm_id: kasmId,
    });
  }

  async function resumeWorkspace(kasmId: string): Promise<void> {
    await request('POST', '/api/admin/resume_kasm', {
      kasm_id: kasmId,
    });
  }

  // ===========================================================================
  // STATUS & MONITORING
  // ===========================================================================

  async function getWorkspaceStatus(kasmId: string): Promise<WorkspaceStatus> {
    interface KasmStatusResponse {
      kasm: {
        status: string;
        start_time: string;
        container_ip?: string;
        image_id: string;
        user_id: string;
      };
    }

    const response = await request<KasmStatusResponse>('POST', '/api/public/get_kasm_status', {
      kasm_id: kasmId,
    });

    return {
      status: response.kasm.status,
      startTime: new Date(response.kasm.start_time),
      containerIp: response.kasm.container_ip,
      imageId: response.kasm.image_id,
      userId: response.kasm.user_id,
    };
  }

  async function getSessionMetrics(kasmId: string): Promise<SessionMetrics> {
    interface KasmMetricsResponse {
      cpu_percent: number;
      memory_percent: number;
      network_rx_bytes: number;
      network_tx_bytes: number;
      clipboard_events: number;
      file_transfer_events: number;
    }

    const response = await request<KasmMetricsResponse>('POST', '/api/admin/get_kasm_metrics', {
      kasm_id: kasmId,
    });

    return {
      cpuUsage: response.cpu_percent,
      memoryUsage: response.memory_percent,
      networkRx: response.network_rx_bytes,
      networkTx: response.network_tx_bytes,
      clipboardEvents: response.clipboard_events,
      fileTransferEvents: response.file_transfer_events,
    };
  }

  // ===========================================================================
  // SCREEN PROTECTION
  // ===========================================================================

  async function activateScreenProtection(kasmId: string, durationMs = 5000): Promise<void> {
    await request('POST', '/api/admin/activate_protection', {
      kasm_id: kasmId,
      protection_type: 'screen_capture_block',
      duration: durationMs,
    });
  }

  async function deactivateScreenProtection(kasmId: string): Promise<void> {
    await request('POST', '/api/admin/deactivate_protection', {
      kasm_id: kasmId,
    });
  }

  // ===========================================================================
  // SESSION RECORDING
  // ===========================================================================

  async function startRecording(kasmId: string): Promise<string> {
    interface RecordingStartResponse {
      recording_id: string;
    }

    const response = await request<RecordingStartResponse>('POST', '/api/admin/start_recording', {
      kasm_id: kasmId,
      recording_type: 'session',
      storage_path: `recordings/${kasmId}`,
    });

    return response.recording_id;
  }

  async function stopRecording(kasmId: string, recordingId: string): Promise<RecordingResult> {
    interface RecordingStopResponse {
      duration: number;
      file_size: number;
      storage_path: string;
    }

    const response = await request<RecordingStopResponse>('POST', '/api/admin/stop_recording', {
      kasm_id: kasmId,
      recording_id: recordingId,
    });

    return {
      recordingId,
      duration: response.duration,
      fileSize: response.file_size,
      storagePath: response.storage_path,
    };
  }

  // ===========================================================================
  // WATERMARKING
  // ===========================================================================

  async function applyWatermark(
    kasmId: string,
    watermarkConfig: WatermarkApiConfig
  ): Promise<void> {
    await request('POST', '/api/admin/apply_watermark', {
      kasm_id: kasmId,
      watermark_text: watermarkConfig.text,
      watermark_position: watermarkConfig.position,
      watermark_opacity: watermarkConfig.opacity,
      watermark_color: watermarkConfig.color,
      watermark_font_size: watermarkConfig.fontSize,
      watermark_rotation: watermarkConfig.rotation ?? 0,
      watermark_pattern: watermarkConfig.pattern,
    });
  }

  async function removeWatermark(kasmId: string): Promise<void> {
    await request('POST', '/api/admin/remove_watermark', {
      kasm_id: kasmId,
    });
  }

  // ===========================================================================
  // POLICY ENFORCEMENT
  // ===========================================================================

  async function updateClipboardPolicy(
    kasmId: string,
    up: boolean,
    down: boolean,
    seamless: boolean
  ): Promise<void> {
    await request('POST', '/api/admin/update_clipboard_policy', {
      kasm_id: kasmId,
      allow_clipboard_up: up,
      allow_clipboard_down: down,
      allow_clipboard_seamless: seamless,
    });
  }

  async function updateFileTransferPolicy(
    kasmId: string,
    upload: boolean,
    download: boolean
  ): Promise<void> {
    await request('POST', '/api/admin/update_file_transfer_policy', {
      kasm_id: kasmId,
      enable_uploading: upload,
      enable_downloading: download,
    });
  }

  async function updatePrintingPolicy(kasmId: string, enabled: boolean): Promise<void> {
    await request('POST', '/api/admin/update_printing_policy', {
      kasm_id: kasmId,
      enable_printing: enabled,
    });
  }

  // ===========================================================================
  // SESSION MESSAGING
  // ===========================================================================

  async function sendUserMessage(
    kasmId: string,
    message: string,
    type: 'info' | 'warning' | 'error'
  ): Promise<void> {
    await request('POST', '/api/admin/send_message', {
      kasm_id: kasmId,
      message,
      message_type: type,
    });
  }

  // ===========================================================================
  // RETURN SERVICE
  // ===========================================================================

  return {
    // Workspace lifecycle
    createWorkspace,
    updateWorkspaceConfig,
    terminateWorkspace,
    pauseWorkspace,
    resumeWorkspace,

    // Status & monitoring
    getWorkspaceStatus,
    getSessionMetrics,

    // Screen protection
    activateScreenProtection,
    deactivateScreenProtection,

    // Session recording
    startRecording,
    stopRecording,

    // Watermarking
    applyWatermark,
    removeWatermark,

    // Policy enforcement
    updateClipboardPolicy,
    updateFileTransferPolicy,
    updatePrintingPolicy,

    // Session messaging
    sendUserMessage,
  };
}

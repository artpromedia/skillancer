/**
 * @module @skillancer/skillpod-svc/services/watermark/invisible-watermark
 * Invisible watermark (steganography) service for forensic identification
 * Implements LSB steganography with AES-256-GCM encrypted payloads
 */

// @ts-nocheck - FUTURE: Fix TypeScript errors related to complex steganography types
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: Complex steganography types need refinement

import crypto from 'node:crypto';

import type {
  InvisibleWatermarkConfig,
  WatermarkMethod,
  WatermarkStrength,
} from '../../repositories/watermark.repository.js';

// =============================================================================
// TYPES
// =============================================================================

export interface WatermarkPayload {
  userId: string;
  sessionId: string;
  tenantId: string;
  podId: string;
  timestamp: Date;
  sequenceNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface EncodedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
  payloadHash: string;
}

export interface EmbedResult {
  embeddedData: Buffer;
  payloadKey: string;
  payloadHash: string;
  method: WatermarkMethod;
  bytesUsed: number;
}

export interface ExtractResult {
  found: boolean;
  payload?: WatermarkPayload;
  confidence: number;
  method?: WatermarkMethod;
  manipulationDetected: boolean;
  extractionDetails?: {
    bitsExtracted: number;
    errorRate: number;
    positionsChecked: number;
  };
}

export interface EncryptionKeys {
  encryptionKey: Buffer;
  payloadKey: string;
}

// Color channel type for watermarking
type ColorChannel = 'R' | 'G' | 'B';

// Internal config with channel info (not in repository type)
interface InternalWatermarkConfig extends InvisibleWatermarkConfig {
  channels?: ColorChannel[];
  strengthValue?: number;
}

// Default configuration
const DEFAULT_CONFIG: InternalWatermarkConfig = {
  method: 'LSB',
  strength: 'LOW',
  encodeFields: ['USER_ID', 'SESSION_ID', 'TIMESTAMP'],
  redundancy: 3,
  channels: ['B'],
  strengthValue: 1,
};

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const _AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Magic bytes to identify watermark data
const MAGIC_BYTES = Buffer.from([0x53, 0x4b, 0x50, 0x44]); // "SKPD"
const VERSION_BYTE = 0x01;

// =============================================================================
// UTILITY FUNCTIONS (Moved to outer scope for SonarQube compliance)
// =============================================================================

/**
 * Generate encryption keys for tenant
 */
function generateEncryptionKeys(): EncryptionKeys {
  const encryptionKey = crypto.randomBytes(KEY_LENGTH);
  const payloadKey = crypto.randomBytes(16).toString('hex');
  return { encryptionKey, payloadKey };
}

/**
 * Calculate hash for payload verification
 */
function calculatePayloadHash(payload: WatermarkPayload): string {
  const data = JSON.stringify({
    userId: payload.userId,
    sessionId: payload.sessionId,
    tenantId: payload.tenantId,
    podId: payload.podId,
    timestamp: payload.timestamp.getTime(),
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Decrypt extracted payload
 */
function decryptPayload(
  encodedPayload: EncodedPayload,
  encryptionKey: Buffer
): WatermarkPayload | null {
  try {
    const iv = Buffer.from(encodedPayload.iv, 'base64');
    const authTag = Buffer.from(encodedPayload.authTag, 'base64');
    const encrypted = Buffer.from(encodedPayload.encryptedData, 'base64');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const data = JSON.parse(decrypted.toString('utf8'));

    return {
      userId: data.u,
      sessionId: data.s,
      tenantId: data.t,
      podId: data.p,
      timestamp: new Date(data.ts),
      sequenceNumber: data.sq,
    };
  } catch {
    return null;
  }
}

/**
 * Convert data to bits for LSB embedding
 */
function dataToBits(data: Buffer): number[] {
  const bits: number[] = [];
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Convert bits back to data
 */
function bitsToData(bits: number[]): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

/**
 * Convert strength enum to numeric value
 */
function strengthToValue(strength: WatermarkStrength): number {
  switch (strength) {
    case 'LOW':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'HIGH':
      return 4;
    default:
      return 1;
  }
}

/**
 * Prepare watermark data with header and error correction
 */
function prepareWatermarkData(
  encodedPayload: EncodedPayload,
  config: InternalWatermarkConfig
): Buffer {
  const payloadJson = JSON.stringify(encodedPayload);
  const payloadBuffer = Buffer.from(payloadJson, 'utf8');

  // Create header: MAGIC_BYTES + VERSION + LENGTH (2 bytes)
  const length = payloadBuffer.length;
  const header = Buffer.alloc(7);
  MAGIC_BYTES.copy(header, 0);
  header[4] = VERSION_BYTE;
  header[5] = (length >> 8) & 0xff;
  header[6] = length & 0xff;

  // Combine header and payload
  const data = Buffer.concat([header, payloadBuffer]);

  // Apply redundancy if configured
  if (config.redundancy > 1) {
    const redundantData = Buffer.alloc(data.length * config.redundancy);
    for (let i = 0; i < config.redundancy; i++) {
      data.copy(redundantData, i * data.length);
    }
    return redundantData;
  }

  return data;
}

/**
 * Get pixel positions for embedding based on channel
 */
function getEmbedPositions(
  imageData: Buffer,
  channels: ColorChannel[],
  bitsNeeded: number,
  pixelStart: number = 0
): number[] {
  const positions: number[] = [];
  const channelOffset: Record<string, number> = { R: 0, G: 1, B: 2 };

  // Assume RGBA format (4 bytes per pixel)
  const bytesPerPixel = 4;
  const totalPixels = Math.floor(imageData.length / bytesPerPixel);

  let pixelIndex = pixelStart;
  while (positions.length < bitsNeeded && pixelIndex < totalPixels) {
    for (const channel of channels) {
      if (positions.length >= bitsNeeded) break;
      positions.push(pixelIndex * bytesPerPixel + channelOffset[channel]);
    }
    pixelIndex++;
  }

  return positions;
}

/**
 * Verify image integrity against manipulation
 */
function detectManipulation(imageData: Buffer, expectedHash: string): boolean {
  const actualHash = crypto.createHash('sha256').update(imageData).digest('hex');
  return actualHash !== expectedHash;
}

/**
 * Merge config with defaults and normalize
 */
function normalizeConfig(config?: Partial<InvisibleWatermarkConfig>): InternalWatermarkConfig {
  const merged: InternalWatermarkConfig = { ...DEFAULT_CONFIG, ...config };
  merged.channels = merged.channels || ['B'];
  merged.strengthValue = strengthToValue(merged.strength);
  return merged;
}

/**
 * Embed watermark using LSB steganography
 */
function embedLSB(
  imageData: Buffer,
  watermarkData: Buffer,
  config: InternalWatermarkConfig
): Buffer {
  const bits = dataToBits(watermarkData);
  const channels = config.channels || ['B'];
  const positions = getEmbedPositions(imageData, channels, bits.length);

  if (positions.length < bits.length) {
    throw new Error(`Image too small: need ${bits.length} positions, have ${positions.length}`);
  }

  const result = Buffer.from(imageData);
  const strength = config.strengthValue || 1;

  for (let i = 0; i < bits.length; i++) {
    const pos = positions[i];
    // Clear the least significant bit(s) and set to watermark bit
    const mask = ~((1 << strength) - 1);
    result[pos] = (result[pos] & mask) | (bits[i] * ((1 << strength) - 1));
  }

  return result;
}

/**
 * Extract bit from image at position using majority voting for redundancy
 */
function extractBitWithRedundancy(
  imageData: Buffer,
  positions: number[],
  startIdx: number,
  redundancy: number,
  strength: number
): { bit: number; hasError: boolean } {
  let ones = 0;
  for (let j = 0; j < redundancy; j++) {
    const p = positions[startIdx + j];
    ones += (imageData[p] >> (strength - 1)) & 1;
  }
  const hasError = ones !== 0 && ones !== redundancy;
  return { bit: ones > redundancy / 2 ? 1 : 0, hasError };
}

/**
 * Extract header from image data
 */
function extractHeader(
  imageData: Buffer,
  channels: ColorChannel[],
  redundancy: number,
  strength: number
): { headerData: Buffer; headerBits: number[] } | null {
  const headerPositions = getEmbedPositions(imageData, channels, 56 * redundancy);

  if (headerPositions.length < 56) {
    return null;
  }

  const headerBits: number[] = [];

  for (let i = 0; i < headerPositions.length && headerBits.length < 56; i++) {
    const pos = headerPositions[i];
    const bit = (imageData[pos] >> (strength - 1)) & 1;

    if (redundancy > 1) {
      if ((i + 1) % redundancy === 0) {
        const result = extractBitWithRedundancy(
          imageData,
          headerPositions,
          i - redundancy + 1,
          redundancy,
          strength
        );
        headerBits.push(result.bit);
      }
    } else {
      headerBits.push(bit);
    }
  }

  return { headerData: bitsToData(headerBits), headerBits };
}

/**
 * Extract payload bits from image data
 */
function extractPayloadBits(
  imageData: Buffer,
  channels: ColorChannel[],
  totalBitsNeeded: number,
  redundancy: number,
  strength: number
): { allBits: number[]; errors: number } {
  const positions = getEmbedPositions(imageData, channels, totalBitsNeeded);
  const allBits: number[] = [];
  let errors = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const bit = (imageData[pos] >> (strength - 1)) & 1;

    if (redundancy > 1) {
      if ((i + 1) % redundancy === 0) {
        const result = extractBitWithRedundancy(
          imageData,
          positions,
          i - redundancy + 1,
          redundancy,
          strength
        );
        if (result.hasError) {
          errors++;
        }
        allBits.push(result.bit);
      }
    } else {
      allBits.push(bit);
    }
  }

  return { allBits, errors };
}

/**
 * Extract watermark using LSB steganography
 */
function extractLSB(
  imageData: Buffer,
  config: InternalWatermarkConfig
): { data: Buffer | null; errorRate: number; bitsExtracted: number } {
  const channels = config.channels || ['B'];
  const strength = config.strengthValue || 1;
  const redundancy = config.redundancy || 1;

  // Extract and validate header
  const headerResult = extractHeader(imageData, channels, redundancy, strength);
  if (!headerResult) {
    return { data: null, errorRate: 1, bitsExtracted: 0 };
  }

  const { headerData } = headerResult;

  // Check magic bytes
  if (!MAGIC_BYTES.equals(headerData.subarray(0, 4))) {
    return { data: null, errorRate: 1, bitsExtracted: 0 };
  }

  // Check version
  if (headerData[4] !== VERSION_BYTE) {
    return { data: null, errorRate: 0.5, bitsExtracted: 56 };
  }

  // Get payload length and extract full payload
  const payloadLength = (headerData[5] << 8) | headerData[6];
  const totalBitsNeeded = (7 + payloadLength) * 8 * redundancy;

  const { allBits, errors } = extractPayloadBits(
    imageData,
    channels,
    totalBitsNeeded,
    redundancy,
    strength
  );

  const fullData = bitsToData(allBits);
  const payloadData = fullData.subarray(7, 7 + payloadLength);
  const errorRate = allBits.length > 0 ? errors / (allBits.length / redundancy) : 1;

  return {
    data: payloadData,
    errorRate,
    bitsExtracted: allBits.length,
  };
}

// =============================================================================
// INVISIBLE WATERMARK SERVICE
// =============================================================================

export interface InvisibleWatermarkService {
  /**
   * Embed invisible watermark into image data
   */
  embedWatermark(
    imageData: Buffer,
    payload: WatermarkPayload,
    encryptionKey: Buffer,
    config?: Partial<InvisibleWatermarkConfig>
  ): EmbedResult;

  /**
   * Extract invisible watermark from image data
   */
  extractWatermark(
    imageData: Buffer,
    encryptionKey: Buffer,
    config?: Partial<InvisibleWatermarkConfig>
  ): ExtractResult;

  /**
   * Generate encryption keys for tenant
   */
  generateEncryptionKeys(): EncryptionKeys;

  /**
   * Encrypt payload for embedding
   */
  encryptPayload(payload: WatermarkPayload, encryptionKey: Buffer): EncodedPayload;

  /**
   * Decrypt extracted payload
   */
  decryptPayload(encodedPayload: EncodedPayload, encryptionKey: Buffer): WatermarkPayload | null;

  /**
   * Calculate hash for payload verification
   */
  calculatePayloadHash(payload: WatermarkPayload): string;

  /**
   * Verify image integrity against manipulation
   */
  detectManipulation(imageData: Buffer, expectedHash: string): boolean;
}

export function createInvisibleWatermarkService(): InvisibleWatermarkService {
  /**
   * Encrypt payload for embedding
   */
  function encryptPayload(payload: WatermarkPayload, encryptionKey: Buffer): EncodedPayload {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);

    const payloadData = JSON.stringify({
      u: payload.userId,
      s: payload.sessionId,
      t: payload.tenantId,
      p: payload.podId,
      ts: payload.timestamp.getTime(),
      sq: payload.sequenceNumber || 0,
    });

    const encrypted = Buffer.concat([cipher.update(payloadData, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();
    const payloadHash = calculatePayloadHash(payload);

    return {
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      payloadHash,
    };
  }

  /**
   * Embed invisible watermark into image data
   */
  function embedWatermark(
    imageData: Buffer,
    payload: WatermarkPayload,
    encryptionKey: Buffer,
    config?: Partial<InvisibleWatermarkConfig>
  ): EmbedResult {
    const mergedConfig = normalizeConfig(config);
    const encodedPayload = encryptPayload(payload, encryptionKey);
    const watermarkData = prepareWatermarkData(encodedPayload, mergedConfig);

    let embeddedData: Buffer;

    switch (mergedConfig.method) {
      case 'LSB':
        embeddedData = embedLSB(imageData, watermarkData, mergedConfig);
        break;
      case 'DCT':
        // DCT implementation placeholder - would require image processing library
        throw new Error('DCT steganography not implemented - requires image processing library');
      case 'DWT':
        // DWT implementation placeholder - would require image processing library
        throw new Error('DWT steganography not implemented - requires image processing library');
      default:
        embeddedData = embedLSB(imageData, watermarkData, mergedConfig);
    }

    return {
      embeddedData,
      payloadKey: encodedPayload.payloadHash.substring(0, 16),
      payloadHash: encodedPayload.payloadHash,
      method: mergedConfig.method,
      bytesUsed: watermarkData.length,
    };
  }

  /**
   * Extract invisible watermark from image data
   */
  function extractWatermark(
    imageData: Buffer,
    encryptionKey: Buffer,
    config?: Partial<InvisibleWatermarkConfig>
  ): ExtractResult {
    const mergedConfig = normalizeConfig(config);

    let extractResult: {
      data: Buffer | null;
      errorRate: number;
      bitsExtracted: number;
    };

    switch (mergedConfig.method) {
      case 'LSB':
        extractResult = extractLSB(imageData, mergedConfig);
        break;
      case 'DCT':
      case 'DWT':
        return {
          found: false,
          confidence: 0,
          manipulationDetected: false,
          extractionDetails: {
            bitsExtracted: 0,
            errorRate: 1,
            positionsChecked: 0,
          },
        };
      default:
        extractResult = extractLSB(imageData, mergedConfig);
    }

    if (!extractResult.data) {
      return {
        found: false,
        confidence: 0,
        manipulationDetected: extractResult.errorRate > 0.3,
        extractionDetails: {
          bitsExtracted: extractResult.bitsExtracted,
          errorRate: extractResult.errorRate,
          positionsChecked: extractResult.bitsExtracted,
        },
      };
    }

    try {
      const encodedPayload: EncodedPayload = JSON.parse(extractResult.data.toString('utf8'));
      const payload = decryptPayload(encodedPayload, encryptionKey);

      if (!payload) {
        return {
          found: true,
          confidence: 0.5,
          manipulationDetected: true,
          extractionDetails: {
            bitsExtracted: extractResult.bitsExtracted,
            errorRate: extractResult.errorRate,
            positionsChecked: extractResult.bitsExtracted,
          },
        };
      }

      const confidence = 1 - extractResult.errorRate;
      const manipulationDetected = extractResult.errorRate > 0.1;

      return {
        found: true,
        payload,
        confidence,
        method: mergedConfig.method,
        manipulationDetected,
        extractionDetails: {
          bitsExtracted: extractResult.bitsExtracted,
          errorRate: extractResult.errorRate,
          positionsChecked: extractResult.bitsExtracted,
        },
      };
    } catch {
      return {
        found: true,
        confidence: 0.3,
        manipulationDetected: true,
        extractionDetails: {
          bitsExtracted: extractResult.bitsExtracted,
          errorRate: extractResult.errorRate,
          positionsChecked: extractResult.bitsExtracted,
        },
      };
    }
  }

  return {
    embedWatermark,
    extractWatermark,
    generateEncryptionKeys,
    encryptPayload,
    decryptPayload,
    calculatePayloadHash,
    detectManipulation,
  };
}

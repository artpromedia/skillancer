/**
 * @module @skillancer/skillpod-svc/services/watermark/dct-watermark
 * DCT (Discrete Cosine Transform) watermarking implementation
 *
 * Embeds watermark data in the mid-frequency DCT coefficients of image blocks.
 * This approach is robust against JPEG compression and common image manipulations.
 */

import {
  dct2D,
  idct2D,
  extractBlock,
  insertBlock,
  bufferToChannel,
  channelToBuffer,
  padImageData,
  cropImageData,
  MID_FREQ_POSITIONS,
} from './transforms.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DCTConfig {
  blockSize: number; // DCT block size (default: 8)
  strength: number; // Embedding strength (default: 25)
  channel: number; // Color channel (0=R, 1=G, 2=B, default: 2)
  redundancy: number; // Bit repetition for error correction (default: 3)
}

export interface DCTEmbedResult {
  embeddedData: Buffer;
  blocksUsed: number;
  bitsEmbedded: number;
  capacity: number;
}

export interface DCTExtractResult {
  data: Buffer | null;
  confidence: number;
  blocksChecked: number;
  bitsExtracted: number;
  errorRate: number;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_DCT_CONFIG: DCTConfig = {
  blockSize: 8,
  strength: 25,
  channel: 2, // Blue channel
  redundancy: 3,
};

// Magic bytes for DCT watermark
const DCT_MAGIC = Buffer.from([0x44, 0x43, 0x54, 0x57]); // "DCTW"
const DCT_VERSION = 0x01;

// =============================================================================
// DCT WATERMARK EMBEDDING
// =============================================================================

/**
 * Embed watermark using DCT transform
 *
 * The algorithm works by:
 * 1. Dividing the image into 8x8 blocks
 * 2. Applying 2D DCT to each block
 * 3. Modifying mid-frequency coefficients to encode bits
 * 4. Applying inverse DCT to reconstruct the block
 *
 * Mid-frequency coefficients are chosen because they provide:
 * - Better robustness than high-frequency (resist compression)
 * - Less visual distortion than low-frequency
 */
export function embedDCT(
  imageData: Buffer,
  width: number,
  height: number,
  watermarkData: Buffer,
  config: Partial<DCTConfig> = {}
): DCTEmbedResult {
  const cfg = { ...DEFAULT_DCT_CONFIG, ...config };
  const { blockSize, strength, channel, redundancy } = cfg;

  // Extract the channel data as 2D array
  const channelData = bufferToChannel(imageData, width, height, channel);

  // Pad to block-aligned dimensions
  const { padded, originalHeight, originalWidth } = padImageData(channelData, blockSize);
  const paddedHeight = padded.length;
  const paddedWidth = padded[0].length;

  // Calculate capacity
  const numBlocksH = Math.floor(paddedHeight / blockSize);
  const numBlocksW = Math.floor(paddedWidth / blockSize);
  const totalBlocks = numBlocksH * numBlocksW;
  const bitsPerBlock = Math.floor(MID_FREQ_POSITIONS.length / 2); // Use pairs for robustness
  const capacity = Math.floor((totalBlocks * bitsPerBlock) / redundancy);

  // Prepare watermark with header
  const header = Buffer.alloc(7);
  DCT_MAGIC.copy(header, 0);
  header[4] = DCT_VERSION;
  header[5] = (watermarkData.length >> 8) & 0xff;
  header[6] = watermarkData.length & 0xff;
  const fullData = Buffer.concat([header, watermarkData]);

  // Convert to bits with redundancy
  const bits: number[] = [];
  for (const byte of fullData) {
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >> i) & 1;
      for (let r = 0; r < redundancy; r++) {
        bits.push(bit);
      }
    }
  }

  const bitsNeeded = bits.length;
  if (bitsNeeded > capacity * redundancy) {
    throw new Error(
      `Watermark too large: need ${bitsNeeded} bits, capacity is ${capacity * redundancy} bits`
    );
  }

  // Embed bits in DCT blocks
  let bitIndex = 0;
  let blocksUsed = 0;

  for (let blockRow = 0; blockRow < numBlocksH && bitIndex < bitsNeeded; blockRow++) {
    for (let blockCol = 0; blockCol < numBlocksW && bitIndex < bitsNeeded; blockCol++) {
      // Extract block
      const block = extractBlock(padded, blockRow, blockCol, blockSize);

      // Apply DCT
      const dctBlock = dct2D(block);

      // Embed bits in mid-frequency coefficient pairs
      // Using quantization index modulation (QIM)
      for (let p = 0; p < bitsPerBlock && bitIndex < bitsNeeded; p++) {
        const pos = MID_FREQ_POSITIONS[p * 2];
        const bit = bits[bitIndex];

        // Quantize coefficient to embed bit (handle negative values)
        const coeff = dctBlock[pos[0]][pos[1]];
        const sign = coeff >= 0 ? 1 : -1;
        const absCoeff = Math.abs(coeff);
        const quantized = Math.floor(absCoeff / strength);

        // Embed bit in the least significant bit of the quantized value
        const newQuantized = (quantized & ~1) | bit;
        dctBlock[pos[0]][pos[1]] = sign * (newQuantized * strength + strength / 2);

        bitIndex++;
      }

      // Apply inverse DCT
      const reconstructed = idct2D(dctBlock);

      // Insert block back
      insertBlock(padded, reconstructed, blockRow, blockCol, blockSize);
      blocksUsed++;
    }
  }

  // Crop back to original dimensions
  const cropped = cropImageData(padded, originalHeight, originalWidth);

  // Write modified channel back to buffer
  const result = Buffer.from(imageData);
  channelToBuffer(cropped, result, width, height, channel);

  return {
    embeddedData: result,
    blocksUsed,
    bitsEmbedded: bitIndex,
    capacity: capacity * redundancy,
  };
}

/**
 * Extract watermark using DCT transform
 */
export function extractDCT(
  imageData: Buffer,
  width: number,
  height: number,
  config: Partial<DCTConfig> = {}
): DCTExtractResult {
  const cfg = { ...DEFAULT_DCT_CONFIG, ...config };
  const { blockSize, strength, channel, redundancy } = cfg;

  // Extract the channel data as 2D array
  const channelData = bufferToChannel(imageData, width, height, channel);

  // Pad to block-aligned dimensions
  const { padded } = padImageData(channelData, blockSize);
  const paddedHeight = padded.length;
  const paddedWidth = padded[0].length;

  // Calculate dimensions
  const numBlocksH = Math.floor(paddedHeight / blockSize);
  const numBlocksW = Math.floor(paddedWidth / blockSize);
  const bitsPerBlock = Math.floor(MID_FREQ_POSITIONS.length / 2);

  // Extract all bits
  const extractedBits: number[] = [];
  let blocksChecked = 0;

  for (let blockRow = 0; blockRow < numBlocksH; blockRow++) {
    for (let blockCol = 0; blockCol < numBlocksW; blockCol++) {
      // Extract block
      const block = extractBlock(padded, blockRow, blockCol, blockSize);

      // Apply DCT
      const dctBlock = dct2D(block);

      // Extract bits from mid-frequency coefficients
      for (let p = 0; p < bitsPerBlock; p++) {
        const pos = MID_FREQ_POSITIONS[p * 2];
        const coeff = dctBlock[pos[0]][pos[1]];
        const absCoeff = Math.abs(coeff);
        const quantized = Math.floor(absCoeff / strength);
        extractedBits.push(quantized & 1);
      }

      blocksChecked++;
    }
  }

  // Apply majority voting for redundancy
  const votedBits: number[] = [];
  let errors = 0;

  for (let i = 0; i < extractedBits.length; i += redundancy) {
    let ones = 0;
    for (let j = 0; j < redundancy && i + j < extractedBits.length; j++) {
      ones += extractedBits[i + j];
    }
    const bit = ones > redundancy / 2 ? 1 : 0;
    votedBits.push(bit);

    // Check for errors (non-unanimous votes)
    if (ones !== 0 && ones !== redundancy) {
      errors++;
    }
  }

  // Convert bits to bytes
  const bytes: number[] = [];
  for (let i = 0; i < votedBits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < votedBits.length; j++) {
      byte = (byte << 1) | votedBits[i + j];
    }
    bytes.push(byte);
  }

  const extractedData = Buffer.from(bytes);

  // Validate header
  if (extractedData.length < 7) {
    return {
      data: null,
      confidence: 0,
      blocksChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 1,
    };
  }

  // Check magic bytes
  if (!DCT_MAGIC.equals(extractedData.subarray(0, 4))) {
    return {
      data: null,
      confidence: 0,
      blocksChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 1,
    };
  }

  // Check version
  if (extractedData[4] !== DCT_VERSION) {
    return {
      data: null,
      confidence: 0.3,
      blocksChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 0.7,
    };
  }

  // Get payload length
  const payloadLength = (extractedData[5] << 8) | extractedData[6];

  if (payloadLength > extractedData.length - 7) {
    return {
      data: null,
      confidence: 0.5,
      blocksChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 0.5,
    };
  }

  const payload = extractedData.subarray(7, 7 + payloadLength);
  const errorRate = votedBits.length > 0 ? errors / (votedBits.length / redundancy) : 0;
  const confidence = 1 - Math.min(1, errorRate);

  return {
    data: payload,
    confidence,
    blocksChecked,
    bitsExtracted: extractedBits.length,
    errorRate,
  };
}

/**
 * Calculate DCT watermark capacity for an image
 */
export function calculateDCTCapacity(
  width: number,
  height: number,
  config: Partial<DCTConfig> = {}
): { capacityBits: number; capacityBytes: number; blocks: number } {
  const cfg = { ...DEFAULT_DCT_CONFIG, ...config };
  const { blockSize, redundancy } = cfg;

  const numBlocksH = Math.floor(height / blockSize);
  const numBlocksW = Math.floor(width / blockSize);
  const totalBlocks = numBlocksH * numBlocksW;
  const bitsPerBlock = Math.floor(MID_FREQ_POSITIONS.length / 2);
  const capacityBits = Math.floor((totalBlocks * bitsPerBlock) / redundancy);
  const capacityBytes = Math.floor(capacityBits / 8) - 7; // Subtract header size

  return {
    capacityBits,
    capacityBytes: Math.max(0, capacityBytes),
    blocks: totalBlocks,
  };
}

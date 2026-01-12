/**
 * @module @skillancer/skillpod-svc/services/watermark/dwt-watermark
 * DWT (Discrete Wavelet Transform) watermarking implementation
 *
 * Embeds watermark data in the wavelet coefficients of the image.
 * Uses Haar wavelet decomposition for robustness and simplicity.
 * The watermark is embedded in the LL (approximation) sub-band for maximum robustness,
 * with additional bits in HH (diagonal detail) for capacity.
 */

import {
  dwtMultiLevel,
  idwtMultiLevel,
  bufferToChannel,
  channelToBuffer,
  padImageData,
  cropImageData,
  type WaveletCoefficients,
} from './transforms.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DWTConfig {
  levels: number; // Decomposition levels (default: 2)
  strength: number; // Embedding strength (default: 10)
  channel: number; // Color channel (0=R, 1=G, 2=B, default: 2)
  redundancy: number; // Bit repetition for error correction (default: 3)
  useHH: boolean; // Also embed in HH sub-band (default: false)
}

export interface DWTEmbedResult {
  embeddedData: Buffer;
  coefficientsModified: number;
  bitsEmbedded: number;
  capacity: number;
}

export interface DWTExtractResult {
  data: Buffer | null;
  confidence: number;
  coefficientsChecked: number;
  bitsExtracted: number;
  errorRate: number;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_DWT_CONFIG: DWTConfig = {
  levels: 2,
  strength: 10,
  channel: 2, // Blue channel
  redundancy: 3,
  useHH: false,
};

// Magic bytes for DWT watermark
const DWT_MAGIC = Buffer.from([0x44, 0x57, 0x54, 0x57]); // "DWTW"
const DWT_VERSION = 0x01;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Embed a single bit in a coefficient using quantization
 */
function embedBitInCoefficient(
  coeff: number,
  bit: number,
  strength: number
): number {
  // Use spread spectrum approach
  const sign = coeff >= 0 ? 1 : -1;
  const absCoeff = Math.abs(coeff);

  // Quantization index modulation
  const quantized = Math.floor(absCoeff / strength);
  const newQuantized = (quantized & ~1) | bit;

  // Add offset to center the quantized value
  return sign * (newQuantized * strength + strength / 2);
}

/**
 * Extract a bit from a coefficient
 */
function extractBitFromCoefficient(coeff: number, strength: number): number {
  const absCoeff = Math.abs(coeff);
  const quantized = Math.floor(absCoeff / strength);
  return quantized & 1;
}

/**
 * Get positions in LL sub-band for embedding
 * Avoids corners and edges for better robustness
 */
function getLLPositions(
  height: number,
  width: number,
  margin: number = 2
): [number, number][] {
  const positions: [number, number][] = [];

  for (let i = margin; i < height - margin; i++) {
    for (let j = margin; j < width - margin; j++) {
      positions.push([i, j]);
    }
  }

  return positions;
}

/**
 * Get positions in HH sub-band for additional capacity
 */
function getHHPositions(
  coeffs: WaveletCoefficients,
  count: number
): [number, number][] {
  const positions: [number, number][] = [];
  const { HH } = coeffs;
  const height = HH.length;
  const width = HH[0].length;

  // Select positions with significant energy (more robust)
  const positionsWithEnergy: { pos: [number, number]; energy: number }[] = [];

  for (let i = 1; i < height - 1; i++) {
    for (let j = 1; j < width - 1; j++) {
      const energy = Math.abs(HH[i][j]);
      positionsWithEnergy.push({ pos: [i, j], energy });
    }
  }

  // Sort by energy and take top positions
  positionsWithEnergy.sort((a, b) => b.energy - a.energy);

  for (let i = 0; i < Math.min(count, positionsWithEnergy.length); i++) {
    positions.push(positionsWithEnergy[i].pos);
  }

  return positions;
}

// =============================================================================
// DWT WATERMARK EMBEDDING
// =============================================================================

/**
 * Embed watermark using DWT transform
 *
 * The algorithm works by:
 * 1. Applying multi-level DWT decomposition
 * 2. Embedding bits in the LL (approximation) sub-band at the deepest level
 * 3. Optionally embedding additional bits in HH (diagonal detail) sub-bands
 * 4. Reconstructing the image using IDWT
 *
 * LL sub-band is chosen for embedding because:
 * - Contains most of the image energy
 * - More robust against compression and filtering
 * - Less visible distortion due to smoothing effect
 */
export function embedDWT(
  imageData: Buffer,
  width: number,
  height: number,
  watermarkData: Buffer,
  config: Partial<DWTConfig> = {}
): DWTEmbedResult {
  const cfg = { ...DEFAULT_DWT_CONFIG, ...config };
  const { levels, strength, channel, redundancy, useHH } = cfg;

  // Ensure dimensions are divisible by 2^levels
  const blockSize = Math.pow(2, levels);

  // Extract the channel data as 2D array
  const channelData = bufferToChannel(imageData, width, height, channel);

  // Pad to block-aligned dimensions
  const { padded, originalHeight, originalWidth } = padImageData(
    channelData,
    blockSize
  );

  // Apply multi-level DWT
  const { coefficients } = dwtMultiLevel(padded, levels);

  // Get the deepest LL sub-band
  const deepestCoeffs = coefficients[coefficients.length - 1];
  const llPositions = getLLPositions(
    deepestCoeffs.LL.length,
    deepestCoeffs.LL[0].length
  );

  // Prepare watermark with header
  const header = Buffer.alloc(7);
  DWT_MAGIC.copy(header, 0);
  header[4] = DWT_VERSION;
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

  // Calculate capacity
  let llCapacity = llPositions.length;
  let hhCapacity = 0;

  if (useHH) {
    // Add HH capacity from all levels
    for (const coeff of coefficients) {
      hhCapacity += (coeff.HH.length - 2) * (coeff.HH[0].length - 2);
    }
  }

  const totalCapacity = llCapacity + hhCapacity;
  const bitsNeeded = bits.length;

  if (bitsNeeded > totalCapacity) {
    throw new Error(
      `Watermark too large: need ${bitsNeeded} bits, capacity is ${totalCapacity} bits`
    );
  }

  // Embed bits in LL sub-band
  let bitIndex = 0;
  let coeffsModified = 0;

  for (let i = 0; i < llPositions.length && bitIndex < bitsNeeded; i++) {
    const [row, col] = llPositions[i];
    const bit = bits[bitIndex];
    deepestCoeffs.LL[row][col] = embedBitInCoefficient(
      deepestCoeffs.LL[row][col],
      bit,
      strength
    );
    bitIndex++;
    coeffsModified++;
  }

  // Optionally embed remaining bits in HH sub-bands
  if (useHH && bitIndex < bitsNeeded) {
    for (const coeff of coefficients) {
      const hhPositions = getHHPositions(coeff, bitsNeeded - bitIndex);

      for (const [row, col] of hhPositions) {
        if (bitIndex >= bitsNeeded) break;
        const bit = bits[bitIndex];
        coeff.HH[row][col] = embedBitInCoefficient(
          coeff.HH[row][col],
          bit,
          strength * 0.5 // Lower strength for HH to reduce artifacts
        );
        bitIndex++;
        coeffsModified++;
      }
    }
  }

  // Reconstruct image using IDWT
  const reconstructed = idwtMultiLevel(coefficients, deepestCoeffs.LL);

  // Crop back to original dimensions
  const cropped = cropImageData(reconstructed, originalHeight, originalWidth);

  // Write modified channel back to buffer
  const result = Buffer.from(imageData);
  channelToBuffer(cropped, result, width, height, channel);

  return {
    embeddedData: result,
    coefficientsModified: coeffsModified,
    bitsEmbedded: bitIndex,
    capacity: totalCapacity,
  };
}

/**
 * Extract watermark using DWT transform
 */
export function extractDWT(
  imageData: Buffer,
  width: number,
  height: number,
  config: Partial<DWTConfig> = {}
): DWTExtractResult {
  const cfg = { ...DEFAULT_DWT_CONFIG, ...config };
  const { levels, strength, channel, redundancy, useHH } = cfg;

  // Ensure dimensions are divisible by 2^levels
  const blockSize = Math.pow(2, levels);

  // Extract the channel data as 2D array
  const channelData = bufferToChannel(imageData, width, height, channel);

  // Pad to block-aligned dimensions
  const { padded } = padImageData(channelData, blockSize);

  // Apply multi-level DWT
  const { coefficients } = dwtMultiLevel(padded, levels);

  // Get the deepest LL sub-band
  const deepestCoeffs = coefficients[coefficients.length - 1];
  const llPositions = getLLPositions(
    deepestCoeffs.LL.length,
    deepestCoeffs.LL[0].length
  );

  // Extract bits from LL sub-band
  const extractedBits: number[] = [];
  let coeffsChecked = 0;

  for (const [row, col] of llPositions) {
    const bit = extractBitFromCoefficient(deepestCoeffs.LL[row][col], strength);
    extractedBits.push(bit);
    coeffsChecked++;
  }

  // Optionally extract from HH sub-bands
  if (useHH) {
    for (const coeff of coefficients) {
      const hhPositions = getHHPositions(coeff, 1000); // Extract up to 1000 bits per level

      for (const [row, col] of hhPositions) {
        const bit = extractBitFromCoefficient(coeff.HH[row][col], strength * 0.5);
        extractedBits.push(bit);
        coeffsChecked++;
      }
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
      coefficientsChecked: coeffsChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 1,
    };
  }

  // Check magic bytes
  if (!DWT_MAGIC.equals(extractedData.subarray(0, 4))) {
    return {
      data: null,
      confidence: 0,
      coefficientsChecked: coeffsChecked,
      bitsExtracted: extractedBits.length,
      errorRate: 1,
    };
  }

  // Check version
  if (extractedData[4] !== DWT_VERSION) {
    return {
      data: null,
      confidence: 0.3,
      coefficientsChecked: coeffsChecked,
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
      coefficientsChecked: coeffsChecked,
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
    coefficientsChecked: coeffsChecked,
    bitsExtracted: extractedBits.length,
    errorRate,
  };
}

/**
 * Calculate DWT watermark capacity for an image
 */
export function calculateDWTCapacity(
  width: number,
  height: number,
  config: Partial<DWTConfig> = {}
): { capacityBits: number; capacityBytes: number; levels: number } {
  const cfg = { ...DEFAULT_DWT_CONFIG, ...config };
  const { levels, redundancy, useHH } = cfg;

  const blockSize = Math.pow(2, levels);
  const paddedHeight = Math.ceil(height / blockSize) * blockSize;
  const paddedWidth = Math.ceil(width / blockSize) * blockSize;

  // Calculate LL sub-band size at deepest level
  const llHeight = Math.floor(paddedHeight / blockSize);
  const llWidth = Math.floor(paddedWidth / blockSize);

  // Account for margin
  const margin = 2;
  let llCapacity = Math.max(0, (llHeight - 2 * margin) * (llWidth - 2 * margin));

  let hhCapacity = 0;
  if (useHH) {
    let h = paddedHeight;
    let w = paddedWidth;
    for (let l = 0; l < levels; l++) {
      h = Math.floor(h / 2);
      w = Math.floor(w / 2);
      hhCapacity += Math.max(0, (h - 2) * (w - 2));
    }
  }

  const capacityBits = Math.floor((llCapacity + hhCapacity) / redundancy);
  const capacityBytes = Math.floor(capacityBits / 8) - 7; // Subtract header size

  return {
    capacityBits,
    capacityBytes: Math.max(0, capacityBytes),
    levels,
  };
}

/**
 * Analyze image for optimal DWT parameters
 */
export function analyzeDWTParameters(
  width: number,
  height: number
): { recommendedLevels: number; recommendedStrength: number } {
  // Determine optimal levels based on image size
  const minDimension = Math.min(width, height);
  let recommendedLevels = 2;

  if (minDimension >= 1024) {
    recommendedLevels = 3;
  } else if (minDimension >= 512) {
    recommendedLevels = 2;
  } else if (minDimension >= 256) {
    recommendedLevels = 2;
  } else {
    recommendedLevels = 1;
  }

  // Strength based on expected noise level
  const recommendedStrength = 10;

  return { recommendedLevels, recommendedStrength };
}

/**
 * @module @skillancer/skillpod-svc/services/watermark/transforms
 * DCT (Discrete Cosine Transform) and DWT (Discrete Wavelet Transform) implementations
 * for robust invisible watermarking
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TransformConfig {
  blockSize?: number; // For DCT (default: 8)
  waveletLevel?: number; // For DWT decomposition level (default: 2)
  strength?: number; // Embedding strength (default: 25)
  channel?: number; // Color channel to use (0=R, 1=G, 2=B, default: 2 for Blue)
}

export interface TransformResult {
  data: Float64Array | number[][];
  width: number;
  height: number;
  originalDimensions?: { width: number; height: number };
}

export interface WaveletCoefficients {
  LL: number[][]; // Low-Low (approximation)
  LH: number[][]; // Low-High (horizontal detail)
  HL: number[][]; // High-Low (vertical detail)
  HH: number[][]; // High-High (diagonal detail)
  width: number;
  height: number;
}

// =============================================================================
// DCT (DISCRETE COSINE TRANSFORM) IMPLEMENTATION
// =============================================================================

/**
 * Pre-computed cosine values for 8x8 DCT (standard JPEG block size)
 */
const DCT_BLOCK_SIZE = 8;
const PI = Math.PI;

// Cache for cosine values
const cosineCache = new Map<string, number>();

function getCosine(n: number, k: number, N: number): number {
  const key = `${n}-${k}-${N}`;
  if (!cosineCache.has(key)) {
    cosineCache.set(key, Math.cos((PI * (2 * n + 1) * k) / (2 * N)));
  }
  return cosineCache.get(key)!;
}

/**
 * Alpha coefficient for DCT
 */
function alpha(k: number, N: number): number {
  return k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
}

/**
 * 1D DCT-II (forward transform)
 */
export function dct1D(input: number[]): number[] {
  const N = input.length;
  const output: number[] = new Array(N);

  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * getCosine(n, k, N);
    }
    output[k] = alpha(k, N) * sum;
  }

  return output;
}

/**
 * 1D IDCT (inverse transform)
 */
export function idct1D(input: number[]): number[] {
  const N = input.length;
  const output: number[] = new Array(N);

  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < N; k++) {
      sum += alpha(k, N) * input[k] * getCosine(n, k, N);
    }
    output[n] = sum;
  }

  return output;
}

/**
 * 2D DCT on a block
 */
export function dct2D(block: number[][]): number[][] {
  const rows = block.length;
  const cols = block[0].length;

  // Apply DCT to rows
  const rowTransformed: number[][] = [];
  for (let i = 0; i < rows; i++) {
    rowTransformed.push(dct1D(block[i]));
  }

  // Apply DCT to columns
  const result: number[][] = Array.from({ length: rows }, () => new Array(cols));
  for (let j = 0; j < cols; j++) {
    const col: number[] = [];
    for (let i = 0; i < rows; i++) {
      col.push(rowTransformed[i][j]);
    }
    const transformed = dct1D(col);
    for (let i = 0; i < rows; i++) {
      result[i][j] = transformed[i];
    }
  }

  return result;
}

/**
 * 2D IDCT on a block
 */
export function idct2D(block: number[][]): number[][] {
  const rows = block.length;
  const cols = block[0].length;

  // Apply IDCT to columns
  const colTransformed: number[][] = Array.from({ length: rows }, () => new Array(cols));
  for (let j = 0; j < cols; j++) {
    const col: number[] = [];
    for (let i = 0; i < rows; i++) {
      col.push(block[i][j]);
    }
    const transformed = idct1D(col);
    for (let i = 0; i < rows; i++) {
      colTransformed[i][j] = transformed[i];
    }
  }

  // Apply IDCT to rows
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    result.push(idct1D(colTransformed[i]));
  }

  return result;
}

/**
 * Extract 8x8 block from image data at position (blockRow, blockCol)
 */
export function extractBlock(
  imageData: number[][],
  blockRow: number,
  blockCol: number,
  blockSize: number = DCT_BLOCK_SIZE
): number[][] {
  const block: number[][] = [];
  for (let i = 0; i < blockSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < blockSize; j++) {
      const y = blockRow * blockSize + i;
      const x = blockCol * blockSize + j;
      if (y < imageData.length && x < imageData[0].length) {
        row.push(imageData[y][x]);
      } else {
        row.push(0);
      }
    }
    block.push(row);
  }
  return block;
}

/**
 * Insert block back into image data
 */
export function insertBlock(
  imageData: number[][],
  block: number[][],
  blockRow: number,
  blockCol: number,
  blockSize: number = DCT_BLOCK_SIZE
): void {
  for (let i = 0; i < blockSize; i++) {
    for (let j = 0; j < blockSize; j++) {
      const y = blockRow * blockSize + i;
      const x = blockCol * blockSize + j;
      if (y < imageData.length && x < imageData[0].length) {
        // Clamp values to valid range [0, 255]
        imageData[y][x] = Math.max(0, Math.min(255, Math.round(block[i][j])));
      }
    }
  }
}

/**
 * Mid-frequency DCT coefficient positions for watermark embedding
 * These positions are more robust against compression and noise
 */
export const MID_FREQ_POSITIONS: [number, number][] = [
  [1, 2], [2, 1], [2, 2], [1, 3], [3, 1],
  [2, 3], [3, 2], [3, 3], [1, 4], [4, 1],
  [2, 4], [4, 2], [3, 4], [4, 3], [4, 4],
];

// =============================================================================
// DWT (DISCRETE WAVELET TRANSFORM) IMPLEMENTATION
// =============================================================================

/**
 * Haar wavelet low-pass filter coefficients
 */
const HAAR_LOW = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];
const HAAR_HIGH = [1 / Math.sqrt(2), -1 / Math.sqrt(2)];

/**
 * 1D Haar wavelet transform
 */
export function haar1D(input: number[]): { low: number[]; high: number[] } {
  const n = input.length;
  const halfN = Math.floor(n / 2);
  const low: number[] = new Array(halfN);
  const high: number[] = new Array(halfN);

  for (let i = 0; i < halfN; i++) {
    const idx = i * 2;
    low[i] = HAAR_LOW[0] * input[idx] + HAAR_LOW[1] * input[idx + 1];
    high[i] = HAAR_HIGH[0] * input[idx] + HAAR_HIGH[1] * input[idx + 1];
  }

  return { low, high };
}

/**
 * 1D Inverse Haar wavelet transform
 */
export function ihaar1D(low: number[], high: number[]): number[] {
  const n = low.length * 2;
  const output: number[] = new Array(n);

  for (let i = 0; i < low.length; i++) {
    const idx = i * 2;
    // Inverse transform: reconstruct two values from low and high coefficients
    output[idx] = HAAR_LOW[0] * low[i] + HAAR_HIGH[0] * high[i];
    output[idx + 1] = HAAR_LOW[1] * low[i] + HAAR_HIGH[1] * high[i];
  }

  return output;
}

/**
 * 2D Haar wavelet decomposition (single level)
 */
export function dwt2D(imageData: number[][]): WaveletCoefficients {
  const rows = imageData.length;
  const cols = imageData[0].length;
  const halfRows = Math.floor(rows / 2);
  const halfCols = Math.floor(cols / 2);

  // Transform rows first
  const rowTransformed: { low: number[][]; high: number[][] } = {
    low: [],
    high: [],
  };

  for (let i = 0; i < rows; i++) {
    const { low, high } = haar1D(imageData[i]);
    rowTransformed.low.push(low);
    rowTransformed.high.push(high);
  }

  // Initialize output arrays
  const LL: number[][] = Array.from({ length: halfRows }, () => new Array(halfCols));
  const LH: number[][] = Array.from({ length: halfRows }, () => new Array(halfCols));
  const HL: number[][] = Array.from({ length: halfRows }, () => new Array(halfCols));
  const HH: number[][] = Array.from({ length: halfRows }, () => new Array(halfCols));

  // Transform columns of low-pass filtered image
  for (let j = 0; j < halfCols; j++) {
    const lowCol: number[] = [];
    const highCol: number[] = [];
    for (let i = 0; i < rows; i++) {
      lowCol.push(rowTransformed.low[i][j]);
      highCol.push(rowTransformed.high[i][j]);
    }

    const { low: llCol, high: lhCol } = haar1D(lowCol);
    const { low: hlCol, high: hhCol } = haar1D(highCol);

    for (let i = 0; i < halfRows; i++) {
      LL[i][j] = llCol[i];
      LH[i][j] = lhCol[i];
      HL[i][j] = hlCol[i];
      HH[i][j] = hhCol[i];
    }
  }

  return { LL, LH, HL, HH, width: halfCols, height: halfRows };
}

/**
 * 2D Inverse Haar wavelet reconstruction
 */
export function idwt2D(coeffs: WaveletCoefficients): number[][] {
  const { LL, LH, HL, HH } = coeffs;
  const halfRows = LL.length;
  const halfCols = LL[0].length;
  const rows = halfRows * 2;
  const cols = halfCols * 2;

  // Reconstruct columns
  const rowLow: number[][] = Array.from({ length: rows }, () => new Array(halfCols));
  const rowHigh: number[][] = Array.from({ length: rows }, () => new Array(halfCols));

  for (let j = 0; j < halfCols; j++) {
    const llCol: number[] = [];
    const lhCol: number[] = [];
    const hlCol: number[] = [];
    const hhCol: number[] = [];

    for (let i = 0; i < halfRows; i++) {
      llCol.push(LL[i][j]);
      lhCol.push(LH[i][j]);
      hlCol.push(HL[i][j]);
      hhCol.push(HH[i][j]);
    }

    const lowReconstructed = ihaar1D(llCol, lhCol);
    const highReconstructed = ihaar1D(hlCol, hhCol);

    for (let i = 0; i < rows; i++) {
      rowLow[i][j] = lowReconstructed[i];
      rowHigh[i][j] = highReconstructed[i];
    }
  }

  // Reconstruct rows
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const reconstructed = ihaar1D(rowLow[i], rowHigh[i]);
    result.push(reconstructed);
  }

  return result;
}

/**
 * Multi-level DWT decomposition
 */
export function dwtMultiLevel(
  imageData: number[][],
  levels: number = 2
): { coefficients: WaveletCoefficients[]; originalSize: { rows: number; cols: number } } {
  const coefficients: WaveletCoefficients[] = [];
  let currentData = imageData;

  for (let level = 0; level < levels; level++) {
    const dwt = dwt2D(currentData);
    coefficients.push(dwt);
    currentData = dwt.LL;
  }

  return { coefficients, originalSize: { rows: imageData.length, cols: imageData[0].length } };
}

/**
 * Multi-level IDWT reconstruction
 */
export function idwtMultiLevel(
  coefficients: WaveletCoefficients[],
  modifiedLL: number[][]
): number[][] {
  let currentLL = modifiedLL;

  // Reconstruct from deepest level to surface
  for (let level = coefficients.length - 1; level >= 0; level--) {
    const coeff = coefficients[level];
    const reconstructedCoeffs: WaveletCoefficients = {
      LL: currentLL,
      LH: coeff.LH,
      HL: coeff.HL,
      HH: coeff.HH,
      width: coeff.width,
      height: coeff.height,
    };
    currentLL = idwt2D(reconstructedCoeffs);
  }

  return currentLL;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert raw RGBA buffer to 2D array for single channel
 */
export function bufferToChannel(
  buffer: Buffer,
  width: number,
  height: number,
  channel: number = 2 // Default to Blue channel
): number[][] {
  const result: number[][] = [];
  const bytesPerPixel = 4; // RGBA

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * bytesPerPixel + channel;
      row.push(buffer[idx]);
    }
    result.push(row);
  }

  return result;
}

/**
 * Write channel data back to RGBA buffer
 */
export function channelToBuffer(
  channelData: number[][],
  buffer: Buffer,
  width: number,
  height: number,
  channel: number = 2
): void {
  const bytesPerPixel = 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * bytesPerPixel + channel;
      buffer[idx] = Math.max(0, Math.min(255, Math.round(channelData[y][x])));
    }
  }
}

/**
 * Convert bits to numeric value for embedding
 */
export function bitsToValue(bits: number[], offset: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count && offset + i < bits.length; i++) {
    value = (value << 1) | bits[offset + i];
  }
  return value;
}

/**
 * Extract bits from a value
 */
export function valueToBits(value: number, count: number): number[] {
  const bits: number[] = [];
  for (let i = count - 1; i >= 0; i--) {
    bits.push((value >> i) & 1);
  }
  return bits;
}

/**
 * Calculate PSNR (Peak Signal-to-Noise Ratio) between original and watermarked images
 */
export function calculatePSNR(
  original: number[][],
  watermarked: number[][]
): number {
  let mse = 0;
  let count = 0;

  for (let i = 0; i < original.length; i++) {
    for (let j = 0; j < original[0].length; j++) {
      const diff = original[i][j] - watermarked[i][j];
      mse += diff * diff;
      count++;
    }
  }

  mse /= count;

  if (mse === 0) return Infinity;

  const maxPixelValue = 255;
  return 10 * Math.log10((maxPixelValue * maxPixelValue) / mse);
}

/**
 * Pad image dimensions to be divisible by given block size
 */
export function padImageData(
  imageData: number[][],
  blockSize: number
): { padded: number[][]; originalHeight: number; originalWidth: number } {
  const originalHeight = imageData.length;
  const originalWidth = imageData[0].length;

  const newHeight = Math.ceil(originalHeight / blockSize) * blockSize;
  const newWidth = Math.ceil(originalWidth / blockSize) * blockSize;

  const padded: number[][] = Array.from({ length: newHeight }, (_, i) =>
    Array.from({ length: newWidth }, (_, j) => {
      if (i < originalHeight && j < originalWidth) {
        return imageData[i][j];
      }
      // Mirror padding for edge pixels
      const srcI = i < originalHeight ? i : 2 * originalHeight - i - 2;
      const srcJ = j < originalWidth ? j : 2 * originalWidth - j - 2;
      if (srcI >= 0 && srcI < originalHeight && srcJ >= 0 && srcJ < originalWidth) {
        return imageData[srcI][srcJ];
      }
      return 128; // Neutral gray fallback
    })
  );

  return { padded, originalHeight, originalWidth };
}

/**
 * Crop image data back to original dimensions
 */
export function cropImageData(
  imageData: number[][],
  originalHeight: number,
  originalWidth: number
): number[][] {
  return imageData.slice(0, originalHeight).map(row => row.slice(0, originalWidth));
}

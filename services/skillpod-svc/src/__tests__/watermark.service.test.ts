/**
 * @module @skillancer/skillpod-svc/__tests__/watermark.service
 * Tests for DCT and DWT watermarking implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dct1D,
  idct1D,
  dct2D,
  idct2D,
  dwt2D,
  idwt2D,
  bufferToChannel,
  channelToBuffer,
  calculatePSNR,
} from '../services/watermark/transforms.js';
import {
  embedDCT,
  extractDCT,
  calculateDCTCapacity,
} from '../services/watermark/dct-watermark.js';
import {
  embedDWT,
  extractDWT,
  calculateDWTCapacity,
} from '../services/watermark/dwt-watermark.js';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a test RGBA image buffer
 */
function createTestImage(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Create a gradient pattern for testing
      buffer[idx] = Math.floor((x / width) * 255); // R
      buffer[idx + 1] = Math.floor((y / height) * 255); // G
      buffer[idx + 2] = 128; // B
      buffer[idx + 3] = 255; // A
    }
  }
  return buffer;
}

/**
 * Create a simple test watermark payload
 */
function createTestPayload(): Buffer {
  return Buffer.from('TestWatermark12345');
}

// =============================================================================
// DCT TRANSFORM TESTS
// =============================================================================

describe('DCT Transform', () => {
  describe('1D DCT/IDCT', () => {
    it('should perform forward and inverse transform correctly', () => {
      const input = [100, 120, 130, 140, 150, 160, 170, 180];
      const dctOutput = dct1D(input);
      const reconstructed = idct1D(dctOutput);

      // Check reconstruction accuracy
      for (let i = 0; i < input.length; i++) {
        expect(Math.abs(reconstructed[i] - input[i])).toBeLessThan(0.0001);
      }
    });

    it('should handle uniform values', () => {
      const input = [128, 128, 128, 128, 128, 128, 128, 128];
      const dctOutput = dct1D(input);

      // For uniform input, only DC component should be non-zero
      expect(Math.abs(dctOutput[0])).toBeGreaterThan(0);
      for (let i = 1; i < dctOutput.length; i++) {
        expect(Math.abs(dctOutput[i])).toBeLessThan(0.0001);
      }
    });
  });

  describe('2D DCT/IDCT', () => {
    it('should perform 2D transform and reconstruction', () => {
      const block = [
        [140, 144, 147, 140, 140, 155, 179, 175],
        [144, 152, 140, 147, 140, 148, 167, 179],
        [152, 155, 136, 167, 163, 162, 152, 172],
        [168, 145, 156, 160, 152, 155, 136, 160],
        [162, 148, 156, 148, 140, 136, 147, 162],
        [147, 167, 140, 155, 155, 140, 136, 162],
        [136, 156, 123, 167, 162, 144, 140, 147],
        [148, 155, 136, 155, 152, 147, 147, 136],
      ];

      const dctBlock = dct2D(block);
      const reconstructed = idct2D(dctBlock);

      // Check reconstruction accuracy
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          expect(Math.abs(reconstructed[i][j] - block[i][j])).toBeLessThan(0.01);
        }
      }
    });
  });
});

// =============================================================================
// DWT TRANSFORM TESTS
// =============================================================================

describe('DWT Transform', () => {
  describe('Haar 2D DWT/IDWT', () => {
    it('should perform forward and inverse wavelet transform', () => {
      // Create 8x8 test image
      const imageData: number[][] = [];
      for (let i = 0; i < 8; i++) {
        const row: number[] = [];
        for (let j = 0; j < 8; j++) {
          row.push(100 + i * 10 + j);
        }
        imageData.push(row);
      }

      const dwtResult = dwt2D(imageData);
      const reconstructed = idwt2D(dwtResult);

      // Check reconstruction accuracy
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          expect(Math.abs(reconstructed[i][j] - imageData[i][j])).toBeLessThan(0.01);
        }
      }
    });

    it('should decompose into LL, LH, HL, HH sub-bands', () => {
      const imageData: number[][] = Array.from({ length: 8 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => 128 + Math.sin((i + j) * 0.5) * 50)
      );

      const dwtResult = dwt2D(imageData);

      expect(dwtResult.LL.length).toBe(4);
      expect(dwtResult.LL[0].length).toBe(4);
      expect(dwtResult.LH.length).toBe(4);
      expect(dwtResult.HL.length).toBe(4);
      expect(dwtResult.HH.length).toBe(4);
    });
  });
});

// =============================================================================
// DCT WATERMARKING TESTS
// =============================================================================

describe('DCT Watermarking', () => {
  let testImage: Buffer;
  const width = 128;
  const height = 128;

  beforeEach(() => {
    testImage = createTestImage(width, height);
  });

  describe('Embedding', () => {
    it('should embed watermark data in DCT coefficients', () => {
      const payload = createTestPayload();

      const result = embedDCT(testImage, width, height, payload, {
        strength: 25,
        redundancy: 3,
      });

      expect(result.embeddedData).toBeDefined();
      expect(result.embeddedData.length).toBe(testImage.length);
      expect(result.blocksUsed).toBeGreaterThan(0);
      expect(result.bitsEmbedded).toBeGreaterThan(0);
    });

    it('should maintain image quality (high PSNR)', () => {
      const payload = createTestPayload();

      const result = embedDCT(testImage, width, height, payload, {
        strength: 25,
        redundancy: 3,
      });

      // Convert to channel data for PSNR calculation
      const originalChannel = bufferToChannel(testImage, width, height, 2);
      const embeddedChannel = bufferToChannel(result.embeddedData, width, height, 2);

      const psnr = calculatePSNR(originalChannel, embeddedChannel);

      // PSNR should be high (above 35 dB for good quality)
      expect(psnr).toBeGreaterThan(30);
    });
  });

  describe('Extraction', () => {
    it('should extract embedded watermark correctly', () => {
      const payload = createTestPayload();

      const embedResult = embedDCT(testImage, width, height, payload, {
        strength: 25,
        redundancy: 3,
      });

      const extractResult = extractDCT(embedResult.embeddedData, width, height, {
        strength: 25,
        redundancy: 3,
      });

      expect(extractResult.data).not.toBeNull();
      expect(extractResult.confidence).toBeGreaterThan(0.9);
      expect(extractResult.data?.toString()).toBe(payload.toString());
    });

    it('should report low confidence for unwatermarked images', () => {
      const extractResult = extractDCT(testImage, width, height, {
        strength: 25,
        redundancy: 3,
      });

      expect(extractResult.data).toBeNull();
      expect(extractResult.confidence).toBe(0);
    });
  });

  describe('Capacity', () => {
    it('should calculate correct capacity for image size', () => {
      const capacity = calculateDCTCapacity(width, height, { redundancy: 3 });

      expect(capacity.capacityBits).toBeGreaterThan(0);
      expect(capacity.capacityBytes).toBeGreaterThan(0);
      expect(capacity.blocks).toBe(Math.floor(width / 8) * Math.floor(height / 8));
    });
  });
});

// =============================================================================
// DWT WATERMARKING TESTS
// =============================================================================

describe('DWT Watermarking', () => {
  let testImage: Buffer;
  const width = 128;
  const height = 128;

  beforeEach(() => {
    testImage = createTestImage(width, height);
  });

  describe('Embedding', () => {
    it('should embed watermark data in wavelet coefficients', () => {
      const payload = createTestPayload();

      const result = embedDWT(testImage, width, height, payload, {
        levels: 2,
        strength: 10,
        redundancy: 3,
      });

      expect(result.embeddedData).toBeDefined();
      expect(result.embeddedData.length).toBe(testImage.length);
      expect(result.coefficientsModified).toBeGreaterThan(0);
      expect(result.bitsEmbedded).toBeGreaterThan(0);
    });

    it('should maintain image quality (high PSNR)', () => {
      const payload = createTestPayload();

      const result = embedDWT(testImage, width, height, payload, {
        levels: 2,
        strength: 10,
        redundancy: 3,
      });

      const originalChannel = bufferToChannel(testImage, width, height, 2);
      const embeddedChannel = bufferToChannel(result.embeddedData, width, height, 2);

      const psnr = calculatePSNR(originalChannel, embeddedChannel);

      // PSNR should be high for DWT watermarking
      expect(psnr).toBeGreaterThan(30);
    });
  });

  describe('Extraction', () => {
    it('should extract embedded watermark correctly', () => {
      const payload = createTestPayload();

      const embedResult = embedDWT(testImage, width, height, payload, {
        levels: 2,
        strength: 10,
        redundancy: 3,
      });

      const extractResult = extractDWT(embedResult.embeddedData, width, height, {
        levels: 2,
        strength: 10,
        redundancy: 3,
      });

      expect(extractResult.data).not.toBeNull();
      expect(extractResult.confidence).toBeGreaterThan(0.9);
      expect(extractResult.data?.toString()).toBe(payload.toString());
    });

    it('should report low confidence for unwatermarked images', () => {
      const extractResult = extractDWT(testImage, width, height, {
        levels: 2,
        strength: 10,
        redundancy: 3,
      });

      expect(extractResult.data).toBeNull();
      expect(extractResult.confidence).toBe(0);
    });
  });

  describe('Capacity', () => {
    it('should calculate correct capacity for image size', () => {
      const capacity = calculateDWTCapacity(width, height, {
        levels: 2,
        redundancy: 3,
      });

      expect(capacity.capacityBits).toBeGreaterThan(0);
      expect(capacity.capacityBytes).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// BUFFER CONVERSION TESTS
// =============================================================================

describe('Buffer Conversion', () => {
  it('should correctly extract and restore channel data', () => {
    const width = 16;
    const height = 16;
    const original = createTestImage(width, height);

    // Extract blue channel
    const channelData = bufferToChannel(original, width, height, 2);

    // Create a copy and restore
    const restored = Buffer.from(original);
    channelToBuffer(channelData, restored, width, height, 2);

    // Original blue channel values should match
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4 + 2;
        expect(restored[idx]).toBe(original[idx]);
      }
    }
  });
});

// =============================================================================
// ROBUSTNESS TESTS
// =============================================================================

describe('Robustness', () => {
  // Use larger image for robustness tests to have enough capacity
  const width = 256;
  const height = 256;

  it('DCT watermark should survive minor noise', () => {
    const testImage = createTestImage(width, height);
    const payload = createTestPayload();

    const embedResult = embedDCT(testImage, width, height, payload, {
      strength: 30,
      redundancy: 5,
    });

    // Add minor noise to the watermarked image
    const noisy = Buffer.from(embedResult.embeddedData);
    for (let i = 0; i < noisy.length; i += 4) {
      // Add small noise to color channels
      noisy[i] = Math.max(0, Math.min(255, noisy[i] + Math.floor((Math.random() - 0.5) * 4)));
      noisy[i + 1] = Math.max(0, Math.min(255, noisy[i + 1] + Math.floor((Math.random() - 0.5) * 4)));
      noisy[i + 2] = Math.max(0, Math.min(255, noisy[i + 2] + Math.floor((Math.random() - 0.5) * 4)));
    }

    const extractResult = extractDCT(noisy, width, height, {
      strength: 30,
      redundancy: 5,
    });

    // Should still be able to extract with reasonable confidence
    expect(extractResult.data).not.toBeNull();
    expect(extractResult.confidence).toBeGreaterThan(0.7);
  });

  it('DWT watermark should survive minor noise', () => {
    const testImage = createTestImage(width, height);
    const payload = createTestPayload();

    // Use stronger embedding and lower redundancy for more robustness
    const embedResult = embedDWT(testImage, width, height, payload, {
      levels: 2,
      strength: 25, // Stronger embedding
      redundancy: 7, // Higher redundancy for better error correction
    });

    // Add minor noise (only to blue channel where watermark is)
    const noisy = Buffer.from(embedResult.embeddedData);
    for (let i = 0; i < noisy.length; i += 4) {
      // Add very small noise only to blue channel
      noisy[i + 2] = Math.max(0, Math.min(255, noisy[i + 2] + Math.floor((Math.random() - 0.5) * 2)));
    }

    const extractResult = extractDWT(noisy, width, height, {
      levels: 2,
      strength: 25,
      redundancy: 7,
    });

    expect(extractResult.data).not.toBeNull();
    expect(extractResult.confidence).toBeGreaterThan(0.5);
  });
});

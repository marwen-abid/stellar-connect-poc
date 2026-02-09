import { describe, it, expect } from 'vitest';
import { generateRandomBytes, toBase64, fromBase64 } from '../crypto';

describe('crypto utilities', () => {
  describe('generateRandomBytes', () => {
    it('should generate bytes of specified length', async () => {
      const bytes = await generateRandomBytes(32);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it('should generate different values on successive calls', async () => {
      const bytes1 = await generateRandomBytes(16);
      const bytes2 = await generateRandomBytes(16);
      expect(bytes1).not.toEqual(bytes2);
    });

    it('should throw on invalid length', async () => {
      await expect(generateRandomBytes(0)).rejects.toThrow('positive integer');
      await expect(generateRandomBytes(-1)).rejects.toThrow('positive integer');
      await expect(generateRandomBytes(1.5)).rejects.toThrow('positive integer');
    });
  });

  describe('toBase64', () => {
    it('should encode bytes to base64', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const base64 = toBase64(bytes);
      expect(base64).toBe('SGVsbG8=');
    });

    it('should handle empty array', () => {
      const bytes = new Uint8Array([]);
      const base64 = toBase64(bytes);
      expect(base64).toBe('');
    });

    it('should handle binary data', () => {
      const bytes = new Uint8Array([0, 1, 2, 255, 254, 253]);
      const base64 = toBase64(bytes);
      expect(base64).toBeTruthy();
      expect(typeof base64).toBe('string');
    });
  });

  describe('fromBase64', () => {
    it('should decode base64 to bytes', () => {
      const base64 = 'SGVsbG8=';
      const bytes = fromBase64(base64);
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle empty string', () => {
      const bytes = fromBase64('');
      expect(bytes).toEqual(new Uint8Array([]));
    });

    it('should handle binary data', () => {
      const original = new Uint8Array([0, 1, 2, 255, 254, 253]);
      const base64 = toBase64(original);
      const decoded = fromBase64(base64);
      expect(decoded).toEqual(original);
    });
  });

  describe('round-trip encoding', () => {
    it('should preserve data through encode/decode cycle', async () => {
      const original = await generateRandomBytes(64);
      const base64 = toBase64(original);
      const decoded = fromBase64(base64);
      expect(decoded).toEqual(original);
    });
  });
});

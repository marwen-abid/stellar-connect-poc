import { describe, it, expect, vi } from 'vitest';
import { keypairSigner } from '../keypair-signer';
import { callbackSigner } from '../callback-signer';
import { Keypair } from '@stellar/stellar-sdk';

describe('keypairSigner', () => {
  it('creates a valid signer from a secret key', () => {
    const keypair = Keypair.random();
    const secret = keypair.secret();
    const signer = keypairSigner(secret);

    expect(signer.publicKey).toBe(keypair.publicKey());
  });

  it('rejects invalid secret keys', () => {
    expect(() => keypairSigner('invalid-key')).toThrow('Invalid secret key');
  });

  it('signs a transaction XDR', async () => {
    const keypair = Keypair.random();
    const signer = keypairSigner(keypair.secret());
    const testXdr = Buffer.from('test transaction').toString('base64');

    const signed = await signer.signTransaction(testXdr);

    expect(typeof signed).toBe('string');
    expect(signed.length).toBeGreaterThan(0);
  });

  it('produces consistent signatures for the same input', async () => {
    const keypair = Keypair.random();
    const signer = keypairSigner(keypair.secret());
    const testXdr = Buffer.from('test transaction').toString('base64');

    const signed1 = await signer.signTransaction(testXdr);
    const signed2 = await signer.signTransaction(testXdr);

    expect(signed1).toBe(signed2);
  });

  it('handles signing errors gracefully', async () => {
    // Create a signer and manually set up a scenario where signing fails
    const keypair = Keypair.random();
    const signer = keypairSigner(keypair.secret());
    // Use an empty buffer which will fail signing
    const emptyXdr = Buffer.alloc(0).toString('base64');

    // This should handle errors from the signing operation
    const result = await signer.signTransaction(emptyXdr);
    expect(typeof result).toBe('string');
  });
});

describe('callbackSigner', () => {
  it('creates a signer with the provided public key', () => {
    const publicKey = 'GABC1234567890';
    const signFn = vi.fn(async (xdr: string) => 'signed');
    const signer = callbackSigner(publicKey, signFn);

    expect(signer.publicKey).toBe(publicKey);
  });

  it('wraps the callback correctly', async () => {
    const publicKey = 'GABC1234567890';
    const signFn = vi.fn(async (xdr: string) => `signed-${xdr}`);
    const signer = callbackSigner(publicKey, signFn);

    const testXdr = 'test-xdr';
    const result = await signer.signTransaction(testXdr);

    expect(signFn).toHaveBeenCalledWith(testXdr);
    expect(result).toBe('signed-test-xdr');
  });

  it('returns the callback result as-is', async () => {
    const publicKey = 'GABC1234567890';
    const expectedSigned = 'base64-encoded-signature';
    const signFn = vi.fn(async () => expectedSigned);
    const signer = callbackSigner(publicKey, signFn);

    const result = await signer.signTransaction('test-xdr');

    expect(result).toBe(expectedSigned);
  });

  it('handles callback errors and rethrows with context', async () => {
    const publicKey = 'GABC1234567890';
    const originalError = new Error('Signing service unavailable');
    const signFn = vi.fn(async () => {
      throw originalError;
    });
    const signer = callbackSigner(publicKey, signFn);

    await expect(signer.signTransaction('test-xdr')).rejects.toThrow(
      'Callback signing failed: Signing service unavailable'
    );
  });

  it('preserves the original error message', async () => {
    const publicKey = 'GABC1234567890';
    const errorMessage = 'User denied signing request';
    const signFn = vi.fn(async () => {
      throw new Error(errorMessage);
    });
    const signer = callbackSigner(publicKey, signFn);

    await expect(signer.signTransaction('test-xdr')).rejects.toThrow(
      errorMessage
    );
  });

  it('works with multiple consecutive calls', async () => {
    const publicKey = 'GABC1234567890';
    const signFn = vi.fn(async (xdr: string) => `signed-${xdr}`);
    const signer = callbackSigner(publicKey, signFn);

    const result1 = await signer.signTransaction('xdr-1');
    const result2 = await signer.signTransaction('xdr-2');

    expect(signFn).toHaveBeenCalledTimes(2);
    expect(result1).toBe('signed-xdr-1');
    expect(result2).toBe('signed-xdr-2');
  });
});

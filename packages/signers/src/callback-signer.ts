import type { Signer } from '@stellarconnect/core';

/**
 * Creates a Signer from a callback function.
 *
 * This allows wrapping custom signing logic (e.g., from hardware wallets,
 * signing services, or web APIs) into a standard Signer interface.
 *
 * @param publicKey - The Stellar public key (G... format)
 * @param signFn - Async callback that receives XDR and returns signed XDR
 * @returns A Signer object wrapping the callback
 * @throws {Error} If the callback throws or rejects
 *
 * @example
 * ```typescript
 * const signer = callbackSigner('GABC...', async (xdr) => {
 *   return await remoteSigningService.sign(xdr);
 * });
 * ```
 */
export function callbackSigner(
  publicKey: string,
  signFn: (xdr: string) => Promise<string>
): Signer {
  return {
    publicKey,

    async signTransaction(xdr: string): Promise<string> {
      try {
        return await signFn(xdr);
      } catch (error) {
        throw new Error(
          `Callback signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
  };
}

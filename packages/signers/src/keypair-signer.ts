import { Keypair } from '@stellar/stellar-sdk';
import type { Signer } from '@stellarconnect/core';

/**
 * Creates a Signer from a Stellar secret key.
 *
 * The secret key must be in Stellar format (S...).
 * This function validates the key format and creates a keypair for signing.
 *
 * @param secretKey - The Stellar secret key (S... format)
 * @returns A Signer object with signing capabilities
 * @throws {Error} If the secret key is invalid
 *
 * @example
 * ```typescript
 * const signer = keypairSigner('S...');
 * const signed = await signer.signTransaction(xdr);
 * ```
 */
export function keypairSigner(secretKey: string): Signer {
  let keypair: Keypair;

  try {
    keypair = Keypair.fromSecret(secretKey);
  } catch (error) {
    throw new Error(
      `Invalid secret key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return {
    publicKey: keypair.publicKey(),

    async signTransaction(xdr: string): Promise<string> {
      try {
        const buffer = Buffer.from(xdr, 'base64');
        const signature = keypair.sign(buffer);
        return signature.toString('base64');
      } catch (error) {
        throw new Error(
          `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
  };
}

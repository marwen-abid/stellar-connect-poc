import type { Signer } from '@stellarconnect/core';
import { NetworkClient } from '@stellarconnect/core';
import type { Network } from './types.js';

/**
 * SEP-10 challenge response from the anchor
 */
export interface Sep10Challenge {
  transaction: string; // XDR of the challenge transaction
  network_passphrase: string;
}

/**
 * SEP-10 authentication token response
 */
export interface Sep10Token {
  token: string;
  expires_at?: string; // ISO 8601 timestamp
}

/**
 * Performs SEP-10 authentication flow with an anchor
 *
 * @param authEndpoint - The anchor's SEP-10 authentication endpoint
 * @param signer - The signer to use for challenge signing
 * @param network - The Stellar network (testnet or public)
 * @param networkClient - Optional network client instance
 * @returns Promise resolving to the JWT token and expiration
 */
export async function authenticateSep10(
  authEndpoint: string,
  signer: Signer,
  network: Network,
  networkClient: NetworkClient = new NetworkClient(),
): Promise<Sep10Token> {
  // Step 1: Request challenge from anchor
  const challengeUrl = `${authEndpoint}?account=${signer.publicKey}`;
  const challengeResponse = await networkClient.get(challengeUrl);

  if (!challengeResponse.ok) {
    throw new Error(
      `Failed to get SEP-10 challenge: ${challengeResponse.status} ${challengeResponse.statusText}`,
    );
  }

  const challenge: Sep10Challenge = await challengeResponse.json();

  // Step 2: Validate network passphrase
  const expectedPassphrase =
    network === 'testnet'
      ? 'Test SDF Network ; September 2015'
      : 'Public Global Stellar Network ; September 2015';

  if (challenge.network_passphrase !== expectedPassphrase) {
    throw new Error(
      `Network passphrase mismatch: expected ${expectedPassphrase}, got ${challenge.network_passphrase}`,
    );
  }

  // Step 3: Sign the challenge transaction
  const signedXdr = await signer.signTransaction(challenge.transaction);

  // Step 4: Submit signed challenge back to anchor
  const submitResponse = await networkClient.post(
    authEndpoint,
    JSON.stringify({ transaction: signedXdr }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!submitResponse.ok) {
    throw new Error(
      `Failed to submit signed challenge: ${submitResponse.status} ${submitResponse.statusText}`,
    );
  }

  const token: Sep10Token = await submitResponse.json();

  return token;
}

/**
 * Parses the expiration timestamp from a SEP-10 token response
 *
 * @param token - The SEP-10 token response
 * @returns Date object representing when the token expires, or undefined if not specified
 */
export function parseTokenExpiration(token: Sep10Token): Date | undefined {
  if (!token.expires_at) {
    return undefined;
  }

  try {
    return new Date(token.expires_at);
  } catch {
    return undefined;
  }
}

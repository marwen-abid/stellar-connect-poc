import { StrKey } from '@stellar/stellar-sdk';

/**
 * Validates if a string is a valid Stellar public address
 * @param address - The address string to validate
 * @returns true if the address is a valid Stellar public key (G-address), false otherwise
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Use StrKey.isValidEd25519PublicKey for robust validation
  // This validates format, length, base32 encoding, and checksum
  return StrKey.isValidEd25519PublicKey(address);
}

/**
 * Signer Interface
 *
 * The boundary between Stellar Connect and everything upstream of it —
 * the mechanism by which the caller proves identity and authorizes actions.
 *
 * This interface is deliberately minimal and does not manage lifecycle,
 * connection state, or wallet-specific details.
 */

/**
 * Signer provides the core signing capabilities needed for Stellar operations.
 *
 * @property publicKey - The Stellar public key (G... address) identifying the account
 * @method signTransaction - Signs a Stellar transaction envelope (XDR format)
 * @method signMessage - Optional method for signing arbitrary messages (SEP-45)
 */
export interface Signer {
  /**
   * The public key of the signer in Stellar address format (G...).
   * This identifies the account that will be signing transactions.
   */
  readonly publicKey: string;

  /**
   * Signs a Stellar transaction envelope.
   *
   * @param xdr - Base64-encoded XDR string of the transaction envelope
   * @returns Promise resolving to the base64-encoded signed transaction XDR
   * @throws {Error} If signing fails or is rejected by the user
   */
  signTransaction(xdr: string): Promise<string>;

  /**
   * Optional method to sign arbitrary messages for authentication.
   * When present, signals SEP-45 capability for smart contract wallet authentication.
   *
   * @param message - The message string to sign
   * @returns Promise resolving to the signature
   * @throws {Error} If signing fails or is not supported
   */
  signMessage?(message: string): Promise<string>;
}

/**
 * Type guard to check if a signer supports message signing (SEP-45).
 *
 * @param signer - The signer to check
 * @returns true if the signer implements signMessage
 */
export function supportsMessageSigning(signer: Signer): signer is Required<Signer> {
  return typeof signer.signMessage === 'function';
}

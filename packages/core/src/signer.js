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
 * Type guard to check if a signer supports message signing (SEP-45).
 *
 * @param signer - The signer to check
 * @returns true if the signer implements signMessage
 */
export function supportsMessageSigning(signer) {
    return typeof signer.signMessage === 'function';
}
//# sourceMappingURL=signer.js.map
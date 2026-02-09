import { describe, it, expect } from 'vitest';
import { isValidStellarAddress } from '../stellar-validators';

describe('isValidStellarAddress', () => {
  it('should accept valid G-address (56 char public key)', () => {
    const validAddress = 'GBQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK';
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('should accept another valid G-address', () => {
    const validAddress = 'GBGB473ZTFYIPK7BDXOQLQA6EEISZFT4AFQS46BTIZ32UZ3GTM4VSHEP';
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });

  it('should reject null-like input', () => {
    expect(isValidStellarAddress(null as any)).toBe(false);
    expect(isValidStellarAddress(undefined as any)).toBe(false);
  });

  it('should reject non-string input', () => {
    expect(isValidStellarAddress(123 as any)).toBe(false);
    expect(isValidStellarAddress({} as any)).toBe(false);
  });

  it('should reject random string', () => {
    expect(isValidStellarAddress('this-is-not-a-stellar-address')).toBe(false);
  });

  it('should reject address with wrong length', () => {
    expect(isValidStellarAddress('GDZST3XVCDTUJ76ZAV2HA72KYDT4DKUC5QTVK5')).toBe(false);
    expect(isValidStellarAddress('GDZST3XVCDTUJ76ZAV2HA72KYDT4DKUC5QTVK5MLJC3P5WFDQSWXSFBEXTRA')).toBe(false);
  });

  it('should reject secret key (S-address)', () => {
    const secretKey = 'SDMUBTMJZPSQZBJVXBNDZ6ELWHFPFMLO3J63VS3TT6I2RDSOK7HZRTAF';
    expect(isValidStellarAddress(secretKey)).toBe(false);
  });

  it('should reject address starting with wrong prefix', () => {
    expect(isValidStellarAddress('PBQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK')).toBe(false);
    expect(isValidStellarAddress('ABQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK')).toBe(false);
  });

  it('should reject address with invalid base32 characters', () => {
    expect(isValidStellarAddress('GBQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK!')).toBe(false);
    expect(isValidStellarAddress('GBQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK@')).toBe(false);
  });

  it('should reject address with lowercase characters', () => {
    expect(isValidStellarAddress('gbqdlh7oc26q74gajcjt4oiilgxot3b42ixw22sa776l2r3gzfm4apvk')).toBe(false);
  });

  it('should reject address with corrupted checksum', () => {
    const validAddress = 'GBQDLH7OC26Q74GAJCJT4OIILGXOT3B42IXW22SA776L2R3GZFM4APVK';
    const corruptedAddress = validAddress.slice(0, -1) + 'A';
    expect(isValidStellarAddress(corruptedAddress)).toBe(false);
  });
});

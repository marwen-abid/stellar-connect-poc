/**
 * SEP-1 TOML Configuration Types
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md
 */

export type { AnchorServerConfig, AssetConfig, AnchorMeta } from '../config/types.js';

/**
 * Stellar network type
 */
export type NetworkType = 'testnet' | 'public';

/**
 * Currency/Asset information for SEP-1 [[CURRENCIES]] section
 */
export interface CurrencyInfo {
  code: string;
  issuer?: string;
  status?: 'test' | 'live';
  display_decimals?: number;
  name?: string;
  desc?: string;
  conditions?: string;
  image?: string;
  fixed_number?: number;
  max_number?: number;
  is_unlimited?: boolean;
  is_asset_anchored?: boolean;
  anchor_asset_type?: string;
  anchor_asset?: string;
  redemption_instructions?: string;
  collateral_addresses?: string[];
  collateral_address_messages?: string[];
  collateral_address_signatures?: string[];
  regulated?: boolean;
  approval_server?: string;
  approval_criteria?: string;
}

/**
 * Principal/Organization information for SEP-1
 */
export interface PrincipalInfo {
  name?: string;
  email?: string;
  keybase?: string;
  twitter?: string;
  github?: string;
  id_photo_hash?: string;
  verification_photo_hash?: string;
}

/**
 * Documentation URLs for SEP-1
 */
export interface DocumentationInfo {
  org_name?: string;
  org_dba?: string;
  org_url?: string;
  org_logo?: string;
  org_description?: string;
  org_physical_address?: string;
  org_physical_address_attestation?: string;
  org_phone_number?: string;
  org_phone_number_attestation?: string;
  org_keybase?: string;
  org_twitter?: string;
  org_github?: string;
  org_official_email?: string;
  org_support_email?: string;
  org_licensing_authority?: string;
  org_license_type?: string;
  org_license_number?: string;
}

/**
 * Internal structure for TOML generation
 */
export interface TomlStructure {
  // Required SEP-1 fields
  SIGNING_KEY: string;
  NETWORK_PASSPHRASE: string;

  // Optional common fields
  VERSION?: string;
  ACCOUNTS?: string[];

  // SEP-10 Web Authentication
  WEB_AUTH_ENDPOINT?: string;

  // SEP-24 Hosted Deposit and Withdrawal
  TRANSFER_SERVER_SEP0024?: string;

  // SEP-6 Deposit and Withdrawal API
  TRANSFER_SERVER?: string;

  // Organization documentation
  DOCUMENTATION?: DocumentationInfo;

  // Principals
  PRINCIPALS?: PrincipalInfo[];

  // Custom fields
  [key: string]: unknown;
}

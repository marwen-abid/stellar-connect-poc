import type { AnchorInfo } from '@stellarconnect/core';
import type { Signer } from '@stellarconnect/core';

/**
 * Network configuration for Stellar Connect
 */
export type Network = 'testnet' | 'public';

/**
 * Configuration options for StellarConnect client
 */
export interface StellarConnectConfig {
  /** Stellar network to use */
  network: Network;
  /** Optional custom Horizon URL (overrides default for network) */
  horizonUrl?: string;
}

/**
 * SEP-10 authentication endpoint information
 */
export interface Sep10Endpoint {
  endpoint: string;
}

/**
 * SEP-6 transfer endpoint information
 */
export interface Sep6Endpoint {
  endpoint: string;
}

/**
 * SEP-24 interactive transfer endpoint information
 */
export interface Sep24Endpoint {
  endpoint: string;
}

/**
 * Anchor capabilities discovered from TOML
 */
export interface AnchorCapabilities {
  /** Anchor domain */
  domain: string;
  /** Parsed TOML data */
  toml: AnchorInfo;
  /** SEP-10 authentication endpoint if supported */
  sep10?: Sep10Endpoint;
  /** SEP-6 transfer server endpoint if supported */
  sep6?: Sep6Endpoint;
  /** SEP-24 interactive transfer endpoint if supported */
  sep24?: Sep24Endpoint;
}

/**
 * Asset information for transfers
 */
export interface AssetInfo {
  code: string;
  issuer?: string;
}

/**
 * Options for transfer operations
 */
export interface TransferOptions {
  account?: string;
  amount?: string;
  memo?: string;
  memoType?: 'text' | 'id' | 'hash';
  [key: string]: unknown;
}

export type { TransferProcess } from './transfer-process.js';

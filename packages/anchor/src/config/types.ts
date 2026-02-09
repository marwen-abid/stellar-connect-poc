/**
 * Configuration types for the refactored anchor framework.
 *
 * This defines the new config API that accepts:
 * - secretKey (S...) instead of signingKey (G...)
 * - assets as a Record<string, AssetConfig> instead of currencies array
 * - camelCase fields instead of TOML-style UPPER_CASE
 */

import type { TransferStore } from '../transfer/transfer-store.js';
import type { Transfer, TransferKind } from '../transfer/types.js';

/**
 * Network to operate on.
 * 'public' is the Stellar mainnet (matches stellar-sdk convention).
 * 'mainnet' is accepted as an alias for 'public'.
 */
export type NetworkType = 'public' | 'testnet' | 'futurenet' | 'standalone' | 'mainnet';

/**
 * Main configuration for AnchorServer.
 */
export interface AnchorServerConfig {
  /** The domain this anchor operates on (e.g., 'myanchor.com') */
  domain: string;

  /** Stellar secret key for signing SEP-10 challenges (starts with 'S') */
  secretKey: string;

  /** Secret used to sign and verify JWTs */
  jwtSecret: string;

  /** Network to operate on — library derives passphrase internally */
  network: NetworkType;

  /**
   * Asset configuration — drives TOML, /info responses, and validation.
   * Keys are asset codes (e.g., 'USDC', 'BTC', 'native').
   */
  assets: Record<string, AssetConfig>;

  /**
   * Optional custom transfer store. Defaults to InMemoryTransferStore.
   * Implement the TransferStore interface for production use.
   */
  store?: TransferStore;

  /**
   * Optional organization metadata for TOML publication.
   * Uses camelCase for consistency (library handles TOML mapping).
   */
  meta?: AnchorMeta;
}

/**
 * Organization metadata for SEP-1 TOML.
 * Maps to DOCUMENTATION section fields.
 */
export interface AnchorMeta {
  orgName?: string;
  orgUrl?: string;
  orgDescription?: string;
  orgLogo?: string;
  orgPhysicalAddress?: string;
  orgOfficialEmail?: string;
  orgSupportEmail?: string;
}

/**
 * Configuration for a single asset.
 */
export interface AssetConfig {
  /** Stellar asset issuer public key. Omit for native XLM. */
  issuer?: string;

  /** Human-readable name */
  name?: string;

  /** Description */
  desc?: string;

  /** Number of decimal places to display (default: 7) */
  displayDecimals?: number;

  /**
   * Asset status for TOML publication.
   * Default: derived from network ('test' for testnet, 'live' for public).
   */
  status?: 'live' | 'test' | 'dead' | 'private';

  /** Deposit configuration */
  deposit?: AssetOperationConfig;

  /** Withdrawal configuration */
  withdraw?: AssetOperationConfig;
}

/**
 * Configuration for deposit or withdrawal operations on an asset.
 */
export interface AssetOperationConfig {
  /** Whether this operation is enabled */
  enabled: boolean;

  /** Minimum amount */
  minAmount?: number;

  /** Maximum amount */
  maxAmount?: number;

  /** Fixed fee */
  feeFixed?: number;

  /** Percentage fee (0-100) */
  feePercent?: number;

  /**
   * SEP-24 specific: KYC/transaction fields required from user.
   * Keys are field names (e.g., 'email_address', 'bank_account_number').
   */
  fields?: Record<string, FieldConfig>;
}

/**
 * Configuration for a KYC/transaction field.
 */
export interface FieldConfig {
  /** Description of what this field is for */
  description: string;

  /** Whether this field is optional */
  optional: boolean;

  /** Field choices (if applicable) */
  choices?: string[];
}

/**
 * Configuration for interactive flows (SEP-24).
 */
export interface InteractiveConfig {
  /** Base URL for interactive flows */
  url: string;
}

/**
 * Hook interface for SEP-24 interactive transfers.
 *
 * The `interactive` field is required — implementers must provide
 * their own interactive URL for KYC/deposit/withdrawal flows.
 */
export interface Sep24Hooks {
  /**
   * Called when a deposit is initiated.
   * Can customize the interactive URL or modify transfer metadata.
   */
  onDeposit?: (context: DepositContext) => Promise<DepositResult | void>;

  /**
   * Called when a withdrawal is initiated.
   * Can customize the interactive URL or modify transfer metadata.
   */
  onWithdraw?: (context: WithdrawContext) => Promise<WithdrawResult | void>;

  /**
   * Called when user completes the interactive flow.
   * This is where you implement the actual transfer logic.
   */
  onInteractiveComplete?: (context: InteractiveCompleteContext) => Promise<void>;

  /**
   * Interactive flow configuration — REQUIRED.
   * You must provide a URL where users will complete the interactive flow
   * (KYC, deposit/withdrawal confirmation, etc.).
   *
   * The library will redirect `GET /interactive` to this URL with
   * `token` and `transaction_id` query parameters appended.
   *
   * Your interactive page should call `POST /interactive/complete`
   * with `{ transaction_id, token }` when the user finishes.
   */
  interactive: InteractiveConfig;

  /**
   * Optional: custom renderer for more_info_url content.
   * If provided, library will serve GET /transaction/more_info/:id
   */
  renderMoreInfo?: (transfer: Transfer) => string;
}

/**
 * Context passed to onDeposit hook.
 */
export interface DepositContext {
  /** The transfer being initiated */
  transfer: Transfer;

  /** Asset code being deposited */
  assetCode: string;

  /** Stellar account making the deposit */
  account: string;

  /** Amount (if provided in request) */
  amount?: string;

  /** Additional request parameters */
  params: Record<string, unknown>;

  /** Access to the transfer store */
  store: TransferStore;

  /** Update the transfer status */
  updateStatus: (status: string, message?: string) => Promise<void>;

  /** Set the Stellar transaction ID */
  setStellarTransactionId: (txId: string) => Promise<void>;
}

/**
 * Result from onDeposit hook.
 */
export interface DepositResult {
  /** Custom interactive URL (overrides default) */
  interactiveUrl?: string;

  /** Additional metadata to attach to transfer */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to onWithdraw hook.
 */
export interface WithdrawContext {
  /** The transfer being initiated */
  transfer: Transfer;

  /** Asset code being withdrawn */
  assetCode: string;

  /** Stellar account making the withdrawal */
  account: string;

  /** Amount (if provided in request) */
  amount?: string;

  /** Destination (e.g., bank account, crypto address) */
  dest?: string;

  /** Destination extra (e.g., memo) */
  destExtra?: string;

  /** Additional request parameters */
  params: Record<string, unknown>;

  /** Access to the transfer store */
  store: TransferStore;

  /** Update the transfer status */
  updateStatus: (status: string, message?: string) => Promise<void>;

  /** Set the Stellar transaction ID */
  setStellarTransactionId: (txId: string) => Promise<void>;
}

/**
 * Result from onWithdraw hook.
 */
export interface WithdrawResult {
  /** Custom interactive URL (overrides default) */
  interactiveUrl?: string;

  /** Additional metadata to attach to transfer */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to onInteractiveComplete hook.
 */
export interface InteractiveCompleteContext {
  /** The transfer that was completed */
  transfer: Transfer;

  /** Access to the transfer store */
  store: TransferStore;

  /** Update the transfer status */
  updateStatus: (status: string, message?: string) => Promise<void>;

  /** Set the Stellar transaction ID */
  setStellarTransactionId: (txId: string) => Promise<void>;

  /** Set the external transaction ID */
  setExternalTransactionId: (txId: string) => Promise<void>;
}

/**
 * Hook interface for SEP-6 programmatic transfers.
 */
export interface Sep6Hooks {
  /**
   * Called when a deposit is requested.
   * Must return deposit instructions.
   */
  onDeposit: (context: Sep6DepositContext) => Promise<Sep6DepositResult>;

  /**
   * Called when a withdrawal is requested.
   * Must return withdrawal acceptance details.
   */
  onWithdraw: (context: Sep6WithdrawContext) => Promise<Sep6WithdrawResult>;
}

/**
 * Context passed to SEP-6 onDeposit hook.
 */
export interface Sep6DepositContext {
  /** The transfer being initiated */
  transfer: Transfer;

  /** Asset code being deposited */
  assetCode: string;

  /** Stellar account making the deposit */
  account: string;

  /** Amount (if provided in request) */
  amount?: string;

  /** Additional request parameters */
  params: Record<string, unknown>;

  /** Access to the transfer store */
  store: TransferStore;

  /** Update the transfer status */
  updateStatus: (status: string, message?: string) => Promise<void>;
}

/**
 * Result from SEP-6 onDeposit hook.
 */
export interface Sep6DepositResult {
  /** How to make the deposit — the anchor's receiving details */
  how: string;

  /** Estimated completion time in seconds */
  eta?: number;

  /** Minimum amount */
  minAmount?: number;

  /** Maximum amount */
  maxAmount?: number;

  /** Fixed fee */
  feeFixed?: number;

  /** Percentage fee */
  feePercent?: number;

  /** Additional fields to display to the user */
  extraInfo?: Record<string, string>;
}

/**
 * Context passed to SEP-6 onWithdraw hook.
 */
export interface Sep6WithdrawContext {
  /** The transfer being initiated */
  transfer: Transfer;

  /** Asset code being withdrawn */
  assetCode: string;

  /** Stellar account making the withdrawal */
  account: string;

  /** Amount (if provided in request) */
  amount?: string;

  /** Withdrawal type (e.g., 'bank_account', 'crypto') */
  type?: string;

  /** Destination address or account */
  dest?: string;

  /** Destination memo or extra field */
  destExtra?: string;

  /** Additional request parameters */
  params: Record<string, unknown>;

  /** Access to the transfer store */
  store: TransferStore;

  /** Update the transfer status */
  updateStatus: (status: string, message?: string) => Promise<void>;
}

/**
 * Result from SEP-6 onWithdraw hook.
 */
export interface Sep6WithdrawResult {
  /** Anchor's receiving account ID */
  accountId: string;

  /** Memo type (if required) */
  memoType?: 'text' | 'id' | 'hash';

  /** Memo value */
  memo?: string;

  /** Estimated time in seconds */
  eta?: number;

  /** Minimum amount */
  minAmount?: number;

  /** Maximum amount */
  maxAmount?: number;

  /** Fixed fee */
  feeFixed?: number;

  /** Percentage fee */
  feePercent?: number;

  /** Additional fields */
  extraInfo?: Record<string, string>;
}

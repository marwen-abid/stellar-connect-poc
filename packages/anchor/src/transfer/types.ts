/**
 * Type definitions for SEP-24 interactive transfer flows
 */

/**
 * Transfer operation type
 */
export type TransferKind = 'deposit' | 'withdrawal';

/**
 * Transfer mode
 */
export type TransferMode = 'interactive';

/**
 * Transfer state machine states
 */
export enum TransferStatus {
  /** Initial state when transfer is created */
  INITIATING = 'incomplete',
  
  /** User needs to complete interactive flow (KYC, etc.) */
  INTERACTIVE = 'incomplete',
  
  /** Waiting for user to start transfer (e.g., send funds for deposit) */
  PENDING_USER_TRANSFER_START = 'pending_user_transfer_start',
  
  /** Transfer is being processed externally */
  PENDING_EXTERNAL = 'pending_external',
  
  /** Transfer completed successfully */
  COMPLETED = 'completed',
  
  /** Transfer failed or was rejected */
  ERROR = 'error',
  
  /** Transfer was refunded */
  REFUNDED = 'refunded',
  
  /** User action required */
  PENDING_USER = 'pending_user',
  
  /** Anchor action required */
  PENDING_ANCHOR = 'pending_anchor',
}

/**
 * Interactive transfer authentication token
 */
export interface InteractiveToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

/**
 * Core transfer record
 */
export interface Transfer {
  /** Unique transfer identifier */
  id: string;
  
  /** Transfer type: deposit or withdrawal */
  kind: TransferKind;
  
  /** Transfer mode (only 'interactive' for SEP-24) */
  mode: TransferMode;
  
  /** Current status in state machine */
  status: TransferStatus;
  
  /** Asset code (e.g., 'USDC', 'BTC') */
  assetCode: string;
  
  /** Asset issuer (for Stellar assets) */
  assetIssuer?: string;
  
  /** Stellar account performing the transfer */
  account: string;
  
  /** Transfer amount (if known) */
  amount?: string;
  
  /** Interactive authentication token */
  interactiveToken?: InteractiveToken;
  
   /** Interactive URL for KYC flow */
   interactiveUrl?: string;
   
   /** URL where user can view transaction details */
   more_info_url?: string;
   
   /** External transaction ID (e.g., banking reference) */
   externalTransactionId?: string;
  
  /** Stellar transaction hash (when on-chain) */
  stellarTransactionId?: string;
  
  /** Status message for user */
  message?: string;
  
  /** Timestamp when transfer was created */
  createdAt: Date;
  
  /** Timestamp of last update */
  updatedAt: Date;
  
  /** Timestamp when transfer completed */
  completedAt?: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to initiate a deposit
 */
export interface DepositRequest {
  /** Asset code to deposit */
  assetCode: string;
  
  /** Asset issuer (for Stellar assets) */
  assetIssuer?: string;
  
  /** Stellar account making the deposit */
  account: string;
  
  /** Optional amount */
  amount?: string;
  
  /** Authentication token (SEP-10) */
  authToken?: string;
  
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * Response from initiating a deposit
 */
export interface DepositResponse {
  /** Transfer ID */
  id: string;
  
  /** Interactive URL for KYC/setup */
  url: string;
  
  /** Type identifier */
  type: 'interactive_customer_info_needed';
}

/**
 * Request to initiate a withdrawal
 */
export interface WithdrawalRequest {
  /** Asset code to withdraw */
  assetCode: string;
  
  /** Asset issuer (for Stellar assets) */
  assetIssuer?: string;
  
  /** Stellar account making the withdrawal */
  account: string;
  
  /** Optional amount */
  amount?: string;
  
  /** Authentication token (SEP-10) */
  authToken?: string;
  
  /** Destination (e.g., bank account, crypto address) */
  dest?: string;
  
  /** Destination type */
  destExtra?: string;
  
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * Response from initiating a withdrawal
 */
export interface WithdrawalResponse {
  /** Transfer ID */
  id: string;
  
  /** Interactive URL for KYC/setup */
  url: string;
  
  /** Type identifier */
  type: 'interactive_customer_info_needed';
}

/**
 * Transfer status response
 */
export interface TransferStatusResponse {
  /** Transfer details */
  transaction: {
    id: string;
    kind: TransferKind;
    status: TransferStatus;
    status_eta?: number;
    amount_in?: string;
    amount_out?: string;
    amount_fee?: string;
    started_at: string;
    completed_at?: string;
    stellar_transaction_id?: string;
    external_transaction_id?: string;
    message?: string;
    refunded?: boolean;
    more_info_url: string;
    to?: string;
    from?: string;
  };
}

/**
 * Options for filtering transfers by account
 */
export interface FindByAccountOptions {
  /** Filter by asset code (e.g., 'USDC', 'BTC') */
  assetCode?: string;
  
  /** Filter by transfer kind (deposit or withdrawal) */
  kind?: TransferKind;
  
  /** Filter out transfers older than this date */
  noOlderThan?: Date;
  
  /** Limit the number of results */
  limit?: number;
}

/**
 * Configuration for SEP-24 transfers
 */
export interface Sep24TransferConfig {
  /** Base URL for the anchor server (e.g., http://localhost:8000) */
  baseUrl?: string;
  
  /** Base URL for interactive flows */
  interactiveUrl: string;
  
  /** Token expiration time in milliseconds */
  tokenExpiration?: number;
  
  /** Supported assets */
  supportedAssets?: string[];
}

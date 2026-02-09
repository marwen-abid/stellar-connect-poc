/**
 * Type definitions for SEP-10 authentication
 */

/**
 * Represents a nonce value used in SEP-10 authentication challenge
 */
export interface Nonce {
  value: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Represents authentication credentials
 */
export interface AuthCredentials {
  accountId: string;
  signature: string;
  timestamp: number;
}

/**
 * Represents an authenticated user token
 */
export interface AuthToken {
  token: string;
  expiresAt: Date;
  accountId: string;
}

/**
 * Configuration for SEP-10 authentication
 */
export interface Sep10Config {
  enabled: boolean;
  url: string;
  signingKey: string;
  nonceExpiration?: number; // in milliseconds
  tokenExpiration?: number; // in milliseconds
}

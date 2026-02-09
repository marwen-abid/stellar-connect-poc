# @stellarconnect/core

Core primitives for Stellar Connect SDK. Provides foundational utilities for building Stellar anchor services and client applications.

## Features

- **Signer Interface** - Wallet-agnostic transaction signing abstraction
- **NetworkClient** - Resilient HTTP client with retry logic and circuit breaker
- **TomlDiscovery** - Stellar.toml fetching and caching service
- **AccountInspector** - Account type detection and authentication path resolution
- **Crypto Utilities** - Platform-agnostic cryptographic functions
- **XDR Codec** - Transaction encoding/decoding helpers

## Installation

```bash
# pnpm
pnpm add @stellarconnect/core

# npm
npm install @stellarconnect/core

# yarn
yarn add @stellarconnect/core
```

## Quick Start

```typescript
import { TomlDiscovery, NetworkClient, AccountInspector } from '@stellarconnect/core';

// Create a network client
const client = new NetworkClient();

// Discover anchor capabilities
const toml = new TomlDiscovery(client);
const anchorInfo = await toml.resolve('example.com');
console.log(anchorInfo.SIGNING_KEY);

// Inspect account type
const inspector = new AccountInspector('https://horizon-testnet.stellar.org');
const details = await inspector.inspect('GABC...');
console.log(details.accountType); // CLASSIC_FUNDED, CLASSIC_UNFUNDED, etc.
```

## API Reference

### Signer Interface

The `Signer` interface provides a wallet-agnostic way to sign transactions. Implement this interface to integrate with any wallet provider.

```typescript
import type { Signer } from '@stellarconnect/core';

interface Signer {
  publicKey: string;
  signTransaction(xdr: string): Promise<string>;
  signMessage?(message: string): Promise<string>;
}

// Check if signer supports message signing (SEP-45)
import { supportsMessageSigning } from '@stellarconnect/core';

if (supportsMessageSigning(signer)) {
  const signature = await signer.signMessage('Hello, Stellar!');
}
```

### NetworkClient

HTTP client with automatic retry, exponential backoff, and circuit breaker pattern.

```typescript
import { NetworkClient } from '@stellarconnect/core';

const client = new NetworkClient({
  timeout: 10000,        // Request timeout in ms (default: 10000)
  maxRetries: 2,         // Max retry attempts (default: 2)
  retryDelay: 1000,      // Base retry delay in ms (default: 1000)
  circuitBreakerThreshold: 5, // Failures before circuit opens (default: 5)
  circuitBreakerWindow: 60000, // Time window in ms (default: 60000)
});

// GET request
const data = await client.get('https://api.example.com/data');

// POST request
const result = await client.post('https://api.example.com/submit', {
  body: { key: 'value' },
  headers: { 'Content-Type': 'application/json' },
});
```

**Features:**
- Automatic retry with exponential backoff
- Per-hostname circuit breaker tracking
- Configurable timeout and retry parameters
- Platform-agnostic (Node.js + browser)

### TomlDiscovery

Service for fetching and caching Stellar.toml files from anchor domains.

```typescript
import { TomlDiscovery } from '@stellarconnect/core';

const discovery = new TomlDiscovery(client, {
  cacheTtl: 300000, // Cache TTL in ms (default: 5 minutes)
});

// Fetch and parse stellar.toml
const anchorInfo = await discovery.resolve('example.com');

// Access anchor information
console.log(anchorInfo.SIGNING_KEY);
console.log(anchorInfo.NETWORK_PASSPHRASE);
console.log(anchorInfo.WEB_AUTH_ENDPOINT);
console.log(anchorInfo.TRANSFER_SERVER_SEP0024);

// Validate required fields
discovery.validate(anchorInfo); // Throws if invalid

// Clear cache
discovery.clearCache('example.com'); // Clear specific domain
discovery.clearCache();              // Clear all
```

### AccountInspector

Determines account type and appropriate authentication method.

```typescript
import { AccountInspector, AccountType, AuthPath } from '@stellarconnect/core';

const inspector = new AccountInspector('https://horizon-testnet.stellar.org');

// Inspect account
const details = await inspector.inspect('GABC...');

console.log(details.accountType); // AccountType enum
console.log(details.authPath);    // AuthPath enum
console.log(details.balances);    // Asset balances
console.log(details.thresholds);  // Signing thresholds
console.log(details.flags);       // Account flags

// Resolve authentication path
const authPath = inspector.resolveAuthPath(
  AccountType.CLASSIC_FUNDED,
  { supportsSep10: true, supportsSep45: false }
);
// Returns: AuthPath.SEP10
```

**Account Types:**
- `CLASSIC_FUNDED` - Traditional Stellar account with XLM balance
- `CLASSIC_UNFUNDED` - Account created but not yet funded
- `SOROBAN_CONTRACT` - Smart contract account (starts with 'C')
- `UNKNOWN` - Unrecognized account format

**Auth Paths:**
- `SEP10` - Web Authentication (challenge-response)
- `SEP45` - Soroban Smart Wallet Auth
- `SEP10_OR_SEP45` - Either method supported
- `UNSUPPORTED` - No supported authentication method

### Crypto Utilities

Platform-agnostic cryptographic functions for Node.js and browser.

```typescript
import { generateRandomBytes, toBase64, fromBase64 } from '@stellarconnect/core';

// Generate random bytes (async in browser)
const nonce = await generateRandomBytes(48);

// Base64 encoding
const encoded = toBase64(new Uint8Array([1, 2, 3]));

// Base64 decoding
const decoded = fromBase64(encoded);
```

### XDR Codec

Transaction encoding, decoding, and inspection utilities.

```typescript
import {
  encodeTransaction,
  decodeTransaction,
  parseOperations,
  getTransactionHash,
  extractSignatures,
  countSignatures,
  isTransactionSigned,
} from '@stellarconnect/core';

// Encode transaction to XDR
const transaction = /* Stellar Transaction object */;
const xdr = encodeTransaction(transaction);

// Decode XDR to transaction
const decoded = decodeTransaction(xdr);

// Extract operations
const operations = parseOperations(transaction);
console.log(operations[0].type); // e.g., 'payment'

// Get transaction hash
const hash = getTransactionHash(transaction);

// Signature inspection
const signatures = extractSignatures(transaction);
const count = countSignatures(transaction);
const isSigned = isTransactionSigned(transaction);
```

## TypeScript Support

This package is written in TypeScript and provides full type definitions.

```typescript
import type {
  Signer,
  NetworkClientConfig,
  RequestOptions,
  AnchorInfo,
  TomlDiscoveryConfig,
  AccountDetails,
  AnchorCapabilities,
  AccountInspectorConfig,
} from '@stellarconnect/core';
```

## Platform Compatibility

- **Node.js**: 18+ (ESM only)
- **Browser**: Modern browsers with ES2020 support
- **TypeScript**: 5.0+

## Dependencies

- `@stellar/stellar-sdk` - Stellar SDK for account and transaction operations
- `toml` - TOML parsing library

## License

MIT

## Related Packages

- [`@stellarconnect/anchor`](../anchor) - Anchor server implementation
- [`@stellarconnect/sdk`](../sdk) - Client SDK for anchor integration
- [`@stellarconnect/signers`](../signers) - Signer implementations

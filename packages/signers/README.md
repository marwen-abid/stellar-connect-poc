# @stellarconnect/signers

Signer utility implementations for Stellar Connect SDK. Provides ready-to-use implementations of the `Signer` interface from `@stellarconnect/core`.

## Features

- **keypairSigner** - Sign transactions with a Stellar secret key
- **callbackSigner** - Wrap custom signing logic into the Signer interface
- TypeScript-first with full type safety
- Compatible with any wallet or signing mechanism

## Installation

```bash
# pnpm
pnpm add @stellarconnect/signers

# npm
npm install @stellarconnect/signers

# yarn
yarn add @stellarconnect/signers
```

## Quick Start

```typescript
import { keypairSigner, callbackSigner } from '@stellarconnect/signers';

// Option 1: Sign with a Stellar secret key
const signer = keypairSigner('SBKNLQC2O3LD4JSJXPCXFYONJJVDOCQULW7IONXCR37BRY45F3JN4SI2');

// Option 2: Wrap custom signing logic
const customSigner = callbackSigner(
  'GABC...', // Your public key
  async (xdr) => {
    // Call your wallet's signing method
    return await myWallet.signTransaction(xdr);
  }
);
```

## API Reference

### keypairSigner(secretKey: string): Signer

Creates a signer from a Stellar secret key (starts with 'S').

**Parameters:**
- `secretKey` - Stellar Ed25519 secret key in StrKey format (56 characters, starts with 'S')

**Returns:** `Signer` - Ready-to-use signer implementation

**Example:**

```typescript
import { keypairSigner } from '@stellarconnect/signers';

const signer = keypairSigner('SBKNLQC2O3LD4JSJXPCXFYONJJVDOCQULW7IONXCR37BRY45F3JN4SI2');

console.log(signer.publicKey);
// Output: GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ

// Sign a transaction
const signedXdr = await signer.signTransaction(transactionXdr);
```

**Error Handling:**

```typescript
try {
  const signer = keypairSigner('invalid-key');
} catch (error) {
  console.error('Invalid secret key format');
}
```

### callbackSigner(publicKey: string, signFn: (xdr: string) => Promise<string>): Signer

Wraps a custom signing function into the Signer interface. Useful for integrating with wallet providers, browser extensions, or hardware wallets.

**Parameters:**
- `publicKey` - Stellar public key (56 characters, starts with 'G')
- `signFn` - Async function that takes XDR and returns signed XDR

**Returns:** `Signer` - Signer that delegates to your custom function

**Example with Freighter Wallet:**

```typescript
import { callbackSigner } from '@stellarconnect/signers';
import freighter from '@stellar/freighter-api';

const signer = callbackSigner(
  userPublicKey,
  async (xdr) => {
    const { signedXDR } = await freighter.signTransaction(xdr, {
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });
    return signedXDR;
  }
);
```

**Example with Custom Logic:**

```typescript
import { callbackSigner } from '@stellarconnect/signers';

const signer = callbackSigner(
  'GABC...',
  async (xdr) => {
    // Add logging
    console.log('Signing transaction:', xdr.substring(0, 20) + '...');
    
    // Call your signing service
    const response = await fetch('/api/sign', {
      method: 'POST',
      body: JSON.stringify({ xdr })
    });
    
    const { signedXdr } = await response.json();
    return signedXdr;
  }
);
```

**Error Handling:**

The callback function should handle errors appropriately. Errors thrown in the callback will be wrapped with context:

```typescript
const signer = callbackSigner('GABC...', async (xdr) => {
  throw new Error('User rejected transaction');
});

try {
  await signer.signTransaction(xdr);
} catch (error) {
  console.error(error.message);
  // Output: "Callback signing failed: User rejected transaction"
}
```

## Use Cases

### Testing

```typescript
import { keypairSigner } from '@stellarconnect/signers';

// Create test signer for automated tests
const testSigner = keypairSigner(process.env.TEST_SECRET_KEY);
```

### Wallet Integration

```typescript
import { callbackSigner } from '@stellarconnect/signers';

// Integrate with browser wallet
const walletSigner = callbackSigner(
  await wallet.getPublicKey(),
  (xdr) => wallet.signTransaction(xdr)
);
```

### Backend Services

```typescript
import { keypairSigner } from '@stellarconnect/signers';

// Server-side signing for automated operations
const serviceSigner = keypairSigner(process.env.SERVICE_SECRET_KEY);
```

## TypeScript Support

This package is written in TypeScript and provides full type definitions.

```typescript
import type { Signer } from '@stellarconnect/core';
import { keypairSigner, callbackSigner } from '@stellarconnect/signers';

// Both return the same Signer interface
const signer1: Signer = keypairSigner('SBKNLQC...');
const signer2: Signer = callbackSigner('GABC...', signFn);
```

## Platform Compatibility

- **Node.js**: 18+ (ESM only)
- **Browser**: Modern browsers with ES2020 support
- **TypeScript**: 5.0+

## Dependencies

- `@stellarconnect/core` - Core primitives and Signer interface
- `@stellar/stellar-sdk` - Stellar SDK for keypair operations

## Security Notes

**Never commit secret keys to version control!**

```typescript
// ✅ Good: Load from environment
const signer = keypairSigner(process.env.STELLAR_SECRET_KEY);

// ❌ Bad: Hard-coded secret
const signer = keypairSigner('SBKNLQC...');
```

**Validate user input before signing:**

```typescript
const signer = callbackSigner(publicKey, async (xdr) => {
  // Decode and inspect transaction before signing
  const tx = decodeTransaction(xdr);
  
  // Validate operations, amounts, destinations, etc.
  if (!isValidTransaction(tx)) {
    throw new Error('Invalid transaction');
  }
  
  return await wallet.signTransaction(xdr);
});
```

## License

MIT

## Related Packages

- [`@stellarconnect/core`](../core) - Core primitives and Signer interface
- [`@stellarconnect/anchor`](../anchor) - Anchor server implementation
- [`@stellarconnect/sdk`](../sdk) - Client SDK for anchor integration

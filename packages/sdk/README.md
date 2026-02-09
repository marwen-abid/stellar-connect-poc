# @stellarconnect/sdk

High-level client SDK for integrating with Stellar anchors. Discover anchor capabilities, authenticate with SEP-10, and manage deposits/withdrawals via SEP-6 and SEP-24.

## Features

- **Anchor Discovery**: Automatic stellar.toml fetching and capability detection
- **SEP-10 Authentication**: Challenge-response authentication flow
- **SEP-24 Support**: Hosted deposit/withdrawal with interactive KYC
- **SEP-6 Support**: Non-interactive deposit/withdrawal API
- **Session Management**: Authenticated sessions with automatic JWT handling
- **Transfer Polling**: Adaptive polling for transfer status updates
- **TypeScript-first**: Full type safety and IntelliSense support

## Installation

```bash
# pnpm
pnpm add @stellarconnect/sdk

# npm
npm install @stellarconnect/sdk

# yarn
yarn add @stellarconnect/sdk
```

## Quick Start

```typescript
import { StellarConnect } from '@stellarconnect/sdk';
import { keypairSigner } from '@stellarconnect/signers';

// 1. Create client
const client = new StellarConnect({
  network: 'testnet', // or 'public'
});

// 2. Discover anchor
const anchor = await client.discoverAnchor('anchor.example.com');
console.log('SEP-10:', anchor.sep10?.endpoint);
console.log('SEP-24:', anchor.sep24?.endpoint);

// 3. Authenticate with SEP-10
const signer = keypairSigner(process.env.STELLAR_SECRET_KEY);
const session = await client.login('anchor.example.com', signer);

// 4. Initiate deposit
const process = await session.deposit({
  assetCode: 'USDC',
  amount: '100',
});

// 5. Handle interactive flow
process.on('interactive', ({ url }) => {
  console.log('Open this URL:', url);
  // Open in popup or redirect user
});

// 6. Monitor status
process.on('statusChange', ({ status }) => {
  console.log('Status:', status);
});

await process.waitForCompletion();
console.log('Deposit complete!');
```

## Core Components

### StellarConnect

Main client for anchor discovery and authentication.

```typescript
import { StellarConnect } from '@stellarconnect/sdk';

const client = new StellarConnect({
  network: 'testnet', // Network: 'testnet' or 'public'
  horizonUrl: 'https://horizon-testnet.stellar.org', // Optional custom Horizon URL
});

// Discover anchor capabilities
const capabilities = await client.discoverAnchor('anchor.example.com');

if (capabilities.sep10) {
  console.log('SEP-10 auth available:', capabilities.sep10.endpoint);
}

if (capabilities.sep24) {
  console.log('SEP-24 deposits available:', capabilities.sep24.endpoint);
}

if (capabilities.sep6) {
  console.log('SEP-6 API available:', capabilities.sep6.endpoint);
}
```

### Session

Authenticated session with deposit/withdrawal capabilities.

```typescript
import type { Session } from '@stellarconnect/sdk';

// Login returns a session
const session: Session = await client.login('anchor.example.com', signer);

// Session properties
console.log(session.anchor.domain); // Anchor domain
console.log(session.jwt); // JWT token
console.log(session.expiresAt); // Token expiration

// Initiate deposit
const depositProcess = await session.deposit({
  assetCode: 'USDC',
  amount: '100',
});

// Initiate withdrawal
const withdrawProcess = await session.withdraw({
  assetCode: 'USDC',
  amount: '50',
  dest: 'bank_account',
  destExtra: { account_number: '123456' },
});
```

### TransferProcess

State machine for monitoring transfer lifecycle.

```typescript
const process = await session.deposit({ assetCode: 'USDC', amount: '100' });

// Event: Interactive URL ready
process.on('interactive', ({ url, id }) => {
  console.log(`Open KYC page: ${url}`);
  window.open(url, '_blank');
});

// Event: Status changed
process.on('statusChange', ({ status, transfer }) => {
  console.log(`Status: ${status}`);
  
  if (status === 'pending_user_transfer_start') {
    console.log('Please send funds to complete deposit');
  }
  
  if (status === 'completed') {
    console.log('Transfer completed!');
  }
});

// Event: Error occurred
process.on('error', ({ error }) => {
  console.error('Transfer failed:', error);
});

// Wait for completion
try {
  const finalStatus = await process.waitForCompletion({
    timeout: 300000, // 5 minutes
    pollingInterval: 5000, // Check every 5 seconds
  });
  
  console.log('Final status:', finalStatus);
} catch (error) {
  console.error('Transfer failed or timed out');
}

// Stop polling manually
process.stop();
```

## Complete Examples

### Deposit Flow (SEP-24 Interactive)

```typescript
import { StellarConnect } from '@stellarconnect/sdk';
import { keypairSigner } from '@stellarconnect/signers';

async function deposit() {
  // 1. Setup
  const client = new StellarConnect({ network: 'testnet' });
  const signer = keypairSigner(process.env.STELLAR_SECRET_KEY);
  
  // 2. Login
  const session = await client.login('anchor.example.com', signer);
  
  // 3. Start deposit
  const process = await session.deposit({
    assetCode: 'USDC',
    amount: '100',
  });
  
  // 4. Handle interactive flow
  process.on('interactive', ({ url }) => {
    // Open in popup or redirect
    window.open(url, 'kyc-popup', 'width=600,height=800');
  });
  
  // 5. Monitor progress
  process.on('statusChange', ({ status }) => {
    document.getElementById('status').textContent = status;
  });
  
  // 6. Wait for completion
  try {
    await process.waitForCompletion({ timeout: 600000 }); // 10 minutes
    alert('Deposit completed successfully!');
  } catch (error) {
    alert('Deposit failed: ' + error.message);
  }
}
```

### Withdrawal Flow (SEP-6 API)

```typescript
async function withdraw() {
  const client = new StellarConnect({ network: 'testnet' });
  const signer = keypairSigner(process.env.STELLAR_SECRET_KEY);
  
  // Login
  const session = await client.login('anchor.example.com', signer);
  
  // Start withdrawal
  const process = await session.withdraw({
    assetCode: 'USDC',
    amount: '50',
    dest: 'bank_account',
    destExtra: {
      account_number: '123456789',
      routing_number: '987654321',
    },
  });
  
  // Monitor status
  process.on('statusChange', ({ status, transfer }) => {
    if (status === 'pending_anchor') {
      console.log('Waiting for anchor to process withdrawal');
    }
    
    if (status === 'pending_user_transfer_start') {
      console.log('Send Stellar payment to:', transfer.withdrawAnchorAccount);
      console.log('Memo:', transfer.withdrawMemo);
    }
    
    if (status === 'completed') {
      console.log('Funds sent to your bank account');
    }
  });
  
  await process.waitForCompletion();
}
```

### React Integration

```typescript
import { useState, useEffect } from 'react';
import { StellarConnect } from '@stellarconnect/sdk';
import { keypairSigner } from '@stellarconnect/signers';

function DepositButton({ anchorDomain, assetCode, amount }) {
  const [status, setStatus] = useState('idle');
  const [interactiveUrl, setInteractiveUrl] = useState(null);
  
  const handleDeposit = async () => {
    try {
      setStatus('authenticating');
      
      const client = new StellarConnect({ network: 'testnet' });
      const signer = keypairSigner(process.env.REACT_APP_SECRET_KEY);
      const session = await client.login(anchorDomain, signer);
      
      setStatus('initiating');
      const process = await session.deposit({ assetCode, amount });
      
      process.on('interactive', ({ url }) => {
        setInteractiveUrl(url);
        setStatus('interactive');
      });
      
      process.on('statusChange', ({ status: transferStatus }) => {
        setStatus(transferStatus);
      });
      
      await process.waitForCompletion();
      setStatus('completed');
    } catch (error) {
      setStatus('error');
      console.error(error);
    }
  };
  
  return (
    <div>
      <button onClick={handleDeposit} disabled={status !== 'idle'}>
        Deposit {amount} {assetCode}
      </button>
      
      <p>Status: {status}</p>
      
      {interactiveUrl && (
        <a href={interactiveUrl} target="_blank">
          Complete KYC
        </a>
      )}
    </div>
  );
}
```

## Authentication

### SEP-10 Flow

```typescript
// Automatic SEP-10 authentication
const session = await client.login('anchor.example.com', signer);

// Manual SEP-10 flow (advanced)
import { authenticateSep10 } from '@stellarconnect/sdk';

const token = await authenticateSep10(
  'https://anchor.example.com/auth',
  signer,
  'Test SDF Network ; September 2015'
);

console.log('JWT:', token.token);
console.log('Expires:', new Date(token.expiresAt));
```

### Session Lifecycle

```typescript
const session = await client.login('anchor.example.com', signer);

// Check if session is still valid
const isValid = session.expiresAt > Date.now();

if (!isValid) {
  // Re-authenticate
  session = await client.login('anchor.example.com', signer);
}
```

## Transfer Polling

The SDK uses adaptive polling with exponential backoff:

```typescript
const process = await session.deposit({ assetCode: 'USDC', amount: '100' });

// Default polling behavior:
// - Starts at 5 seconds
// - Doubles on each poll (5s, 10s, 20s...)
// - Max interval: 60 seconds
// - Runs until completion or error

// Custom polling config
await process.waitForCompletion({
  pollingInterval: 3000, // Start at 3 seconds
  maxInterval: 30000,    // Max 30 seconds
  timeout: 600000,       // 10 minute timeout
});
```

## Error Handling

```typescript
try {
  const session = await client.login('anchor.example.com', signer);
  const process = await session.deposit({ assetCode: 'USDC', amount: '100' });
  await process.waitForCompletion();
} catch (error) {
  if (error.message.includes('TOML')) {
    console.error('Failed to discover anchor');
  } else if (error.message.includes('challenge')) {
    console.error('SEP-10 authentication failed');
  } else if (error.message.includes('Unsupported asset')) {
    console.error('Asset not supported by anchor');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## TypeScript Support

Full TypeScript definitions:

```typescript
import type {
  Network,
  StellarConnectConfig,
  AnchorCapabilities,
  Session,
  TransferOptions,
  TransferProcess,
  TransferStatus,
  TransferStatusUpdate,
  Sep10Challenge,
  Sep10Token,
} from '@stellarconnect/sdk';
```

## Testing

Mock anchor for testing:

```typescript
import { StellarConnect } from '@stellarconnect/sdk';
import { keypairSigner } from '@stellarconnect/signers';

// Use testnet for development
const client = new StellarConnect({ network: 'testnet' });

// Test with a known anchor
const testAnchor = 'testanchor.stellar.org';
const testSigner = keypairSigner(process.env.TEST_SECRET_KEY);

const session = await client.login(testAnchor, testSigner);
expect(session.jwt).toBeTruthy();
```

## Platform Compatibility

- **Node.js**: 18+ (ESM only)
- **Browser**: Modern browsers with ES2020 support
- **React**: 18+
- **TypeScript**: 5.0+

## Dependencies

- `@stellarconnect/core` - Core primitives

## Anchor Compatibility

This SDK works with any anchor implementing:
- SEP-1 (Stellar.toml)
- SEP-10 (Web Authentication)
- SEP-24 (Hosted Deposit/Withdrawal) - optional
- SEP-6 (Deposit/Withdrawal API) - optional

Test with stellar-anchor-tests for compliance.

## License

MIT

## Related Packages

- [`@stellarconnect/core`](../core) - Core primitives
- [`@stellarconnect/anchor`](../anchor) - Anchor server implementation
- [`@stellarconnect/signers`](../signers) - Signer utilities

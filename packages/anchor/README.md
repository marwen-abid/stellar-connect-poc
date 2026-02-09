# @stellarconnect/anchor

Stellar Anchor Server framework implementing SEP-1, SEP-6, SEP-10, and SEP-24 protocols. Stand up a compliant anchor service in ~40 lines of code.

## Features

- **SEP-1**: Automatic stellar.toml generation from config
- **SEP-6**: Non-interactive deposit/withdrawal API with hooks
- **SEP-10**: Web Authentication (challenge-response) with JWT
- **SEP-24**: Hosted deposit/withdrawal — you provide the interactive URL
- **Express-native**: Router factories mount directly onto your Express app
- **TypeScript-first**: Full type safety and IntelliSense support
- **Hooks**: Customize behavior without reimplementing SEP compliance logic
- **In-memory storage**: Built-in `InMemoryTransferStore` for development

## Installation

```bash
# pnpm
pnpm add @stellarconnect/anchor

# npm
npm install @stellarconnect/anchor

# yarn
yarn add @stellarconnect/anchor
```

**Peer dependencies**: `express`, `@stellar/stellar-sdk`

## Quick Start

A fully SEP-compliant anchor server in ~40 lines:

```typescript
import express from 'express';
import cors from 'cors';
import { AnchorServer } from '@stellarconnect/anchor';

const anchor = new AnchorServer({
  secretKey: process.env.STELLAR_SIGNING_KEY!, // Stellar secret key (starts with 'S')
  jwtSecret: process.env.JWT_SECRET!, // >= 32 characters
  domain: 'localhost:8000',
  network: 'testnet',
  assets: {
    native: {
      deposit: { enabled: true, minAmount: 1, maxAmount: 10000 },
      withdraw: { enabled: true, minAmount: 1, maxAmount: 10000 },
    },
    USDC: {
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      name: 'USD Coin',
      desc: 'USD Coin on Stellar',
      deposit: { enabled: true, minAmount: 1, maxAmount: 10000 },
      withdraw: { enabled: true, minAmount: 1, maxAmount: 10000 },
    },
  },
});

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use(anchor.toml()); // SEP-1: /.well-known/stellar.toml
app.use('/auth', anchor.sep10()); // SEP-10: Web Authentication
app.use('/sep24', anchor.sep24({ interactive: { url: 'http://localhost:8000/interactive-flow' } })); // SEP-24
app.use('/', anchor.sep24({ interactive: { url: 'http://localhost:8000/interactive-flow' } })); // SEP-24 pages
app.use('/sep6', anchor.sep6()); // SEP-6: Non-interactive API

app.listen(8000, () => console.log('Anchor running on http://localhost:8000'));
```

That's it. The framework handles SEP-10 challenge/response, SEP-24 interactive flow, SEP-6 info endpoint, TOML generation, JWT auth middleware, and transfer lifecycle management.

## Configuration

### `AnchorServerConfig`

```typescript
interface AnchorServerConfig {
  /** Stellar secret key for signing SEP-10 challenges (starts with 'S') */
  secretKey: string;

  /** Secret used to sign and verify JWTs (>= 32 characters) */
  jwtSecret: string;

  /** Domain this anchor operates on (e.g., 'myanchor.com' or 'localhost:8000') */
  domain: string;

  /** Network to operate on — passphrase is derived internally */
  network: 'testnet' | 'public' | 'futurenet' | 'standalone' | 'mainnet';

  /** Asset configuration — drives TOML, /info responses, and validation */
  assets: Record<string, AssetConfig>;

  /** Custom transfer store (defaults to InMemoryTransferStore) */
  store?: TransferStore;

  /** Organization metadata for TOML [DOCUMENTATION] section */
  meta?: AnchorMeta;
}
```

The constructor validates all fields at startup: secret key format, JWT secret length, asset presence, and network value. Invalid config throws immediately.

### `AssetConfig`

```typescript
interface AssetConfig {
  issuer?: string; // Stellar asset issuer (omit for native XLM)
  name?: string; // Human-readable name
  desc?: string; // Description
  displayDecimals?: number; // Decimal places to display (default: 7)
  status?: 'live' | 'test' | 'dead' | 'private';
  deposit?: AssetOperationConfig;
  withdraw?: AssetOperationConfig;
}

interface AssetOperationConfig {
  enabled: boolean;
  minAmount?: number;
  maxAmount?: number;
  feeFixed?: number;
  feePercent?: number; // 0-100
  fields?: Record<string, FieldConfig>; // KYC fields for SEP-24
}
```

### `AnchorMeta`

```typescript
interface AnchorMeta {
  orgName?: string;
  orgUrl?: string;
  orgDescription?: string;
  orgLogo?: string;
  orgPhysicalAddress?: string;
  orgOfficialEmail?: string;
  orgSupportEmail?: string;
}
```

These camelCase fields are mapped to TOML's `[DOCUMENTATION]` section automatically (`orgName` → `ORG_NAME`).

## Router Factory Methods

`AnchorServer` exposes four router factory methods. Each returns an Express `Router` you mount with `app.use()`.

### `anchor.toml()` — SEP-1

Serves `GET /.well-known/stellar.toml` with content auto-generated from your config. TOML output is cached and includes:

- `NETWORK_PASSPHRASE`
- `SIGNING_KEY` (derived from `secretKey`)
- `WEB_AUTH_ENDPOINT`, `TRANSFER_SERVER_SEP0024`, `TRANSFER_SERVER` (based on which SEP routers are mounted)
- `[[CURRENCIES]]` entries from `assets`
- `[DOCUMENTATION]` from `meta`

```typescript
app.use(anchor.toml());
```

### `anchor.sep10()` — SEP-10 Web Authentication

Mounts `GET /` (challenge creation) and `POST /` (challenge verification → JWT).

```typescript
app.use('/auth', anchor.sep10());
```

Clients authenticate via standard SEP-10 flow:

1. `GET /auth?account=G...` → receive challenge XDR
2. Sign the challenge with the account's secret key
3. `POST /auth` with `{ transaction: "<signed XDR>" }` → receive JWT

### `anchor.sep24(hooks)` — SEP-24 Interactive

Mounts all SEP-24 endpoints. You **must** provide an `interactive.url` pointing to your own interactive flow page. The library's `/interactive` endpoint redirects to your URL with `token` and `transaction_id` query parameters.

```typescript
const sep24Hooks = { interactive: { url: 'https://myanchor.com/interactive-flow' } };

// Mount SEP-24 API endpoints
app.use('/sep24', anchor.sep24(sep24Hooks));

// Mount interactive flow pages (must be at root for default URLs to work)
app.use('/', anchor.sep24(sep24Hooks));
```

**Endpoints mounted:**

- `GET /info` — Asset capabilities
- `POST /transactions/deposit/interactive` — Initiate deposit (JWT required)
- `POST /transactions/withdraw/interactive` — Initiate withdrawal (JWT required)
- `GET /transaction` — Single transaction status (JWT required)
- `GET /transactions` — Transaction history (JWT required)
- `GET /interactive` — Redirects to your interactive URL with `token` and `transaction_id` params
- `POST /interactive/complete` — Complete interactive flow
- `GET /transaction/more_info` — Transaction details page

### `anchor.sep6(hooks?)` — SEP-6 Non-Interactive

Mounts SEP-6 endpoints for programmatic deposits/withdrawals.

```typescript
app.use('/sep6', anchor.sep6());
```

**Endpoints mounted:**

- `GET /info` — Asset capabilities
- `GET /deposit` — Initiate deposit (JWT required)
- `GET /withdraw` — Initiate withdrawal (JWT required)

## Hooks

Hooks let you customize SEP behavior without reimplementing the compliance boilerplate. They're optional — the framework provides sensible defaults for development.

### SEP-24 Hooks

```typescript
interface Sep24Hooks {
  interactive: { url: string }; // Required — your interactive flow URL
  onDeposit?: (context: DepositContext) => Promise<DepositResult | void>;
  onWithdraw?: (context: WithdrawContext) => Promise<WithdrawResult | void>;
  onInteractiveComplete?: (context: InteractiveCompleteContext) => Promise<void>;
  renderMoreInfo?: (transfer: Transfer) => string; // Custom more_info page
}
```

**Example: Custom deposit logic**

```typescript
app.use(
  '/sep24',
  anchor.sep24({
    interactive: { url: 'https://myanchor.com/interactive-flow' },
    onDeposit: async (ctx) => {
      console.log(`Deposit initiated: ${ctx.assetCode} for ${ctx.account}`);
      // Optionally return a custom interactive URL
      return { interactiveUrl: 'https://myanchor.com/kyc' };
    },
    onInteractiveComplete: async (ctx) => {
      // User finished KYC — trigger your deposit pipeline
      await ctx.updateStatus('pending_user_transfer_start');
    },
  })
);
```

**Deposit/Withdraw context:**

```typescript
interface DepositContext {
  transfer: Transfer; // The created transfer record
  assetCode: string;
  account: string; // Stellar account (from JWT)
  amount?: string;
  params: Record<string, unknown>;
  store: TransferStore; // Direct store access
  updateStatus: (status: string, message?: string) => Promise<void>;
  setStellarTransactionId: (txId: string) => Promise<void>;
}
```

### SEP-6 Hooks

SEP-6 hooks are **required** if you mount SEP-6, since non-interactive flows need you to provide deposit instructions and withdrawal accounts.

```typescript
interface Sep6Hooks {
  onDeposit: (context: Sep6DepositContext) => Promise<Sep6DepositResult>;
  onWithdraw: (context: Sep6WithdrawContext) => Promise<Sep6WithdrawResult>;
}
```

**Example: SEP-6 deposit**

```typescript
app.use(
  '/sep6',
  anchor.sep6({
    onDeposit: async (ctx) => {
      return {
        how: 'Send USD to: Bank of Example, Acct #12345, Routing #67890',
        eta: 3600,
        minAmount: 10,
        maxAmount: 10000,
      };
    },
    onWithdraw: async (ctx) => {
      return {
        accountId: anchor.publicKey,
        memoType: 'text',
        memo: ctx.transfer.id,
        eta: 7200,
      };
    },
  })
);
```

## TransferStore

The `TransferStore` interface manages transfer lifecycle. The library ships with `InMemoryTransferStore` for development; implement this interface for production storage.

```typescript
interface TransferStore {
  create(transfer: Transfer): Promise<void>;
  getById(id: string): Promise<Transfer | null>;
  listByAccount(account: string, options?: FindByAccountOptions): Promise<Transfer[]>;
  getByInteractiveToken(token: string): Promise<Transfer | null>;
  getByStellarTransactionId(stellarTxId: string): Promise<Transfer | null>;
  getByExternalTransactionId(externalTxId: string): Promise<Transfer | null>;
  update(id: string, updates: Partial<Transfer>): Promise<Transfer | null>;
  delete(id: string): Promise<boolean>;
}
```

**Custom store example:**

```typescript
import type { TransferStore, Transfer, FindByAccountOptions } from '@stellarconnect/anchor';

class PostgresTransferStore implements TransferStore {
  async create(transfer: Transfer): Promise<void> {
    await db.transfers.insert(transfer);
  }

  async getById(id: string): Promise<Transfer | null> {
    return await db.transfers.findOne({ id });
  }

  async listByAccount(account: string, options?: FindByAccountOptions): Promise<Transfer[]> {
    const query = db.transfers.where({ account });
    if (options?.assetCode) query.andWhere({ assetCode: options.assetCode });
    if (options?.kind) query.andWhere({ kind: options.kind });
    if (options?.limit) query.limit(options.limit);
    return await query.orderBy('createdAt', 'desc');
  }

  async getByInteractiveToken(token: string): Promise<Transfer | null> {
    return await db.transfers.findOne({ 'interactiveToken.token': token });
  }

  async getByStellarTransactionId(id: string): Promise<Transfer | null> {
    return await db.transfers.findOne({ stellarTransactionId: id });
  }

  async getByExternalTransactionId(id: string): Promise<Transfer | null> {
    return await db.transfers.findOne({ externalTransactionId: id });
  }

  async update(id: string, updates: Partial<Transfer>): Promise<Transfer | null> {
    return await db.transfers.updateAndReturn({ id }, { ...updates, updatedAt: new Date() });
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.transfers.delete({ id });
    return result.rowCount > 0;
  }
}

// Use it:
const anchor = new AnchorServer({
  // ...
  store: new PostgresTransferStore(),
});
```

## Error Handling

The framework uses `SepError` for structured error responses. Errors thrown inside hooks are caught and returned as JSON:

```json
{ "error": "Unsupported asset", "code": "bad_request" }
```

**Factory functions:**

```typescript
import {
  SepError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
} from '@stellarconnect/anchor';

// In a hook:
throw badRequest('Unsupported asset code');
throw unauthorized('Invalid token');
throw notFound('Transaction not found');

// Custom error:
throw new SepError('Rate limited', 'rate_limit', 429);
```

## AnchorServer Properties

```typescript
const anchor = new AnchorServer(config);

anchor.publicKey; // Stellar public key (derived from secretKey)
anchor.domain; // Domain string
anchor.network; // Network name
anchor.networkPassphrase; // Full network passphrase
anchor.store; // TransferStore instance
anchor.authIssuer; // AuthIssuer instance (for advanced use)
anchor.transferManager; // TransferManager instance (for advanced use)
anchor.mountedModules; // Set<'sep10' | 'sep24' | 'sep6'>
anchor.config; // Raw AnchorServerConfig

anchor.destroy(); // Clean up resources (clears nonce store interval)
```

## SEP-24 Interactive Flow

You must provide your own interactive URL when mounting SEP-24. The library's `/interactive` endpoint redirects to your URL with `token` and `transaction_id` query parameters, which your page uses to complete the flow.

1. Client calls `POST /sep24/transactions/deposit/interactive` with JWT
2. Server creates transfer, returns `{ type, url, id }`
3. Client opens URL in popup/iframe → redirects to your interactive page
4. Your page collects any required info and calls `POST /interactive/complete`
5. Transfer status transitions to `pending_user_transfer_start`
6. Client polls `GET /sep24/transaction?id=...` for updates

```typescript
anchor.sep24({
  interactive: { url: 'https://myanchor.com/kyc' },
  onInteractiveComplete: async (ctx) => {
    // Validate KYC, then:
    await ctx.updateStatus('pending_user_transfer_start');
  },
});
```

## Compliance Testing

Validate your anchor against the official Stellar compliance suite:

```bash
# Start your server
STELLAR_SIGNING_KEY=SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K \
JWT_SECRET=test-secret-key-minimum-32-characters-required-for-security \
PORT=8000 node dist/index.js

# Run tests (in another terminal)
docker run --network host stellar/anchor-tests:latest \
  --home-domain http://localhost:8000 --seps 1 10 24
```

Expected: 55/55 tests pass.

## TypeScript Support

All types are exported:

```typescript
import type {
  AnchorServerConfig,
  AssetConfig,
  AssetOperationConfig,
  AnchorMeta,
  Sep24Hooks,
  Sep6Hooks,
  DepositContext,
  WithdrawContext,
  InteractiveCompleteContext,
  Sep6DepositContext,
  Sep6DepositResult,
  Sep6WithdrawContext,
  Sep6WithdrawResult,
  Transfer,
  TransferStore,
  TransferStatus,
  TransferKind,
  SepError,
} from '@stellarconnect/anchor';
```

## Platform Compatibility

- **Node.js**: 18+ (ESM only)
- **TypeScript**: 5.0+
- **Express**: 4.x (peer dependency)
- **Stellar SDK**: `@stellar/stellar-sdk` (peer dependency)

## Security Best Practices

### Protect Secret Keys

```typescript
// ✅ Good: Load from environment
const anchor = new AnchorServer({
  secretKey: process.env.STELLAR_SIGNING_KEY!,
  jwtSecret: process.env.JWT_SECRET!,
  // ...
});

// ❌ Bad: Hard-coded secrets
const anchor = new AnchorServer({ secretKey: 'SBKNLQC...', ... });
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.use('/auth', authLimiter, anchor.sep10());
```

## Dependencies

- `@stellarconnect/core` — Core primitives
- `@stellar/stellar-sdk` — Stellar SDK (peer)
- `jsonwebtoken` — JWT signing/verification
- `multer` — Multipart form parsing for SEP-24

## License

MIT

## Related Packages

- [`@stellarconnect/core`](../core) — Core primitives
- [`@stellarconnect/sdk`](../sdk) — Client SDK
- [`@stellarconnect/signers`](../signers) — Signer utilities

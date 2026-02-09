# Stellar Anchor Server Example

A complete, SEP-compliant anchor server built with `@stellarconnect/anchor` in ~60 lines of code. Implements SEP-1, SEP-6, SEP-10, and SEP-24.

## Setup

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Docker (for compliance testing)

### Installation

```bash
cd examples/anchor-server
pnpm install
```

### Environment Variables

| Variable              | Required | Description                           |
| --------------------- | -------- | ------------------------------------- |
| `STELLAR_SIGNING_KEY` | Yes      | Stellar secret key (starts with `S`)  |
| `JWT_SECRET`          | Yes      | JWT signing secret (>= 32 characters) |
| `PORT`                | No       | Server port (default: 8000)           |

### Development

```bash
STELLAR_SIGNING_KEY=SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K \
JWT_SECRET=test-secret-key-minimum-32-characters-required-for-security \
pnpm dev
```

### Build & Run

```bash
pnpm build

STELLAR_SIGNING_KEY=SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K \
JWT_SECRET=test-secret-key-minimum-32-characters-required-for-security \
PORT=8000 node dist/index.js
```

## Endpoints

| Endpoint                                        | SEP    | Description                  |
| ----------------------------------------------- | ------ | ---------------------------- |
| `GET /health`                                   | —      | Health check                 |
| `GET /.well-known/stellar.toml`                 | SEP-1  | Anchor discovery             |
| `GET /auth`                                     | SEP-10 | Authentication challenge     |
| `POST /auth`                                    | SEP-10 | Challenge verification → JWT |
| `GET /sep24/info`                               | SEP-24 | Asset capabilities           |
| `POST /sep24/transactions/deposit/interactive`  | SEP-24 | Initiate deposit             |
| `POST /sep24/transactions/withdraw/interactive` | SEP-24 | Initiate withdrawal          |
| `GET /sep24/transaction`                        | SEP-24 | Transaction status           |
| `GET /sep24/transactions`                       | SEP-24 | Transaction history          |
| `GET /interactive`                              | SEP-24 | Interactive flow page        |
| `GET /sep6/info`                                | SEP-6  | Asset capabilities           |
| `GET /sep6/deposit`                             | SEP-6  | Non-interactive deposit      |
| `GET /sep6/withdraw`                            | SEP-6  | Non-interactive withdrawal   |

## Compliance Testing

Run the official Stellar anchor test suite:

```bash
# Terminal 1: Start server
STELLAR_SIGNING_KEY=SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K \
JWT_SECRET=test-secret-key-minimum-32-characters-required-for-security \
PORT=8000 node dist/index.js

# Terminal 2: Run tests
docker run --network host stellar/anchor-tests:latest \
  --home-domain http://localhost:8000 --seps 1 10 24
```

Expected: 55/55 tests pass.

## Architecture

The entire server lives in a single file:

- `src/index.ts` — Express app setup + `AnchorServer` configuration (~60 lines)

The `@stellarconnect/anchor` framework handles all SEP compliance logic internally. The server only needs to:

1. Provide a config object (secret key, JWT secret, domain, network, assets)
2. Mount the router factories (`anchor.toml()`, `anchor.sep10()`, `anchor.sep24({ interactive: { url } })`, `anchor.sep6()`)

### Supported Assets

- **native** (XLM) — Deposit and withdrawal
- **USDC** — USD Coin on Stellar testnet
- **SRT** — Stellar Reference Token

### Customization

To add custom business logic (KYC, deposit instructions, etc.), pass hooks to the router factories:

```typescript
app.use(
  '/sep24',
  anchor.sep24({
    interactive: { url: 'http://localhost:8000/interactive-flow' },
    onDeposit: async (ctx) => {
      // Custom deposit logic
    },
    onInteractiveComplete: async (ctx) => {
      await ctx.updateStatus('pending_user_transfer_start');
    },
  })
);
```

See the [`@stellarconnect/anchor` README](../../packages/anchor/README.md) for full hook documentation.

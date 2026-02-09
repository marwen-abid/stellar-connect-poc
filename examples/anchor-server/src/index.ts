import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AnchorServer } from '@stellarconnect/anchor';

dotenv.config();

if (!process.env.STELLAR_SIGNING_KEY || !process.env.JWT_SECRET) {
  console.error('ERROR: STELLAR_SIGNING_KEY and JWT_SECRET are required');
  process.exit(1);
}

const PORT = process.env.PORT || 8000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const anchor = new AnchorServer({
  secretKey: process.env.STELLAR_SIGNING_KEY,
  jwtSecret: process.env.JWT_SECRET,
  domain: `localhost:${PORT}`,
  network: 'testnet',
  assets: {
    native: {
      deposit: { enabled: true, minAmount: 1, maxAmount: 10000 },
      withdraw: { enabled: true, minAmount: 1, maxAmount: 10000 },
    },
    USDC: {
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      name: 'USD Coin',
      desc: 'Test USDC for Stellar testnet',
      deposit: { enabled: true, minAmount: 1, maxAmount: 10000 },
      withdraw: { enabled: true, minAmount: 1, maxAmount: 10000 },
    },
    SRT: {
      issuer: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
      name: 'SRT Token',
      desc: 'Test token for Stellar testnet',
      deposit: { enabled: true, minAmount: 1, maxAmount: 10000 },
      withdraw: { enabled: true, minAmount: 1, maxAmount: 10000 },
    },
  },
});

const app: Express = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/interactive-flow', (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'interactive.html'));
});

const sep24Hooks = {
  interactive: { url: `http://localhost:${PORT}/interactive-flow` },
};

app.use(anchor.toml());
app.use('/auth', anchor.sep10());
app.use('/sep24', anchor.sep24(sep24Hooks));
app.use('/', anchor.sep24(sep24Hooks));
app.use('/sep6', anchor.sep6());

app.listen(PORT, () => {
  console.log(`Anchor server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`TOML: http://localhost:${PORT}/.well-known/stellar.toml`);
});

export default app;

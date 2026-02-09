import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { AnchorServer } from '../anchor-server.js';
import type { AnchorServerConfig } from '../config/types.js';
import type { Router } from 'express';

describe('SEP-10 Router', () => {
  const TEST_SECRET_KEY = 'SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K';
  const TEST_JWT_SECRET = 'test-secret-key-minimum-32-characters-required-for-security';

  let anchor: AnchorServer;
  let router: Router;

  beforeEach(() => {
    const config: AnchorServerConfig = {
      secretKey: TEST_SECRET_KEY,
      jwtSecret: TEST_JWT_SECRET,
      domain: 'localhost:8000',
      network: 'testnet',
      assets: {
        USDC: {
          deposit: { enabled: true },
          withdraw: { enabled: true },
        },
      },
    };

    anchor = new AnchorServer(config);
    router = anchor.sep10();
  });

  describe('router creation', () => {
    it('returns Express Router instance', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(router.stack).toBeDefined();
    });

    it('mounts GET endpoint for challenge', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const getRoute = routes.find((r: any) => r.path === '/' && r.methods.includes('get'));
      expect(getRoute).toBeDefined();
    });

    it('mounts POST endpoint for verification', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const postRoute = routes.find((r: any) => r.path === '/' && r.methods.includes('post'));
      expect(postRoute).toBeDefined();
    });
  });

  describe('integration with AnchorServer', () => {
    it('uses authIssuer from anchor server', () => {
      expect(anchor.authIssuer).toBeDefined();
      expect(anchor.authIssuer.createChallenge).toBeDefined();
      expect(anchor.authIssuer.verifyChallenge).toBeDefined();
    });

    it('router factory can be called multiple times', () => {
      const router1 = anchor.sep10();
      const router2 = anchor.sep10();

      expect(router1).toBeDefined();
      expect(router2).toBeDefined();
      expect(router1).not.toBe(router2);
    });
  });

  describe('module mounting tracking', () => {
    it('marks sep10 as mounted when router created', () => {
      const config: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: { deposit: { enabled: true }, withdraw: { enabled: true } },
        },
      };

      const newAnchor = new AnchorServer(config);
      expect(newAnchor.mountedModules.has('sep10')).toBe(false);

      newAnchor.sep10();
      expect(newAnchor.mountedModules.has('sep10')).toBe(true);
    });
  });

  describe('error handling configuration', () => {
    it('router is configured to handle errors', () => {
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });

  describe('authIssuer integration', () => {
    it('authIssuer createChallenge is callable', async () => {
      const testKeypair = Keypair.random();
      const testAccount = testKeypair.publicKey();

      const challenge = await anchor.authIssuer.createChallenge(testAccount);

      expect(challenge).toBeDefined();
      expect(challenge).toHaveProperty('transaction');
      expect(challenge).toHaveProperty('network_passphrase');
      expect(challenge.network_passphrase).toBe('Test SDF Network ; September 2015');
    });

    it('authIssuer verifyChallenge is callable', async () => {
      const testKeypair = Keypair.random();
      const testAccount = testKeypair.publicKey();

      const challenge = await anchor.authIssuer.createChallenge(testAccount);

      const { TransactionBuilder, Networks, Transaction } = await import('@stellar/stellar-sdk');
      const tx = TransactionBuilder.fromXDR(challenge.transaction, Networks.TESTNET);
      tx.sign(testKeypair);
      const signedTx = tx.toXDR();

      const result = await anchor.authIssuer.verifyChallenge(signedTx);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });
  });

  describe('configuration validation', () => {
    it('requires valid anchor server instance', () => {
      expect(() => anchor.sep10()).not.toThrow();
    });

    it('network passphrase matches anchor config', () => {
      expect(anchor.networkPassphrase).toBe('Test SDF Network ; September 2015');
    });
  });
});

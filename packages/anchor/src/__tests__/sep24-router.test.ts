import { describe, it, expect, beforeEach } from 'vitest';
import { AnchorServer } from '../anchor-server.js';
import type { AnchorServerConfig } from '../config/types.js';
import type { Router } from 'express';

describe('SEP-24 Router', () => {
  const TEST_SECRET_KEY = 'SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K';
  const TEST_JWT_SECRET = 'test-secret-key-minimum-32-characters-required-for-security';

  let anchor: AnchorServer;
  let router: Router;

  const sep24Hooks = {
    interactive: { url: 'https://example.com/interactive' },
  };

  beforeEach(() => {
    const config: AnchorServerConfig = {
      secretKey: TEST_SECRET_KEY,
      jwtSecret: TEST_JWT_SECRET,
      domain: 'localhost:8000',
      network: 'testnet',
      assets: {
        USDC: {
          deposit: { enabled: true, minAmount: 1, maxAmount: 10000, feeFixed: 0, feePercent: 0 },
          withdraw: { enabled: true, minAmount: 1, maxAmount: 10000, feeFixed: 0.5, feePercent: 1 },
        },
        BTC: {
          deposit: { enabled: false },
          withdraw: { enabled: true, minAmount: 0.001, maxAmount: 10, feeFixed: 0, feePercent: 0 },
        },
      },
    };

    anchor = new AnchorServer(config);
    router = anchor.sep24(sep24Hooks);
  });

  describe('router creation', () => {
    it('returns Express Router instance', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(router.stack).toBeDefined();
    });

    it('mounts GET /info endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const infoRoute = routes.find((r: any) => r.path === '/info' && r.methods.includes('get'));
      expect(infoRoute).toBeDefined();
    });

    it('mounts POST /transactions/deposit/interactive endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const depositRoute = routes.find(
        (r: any) => r.path === '/transactions/deposit/interactive' && r.methods.includes('post')
      );
      expect(depositRoute).toBeDefined();
    });

    it('mounts POST /transactions/withdraw/interactive endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const withdrawRoute = routes.find(
        (r: any) => r.path === '/transactions/withdraw/interactive' && r.methods.includes('post')
      );
      expect(withdrawRoute).toBeDefined();
    });

    it('mounts GET /transaction endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const transactionRoute = routes.find(
        (r: any) => r.path === '/transaction' && r.methods.includes('get')
      );
      expect(transactionRoute).toBeDefined();
    });

    it('mounts GET /transactions endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const transactionsRoute = routes.find(
        (r: any) => r.path === '/transactions' && r.methods.includes('get')
      );
      expect(transactionsRoute).toBeDefined();
    });

    it('mounts GET /interactive endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const interactiveRoute = routes.find(
        (r: any) => r.path === '/interactive' && r.methods.includes('get')
      );
      expect(interactiveRoute).toBeDefined();
    });

    it('mounts POST /interactive/complete endpoint', () => {
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const completeRoute = routes.find(
        (r: any) => r.path === '/interactive/complete' && r.methods.includes('post')
      );
      expect(completeRoute).toBeDefined();
    });
  });

  describe('integration with AnchorServer', () => {
    it('uses transferManager from anchor server', () => {
      expect(anchor.transferManager).toBeDefined();
      expect(anchor.transferManager.initiateDeposit).toBeDefined();
      expect(anchor.transferManager.initiateWithdraw).toBeDefined();
    });

    it('uses config assets for info generation', () => {
      expect(anchor.config.assets).toBeDefined();
      expect(anchor.config.assets.USDC).toBeDefined();
      expect(anchor.config.assets.BTC).toBeDefined();
    });

    it('router factory can be called multiple times', () => {
      const router1 = anchor.sep24(sep24Hooks);
      const router2 = anchor.sep24(sep24Hooks);

      expect(router1).toBeDefined();
      expect(router2).toBeDefined();
      expect(router1).not.toBe(router2);
    });
  });

  describe('module mounting tracking', () => {
    it('marks sep24 as mounted when router created', () => {
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
      expect(newAnchor.mountedModules.has('sep24')).toBe(false);

      newAnchor.sep24(sep24Hooks);
      expect(newAnchor.mountedModules.has('sep24')).toBe(true);
    });
  });

  describe('asset configuration', () => {
    it('includes only enabled deposit assets in config', () => {
      const usdcDeposit = anchor.config.assets.USDC.deposit;
      expect(usdcDeposit).toBeDefined();
      expect(usdcDeposit?.enabled).toBe(true);

      const btcDeposit = anchor.config.assets.BTC.deposit;
      expect(btcDeposit).toBeDefined();
      expect(btcDeposit?.enabled).toBe(false);
    });

    it('includes only enabled withdraw assets in config', () => {
      const usdcWithdraw = anchor.config.assets.USDC.withdraw;
      expect(usdcWithdraw).toBeDefined();
      expect(usdcWithdraw?.enabled).toBe(true);

      const btcWithdraw = anchor.config.assets.BTC.withdraw;
      expect(btcWithdraw).toBeDefined();
      expect(btcWithdraw?.enabled).toBe(true);
    });

    it('asset config includes min/max amounts', () => {
      const usdcDeposit = anchor.config.assets.USDC.deposit;
      expect(usdcDeposit?.minAmount).toBe(1);
      expect(usdcDeposit?.maxAmount).toBe(10000);

      const btcWithdraw = anchor.config.assets.BTC.withdraw;
      expect(btcWithdraw?.minAmount).toBe(0.001);
      expect(btcWithdraw?.maxAmount).toBe(10);
    });

    it('asset config includes fees', () => {
      const usdcDeposit = anchor.config.assets.USDC.deposit;
      expect(usdcDeposit?.feeFixed).toBe(0);
      expect(usdcDeposit?.feePercent).toBe(0);

      const usdcWithdraw = anchor.config.assets.USDC.withdraw;
      expect(usdcWithdraw?.feeFixed).toBe(0.5);
      expect(usdcWithdraw?.feePercent).toBe(1);
    });
  });

  describe('configuration validation', () => {
    it('throws when called without hooks', () => {
      expect(() => (anchor as any).sep24()).toThrow('interactive.url');
    });

    it('throws when called without interactive url', () => {
      expect(() => anchor.sep24({ interactive: { url: '' } })).toThrow('interactive.url');
    });

    it('accepts hooks with interactive url', () => {
      const hooks = {
        interactive: { url: 'https://example.com/kyc' },
      };

      expect(() => anchor.sep24(hooks)).not.toThrow();
    });
  });
});

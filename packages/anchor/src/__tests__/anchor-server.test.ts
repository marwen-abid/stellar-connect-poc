import { describe, it, expect } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { AnchorServer } from '../anchor-server.js';
import type { AnchorServerConfig } from '../config/types.js';

describe('AnchorServer', () => {
  const validConfig: AnchorServerConfig = {
    domain: 'myanchor.com',
    secretKey: 'SDMUBTMJZPSQZBJVXBNDZ6ELWHFPFMLO3J63VS3TT6I2RDSOK7HZRTAF',
    jwtSecret: 'test-secret-key-minimum-32-characters-required-for-security',
    network: 'testnet',
    assets: {
      USDC: {
        deposit: { enabled: true, minAmount: 1, maxAmount: 10000, feeFixed: 0, feePercent: 0 },
        withdraw: { enabled: true, minAmount: 1, maxAmount: 10000, feeFixed: 0, feePercent: 0 },
      },
    },
  };

  describe('constructor', () => {
    it('creates instance with valid config', () => {
      const server = new AnchorServer(validConfig);
      expect(server).toBeInstanceOf(AnchorServer);
    });

    it('throws when domain is missing', () => {
      const config = { ...validConfig, domain: '' };
      expect(() => new AnchorServer(config)).toThrow('domain is required');
    });

    it('throws when secretKey is missing', () => {
      const config = { ...validConfig, secretKey: '' };
      expect(() => new AnchorServer(config)).toThrow('secretKey is required');
    });

    it('throws when secretKey is invalid format', () => {
      const config = { ...validConfig, secretKey: 'INVALID_KEY' };
      expect(() => new AnchorServer(config)).toThrow(
        'Invalid secretKey: must be a valid Stellar secret key starting with S'
      );
    });

    it('throws when jwtSecret is missing', () => {
      const config = { ...validConfig, jwtSecret: '' };
      expect(() => new AnchorServer(config)).toThrow('jwtSecret is required');
    });

    it('throws when jwtSecret is too short', () => {
      const config = { ...validConfig, jwtSecret: 'too-short' };
      expect(() => new AnchorServer(config)).toThrow(
        'jwtSecret must be at least 32 characters long'
      );
    });

    it('throws when network is invalid', () => {
      const config = { ...validConfig, network: 'invalid' as any };
      expect(() => new AnchorServer(config)).toThrow('Invalid network: invalid');
    });

    it('throws when assets are missing', () => {
      const config = { ...validConfig, assets: {} };
      expect(() => new AnchorServer(config)).toThrow('At least one asset must be configured');
    });
  });

  describe('public properties', () => {
    it('derives publicKey from secretKey', () => {
      const server = new AnchorServer(validConfig);
      const expectedKey = Keypair.fromSecret(validConfig.secretKey).publicKey();
      expect(server.publicKey).toBe(expectedKey);
    });

    it('exposes domain', () => {
      const server = new AnchorServer(validConfig);
      expect(server.domain).toBe('myanchor.com');
    });

    it('exposes network', () => {
      const server = new AnchorServer(validConfig);
      expect(server.network).toBe('testnet');
    });

    it('exposes networkPassphrase for testnet', () => {
      const server = new AnchorServer(validConfig);
      expect(server.networkPassphrase).toBe('Test SDF Network ; September 2015');
    });

    it('exposes networkPassphrase for public', () => {
      const server = new AnchorServer({ ...validConfig, network: 'public' });
      expect(server.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    it('exposes config reference', () => {
      const server = new AnchorServer(validConfig);
      expect(server.config.domain).toBe('myanchor.com');
      expect(server.config.network).toBe('testnet');
    });

    it('exposes store', () => {
      const server = new AnchorServer(validConfig);
      expect(server.store).toBeDefined();
      expect(typeof server.store.create).toBe('function');
    });

    it('exposes authIssuer', () => {
      const server = new AnchorServer(validConfig);
      expect(server.authIssuer).toBeDefined();
      expect(typeof server.authIssuer.createChallenge).toBe('function');
    });

    it('exposes transferManager', () => {
      const server = new AnchorServer(validConfig);
      expect(server.transferManager).toBeDefined();
    });
  });

  describe('module mounting', () => {
    const sep24Hooks = {
      interactive: { url: 'https://example.com/interactive' },
    };

    it('tracks mounted modules', () => {
      const server = new AnchorServer(validConfig);
      expect(server.mountedModules.size).toBe(0);

      server.sep10();
      expect(server.mountedModules.has('sep10')).toBe(true);

      server.sep24(sep24Hooks);
      expect(server.mountedModules.has('sep24')).toBe(true);

      server.sep6();
      expect(server.mountedModules.has('sep6')).toBe(true);
    });

    it('returns Express Router from toml()', () => {
      const server = new AnchorServer(validConfig);
      const router = server.toml();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('returns Express Router from sep10()', () => {
      const server = new AnchorServer(validConfig);
      const router = server.sep10();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('returns Express Router from sep24()', () => {
      const server = new AnchorServer(validConfig);
      const router = server.sep24(sep24Hooks);
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('returns Express Router from sep6()', () => {
      const server = new AnchorServer(validConfig);
      const router = server.sep6();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });
  });

  describe('destroy()', () => {
    it('can be called without error', () => {
      const server = new AnchorServer(validConfig);
      expect(() => server.destroy()).not.toThrow();
    });
  });
});

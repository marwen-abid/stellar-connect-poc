import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StellarConnect } from '../stellar-connect.js';
import { TomlDiscovery, NetworkClient, type AnchorInfo } from '@stellarconnect/core';

vi.mock('@stellarconnect/core', () => {
  return {
    TomlDiscovery: vi.fn(),
    NetworkClient: vi.fn(),
  };
});

describe('StellarConnect', () => {
  let mockTomlDiscovery: any;

  beforeEach(() => {
    mockTomlDiscovery = {
      fetch: vi.fn(),
      validate: vi.fn(),
    };
    (TomlDiscovery as any).mockImplementation(() => mockTomlDiscovery);
    (NetworkClient as any).mockImplementation(() => ({}));
  });

  describe('constructor', () => {
    it('initializes with testnet configuration', () => {
      const client = new StellarConnect({ network: 'testnet' });
      
      expect(client.getNetwork()).toBe('testnet');
      expect(client.getHorizonUrl()).toBe('https://horizon-testnet.stellar.org');
    });

    it('initializes with public network configuration', () => {
      const client = new StellarConnect({ network: 'public' });
      
      expect(client.getNetwork()).toBe('public');
      expect(client.getHorizonUrl()).toBe('https://horizon.stellar.org');
    });

    it('allows custom Horizon URL override', () => {
      const customUrl = 'https://custom-horizon.example.com';
      const client = new StellarConnect({
        network: 'testnet',
        horizonUrl: customUrl,
      });
      
      expect(client.getHorizonUrl()).toBe(customUrl);
    });
  });

  describe('discoverAnchor', () => {
    it('discovers anchor TOML and returns capabilities', async () => {
      const mockToml: AnchorInfo = {
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        SIGNING_KEY: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
        WEB_AUTH_ENDPOINT: 'https://testanchor.stellar.org/auth',
        TRANSFER_SERVER: 'https://testanchor.stellar.org/sep6',
        TRANSFER_SERVER_SEP0024: 'https://testanchor.stellar.org/sep24',
      };

      mockTomlDiscovery.fetch.mockResolvedValue(mockToml);

      const client = new StellarConnect({ network: 'testnet' });
      const anchor = await client.discoverAnchor('testanchor.stellar.org');

      expect(mockTomlDiscovery.fetch).toHaveBeenCalledWith('testanchor.stellar.org');
      expect(mockTomlDiscovery.validate).toHaveBeenCalledWith(mockToml);
      
      expect(anchor.domain).toBe('testanchor.stellar.org');
      expect(anchor.toml).toEqual(mockToml);
      expect(anchor.sep10).toEqual({
        endpoint: 'https://testanchor.stellar.org/auth',
      });
      expect(anchor.sep6).toEqual({
        endpoint: 'https://testanchor.stellar.org/sep6',
      });
      expect(anchor.sep24).toEqual({
        endpoint: 'https://testanchor.stellar.org/sep24',
      });
    });

    it('discovers anchor with partial SEP support', async () => {
      const mockToml: AnchorInfo = {
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        SIGNING_KEY: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
        WEB_AUTH_ENDPOINT: 'https://testanchor.stellar.org/auth',
      };

      mockTomlDiscovery.fetch.mockResolvedValue(mockToml);

      const client = new StellarConnect({ network: 'testnet' });
      const anchor = await client.discoverAnchor('testanchor.stellar.org');

      expect(anchor.sep10).toEqual({
        endpoint: 'https://testanchor.stellar.org/auth',
      });
      expect(anchor.sep6).toBeUndefined();
      expect(anchor.sep24).toBeUndefined();
    });

    it('validates TOML after fetching', async () => {
      const mockToml: AnchorInfo = {
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        SIGNING_KEY: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
      };

      mockTomlDiscovery.fetch.mockResolvedValue(mockToml);

      const client = new StellarConnect({ network: 'testnet' });
      await client.discoverAnchor('testanchor.stellar.org');

      expect(mockTomlDiscovery.validate).toHaveBeenCalledWith(mockToml);
    });
  });

  describe('detectCapabilities', () => {
    it('detects SEP-10 capability', () => {
      const client = new StellarConnect({ network: 'testnet' });
      const toml: AnchorInfo = {
        WEB_AUTH_ENDPOINT: 'https://testanchor.stellar.org/auth',
      };

      const capabilities = client.detectCapabilities(toml);

      expect(capabilities.sep10).toEqual({
        endpoint: 'https://testanchor.stellar.org/auth',
      });
    });

    it('detects SEP-6 capability', () => {
      const client = new StellarConnect({ network: 'testnet' });
      const toml: AnchorInfo = {
        TRANSFER_SERVER: 'https://testanchor.stellar.org/sep6',
      };

      const capabilities = client.detectCapabilities(toml);

      expect(capabilities.sep6).toEqual({
        endpoint: 'https://testanchor.stellar.org/sep6',
      });
    });

    it('detects SEP-24 capability', () => {
      const client = new StellarConnect({ network: 'testnet' });
      const toml: AnchorInfo = {
        TRANSFER_SERVER_SEP0024: 'https://testanchor.stellar.org/sep24',
      };

      const capabilities = client.detectCapabilities(toml);

      expect(capabilities.sep24).toEqual({
        endpoint: 'https://testanchor.stellar.org/sep24',
      });
    });

    it('detects all capabilities when present', () => {
      const client = new StellarConnect({ network: 'testnet' });
      const toml: AnchorInfo = {
        WEB_AUTH_ENDPOINT: 'https://testanchor.stellar.org/auth',
        TRANSFER_SERVER: 'https://testanchor.stellar.org/sep6',
        TRANSFER_SERVER_SEP0024: 'https://testanchor.stellar.org/sep24',
      };

      const capabilities = client.detectCapabilities(toml);

      expect(capabilities.sep10).toBeDefined();
      expect(capabilities.sep6).toBeDefined();
      expect(capabilities.sep24).toBeDefined();
    });

    it('returns empty capabilities for anchor with no SEP support', () => {
      const client = new StellarConnect({ network: 'testnet' });
      const toml: AnchorInfo = {
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        SIGNING_KEY: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
      };

      const capabilities = client.detectCapabilities(toml);

      expect(capabilities.sep10).toBeUndefined();
      expect(capabilities.sep6).toBeUndefined();
      expect(capabilities.sep24).toBeUndefined();
    });
  });
});

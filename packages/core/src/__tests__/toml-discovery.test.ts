import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TomlDiscovery } from '../toml-discovery';
import { NetworkClient } from '../network-client';

describe('TomlDiscovery', () => {
  let discovery: TomlDiscovery;
  let mockNetworkClient: NetworkClient;

  beforeEach(() => {
    mockNetworkClient = new NetworkClient();
    discovery = new TomlDiscovery({ networkClient: mockNetworkClient });
  });

  describe('fetch', () => {
    it('should fetch and parse stellar.toml', async () => {
      const mockToml = `
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
SIGNING_KEY = "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVQRGOD7P"
WEB_AUTH_ENDPOINT = "https://example.com/auth"
      `.trim();

      mockNetworkClient.get = vi.fn().mockResolvedValue(
        new Response(mockToml, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

      const result = await discovery.fetch('example.com');

      expect(result.NETWORK_PASSPHRASE).toBe('Test SDF Network ; September 2015');
      expect(result.SIGNING_KEY).toBe('GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVQRGOD7P');
      expect(result.WEB_AUTH_ENDPOINT).toBe('https://example.com/auth');
    });

    it('should normalize domain names', async () => {
      const mockToml = `SIGNING_KEY = "GTEST"\nNETWORK_PASSPHRASE = "Test"`;

      mockNetworkClient.get = vi.fn().mockResolvedValue(
        new Response(mockToml, { status: 200 }),
      );

      await discovery.fetch('https://Example.com/');

      expect(mockNetworkClient.get).toHaveBeenCalledWith(
        'https://example.com/.well-known/stellar.toml',
      );
    });

    it('should cache results', async () => {
      const mockToml = `SIGNING_KEY = "GTEST"\nNETWORK_PASSPHRASE = "Test"`;

      mockNetworkClient.get = vi.fn().mockResolvedValue(
        new Response(mockToml, { status: 200 }),
      );

      await discovery.fetch('example.com');
      await discovery.fetch('example.com');

      expect(mockNetworkClient.get).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const mockToml = `SIGNING_KEY = "GTEST"\nNETWORK_PASSPHRASE = "Test"`;

      mockNetworkClient.get = vi.fn()
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }))
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }));

      discovery = new TomlDiscovery({ networkClient: mockNetworkClient, cacheTtlMs: 100 });

      await discovery.fetch('example.com');
      await new Promise((resolve) => setTimeout(resolve, 150));
      await discovery.fetch('example.com');

      expect(mockNetworkClient.get).toHaveBeenCalledTimes(2);
    });

    it('should throw on fetch failure', async () => {
      mockNetworkClient.get = vi.fn().mockResolvedValue(
        new Response('Not Found', { status: 404 }),
      );

      await expect(discovery.fetch('example.com')).rejects.toThrow('Failed to fetch');
    });

    it('should throw on invalid TOML', async () => {
      mockNetworkClient.get = vi.fn().mockResolvedValue(
        new Response('invalid [[[[ toml', { status: 200 }),
      );

      await expect(discovery.fetch('example.com')).rejects.toThrow('Failed to parse');
    });
  });

  describe('parse', () => {
    it('should parse valid TOML', () => {
      const toml = `
SIGNING_KEY = "GTEST"
NETWORK_PASSPHRASE = "Test Network"
WEB_AUTH_ENDPOINT = "https://example.com/auth"
      `.trim();

      const result = discovery.parse(toml);

      expect(result.SIGNING_KEY).toBe('GTEST');
      expect(result.NETWORK_PASSPHRASE).toBe('Test Network');
    });

    it('should handle nested sections', () => {
      const toml = `
SIGNING_KEY = "GTEST"

[DOCUMENTATION]
ORG_NAME = "Test Org"
      `.trim();

      const result = discovery.parse(toml);

      expect(result.SIGNING_KEY).toBe('GTEST');
      expect(result.DOCUMENTATION).toBeDefined();
    });

    it('should throw on invalid TOML syntax', () => {
      expect(() => discovery.parse('invalid = [[[[ toml')).toThrow('Failed to parse');
    });
  });

  describe('validate', () => {
    it('should accept valid anchor info', () => {
      const info = {
        SIGNING_KEY: 'GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVQRGOD7P',
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      };

      expect(() => discovery.validate(info)).not.toThrow();
    });

    it('should reject missing SIGNING_KEY', () => {
      const info = {
        NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      };

      expect(() => discovery.validate(info)).toThrow('SIGNING_KEY');
    });

    it('should reject missing NETWORK_PASSPHRASE', () => {
      const info = {
        SIGNING_KEY: 'GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVQRGOD7P',
      };

      expect(() => discovery.validate(info)).toThrow('NETWORK_PASSPHRASE');
    });

    it('should reject invalid SIGNING_KEY format', () => {
      const info = {
        SIGNING_KEY: 'INVALID_KEY',
        NETWORK_PASSPHRASE: 'Test',
      };

      expect(() => discovery.validate(info)).toThrow('valid Stellar public key');
    });
  });

  describe('clearCache', () => {
    it('should clear specific domain cache', async () => {
      const mockToml = `SIGNING_KEY = "GTEST"\nNETWORK_PASSPHRASE = "Test"`;

      mockNetworkClient.get = vi.fn()
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }))
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }));

      await discovery.fetch('example.com');
      discovery.clearCache('example.com');
      await discovery.fetch('example.com');

      expect(mockNetworkClient.get).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const mockToml = `SIGNING_KEY = "GTEST"\nNETWORK_PASSPHRASE = "Test"`;

      mockNetworkClient.get = vi.fn()
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }))
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }))
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }))
        .mockResolvedValueOnce(new Response(mockToml, { status: 200 }));

      await discovery.fetch('example1.com');
      await discovery.fetch('example2.com');

      discovery.clearCache();

      await discovery.fetch('example1.com');
      await discovery.fetch('example2.com');

      expect(mockNetworkClient.get).toHaveBeenCalledTimes(4);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { TomlPublisher } from '../toml/publisher.js';
import { AnchorServer } from '../anchor-server.js';
import type { AnchorServerConfig } from '../config/types.js';

describe('TomlPublisher', () => {
  const TEST_SECRET_KEY = 'SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K';
  const TEST_JWT_SECRET = 'test-secret-key-minimum-32-characters-required-for-security';
  const TEST_PUBLIC_KEY = 'GBGX7YVAO5PQVDKHRKAFUQKJRYFZQX5KTCQ7W3TQAQSN3I5L5GEQ6NNM';

  describe('render()', () => {
    it('generates TOML with required fields', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain(`SIGNING_KEY = "${anchor.publicKey}"`);
      expect(toml).toContain('NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"');
    });

    it('uses public network passphrase', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'public',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain(
        'NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"'
      );
    });

    it('includes DOCUMENTATION section', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
        meta: {
          orgName: 'My Anchor Inc',
          orgUrl: 'https://myanchor.com',
          orgSupportEmail: 'support@myanchor.com',
        },
      };

      const anchor = new AnchorServer(serverConfig);
      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('[DOCUMENTATION]');
      expect(toml).toContain('org_name = "My Anchor Inc"');
      expect(toml).toContain('org_url = "https://myanchor.com"');
      expect(toml).toContain('org_support_email = "support@myanchor.com"');
    });

    it('escapes special characters in strings', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
        meta: {
          orgDescription: 'A company with "quotes" and \\backslashes\\',
        },
      };

      const anchor = new AnchorServer(serverConfig);
      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain(
        'org_description = "A company with \\\"quotes\\\" and \\\\backslashes\\\\"'
      );
    });
  });

  describe('lazy generation with AnchorServer', () => {
    it('includes WEB_AUTH_ENDPOINT only if sep10 mounted', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      anchor.sep10();

      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('WEB_AUTH_ENDPOINT');
      expect(toml).not.toContain('TRANSFER_SERVER_SEP0024');
      expect(toml).not.toContain('TRANSFER_SERVER = ');
    });

    it('includes TRANSFER_SERVER_SEP0024 only if sep24 mounted', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      anchor.sep24({ interactive: { url: 'https://example.com/interactive' } });

      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('TRANSFER_SERVER_SEP0024');
      expect(toml).not.toContain('WEB_AUTH_ENDPOINT');
      expect(toml).not.toContain('TRANSFER_SERVER = ');
    });

    it('includes TRANSFER_SERVER only if sep6 mounted', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      anchor.sep6();

      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('TRANSFER_SERVER = ');
      expect(toml).not.toContain('WEB_AUTH_ENDPOINT');
      expect(toml).not.toContain('TRANSFER_SERVER_SEP0024');
    });

    it('includes all endpoints when all modules mounted', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      anchor.sep10();
      anchor.sep24({ interactive: { url: 'https://example.com/interactive' } });
      anchor.sep6();

      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('WEB_AUTH_ENDPOINT');
      expect(toml).toContain('TRANSFER_SERVER_SEP0024');
      expect(toml).toContain('TRANSFER_SERVER = ');
    });

    it('generates currencies from assets config', () => {
      const serverConfig: AnchorServerConfig = {
        secretKey: TEST_SECRET_KEY,
        jwtSecret: TEST_JWT_SECRET,
        domain: 'myanchor.com',
        network: 'testnet',
        assets: {
          USDC: {
            issuer: TEST_PUBLIC_KEY,
            status: 'live',
            displayDecimals: 2,
            name: 'USD Coin',
            desc: 'Digital USD',
            deposit: { enabled: true },
            withdraw: { enabled: true },
          },
        },
      };

      const anchor = new AnchorServer(serverConfig);
      const publisher = new TomlPublisher(anchor);
      const toml = publisher.render();

      expect(toml).toContain('[[CURRENCIES]]');
      expect(toml).toContain('code = "USDC"');
      expect(toml).toContain(`issuer = "${TEST_PUBLIC_KEY}"`);
      expect(toml).toContain('status = "live"');
      expect(toml).toContain('display_decimals = 2');
      expect(toml).toContain('name = "USD Coin"');
      expect(toml).toContain('desc = "Digital USD"');
    });
  });
});

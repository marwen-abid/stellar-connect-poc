import { Keypair, Networks } from '@stellar/stellar-sdk';
import type { AnchorServerConfig, Sep24Hooks, Sep6Hooks } from './config/types.js';
import { badRequest } from './errors.js';
import { AuthIssuer } from './auth/auth-issuer.js';
import { createSep10Router } from './modules/sep10/index.js';
import { createSep24Router } from './modules/sep24/index.js';
import { createSep6Router } from './modules/sep6/index.js';
import { TransferManager } from './transfer/transfer-manager.js';
import { InMemoryTransferStore, TransferStore } from './transfer/transfer-store.js';
import { TomlPublisher } from './toml/publisher.js';
import { Router } from 'express';

type MountedModule = 'sep10' | 'sep24' | 'sep6';

export class AnchorServer {
  private readonly configRef: AnchorServerConfig;
  private readonly keypair: Keypair;
  private readonly authIssuerRef: AuthIssuer;
  private readonly transferManagerRef: TransferManager;
  private readonly transferStore: TransferStore;
  readonly mountedModules: Set<MountedModule> = new Set();

  constructor(config: AnchorServerConfig) {
    this.validateConfig(config);
    this.configRef = config;

    this.keypair = Keypair.fromSecret(config.secretKey);
    this.transferStore = config.store || new InMemoryTransferStore();

    const networkPassphrase = this.deriveNetworkPassphrase(config.network);
    this.authIssuerRef = new AuthIssuer(
      config.secretKey,
      config.domain,
      networkPassphrase,
      config.jwtSecret
    );

    const baseUrl = this.getBaseUrl();
    this.transferManagerRef = new TransferManager(
      {
        baseUrl,
        interactiveUrl: `${baseUrl}/interactive`,
        supportedAssets: Object.keys(config.assets),
      },
      this.transferStore
    );
  }

  private validateConfig(config: AnchorServerConfig): void {
    if (!config.domain || config.domain.trim().length === 0) {
      throw badRequest('domain is required');
    }

    if (!config.secretKey) {
      throw badRequest('secretKey is required');
    }

    try {
      Keypair.fromSecret(config.secretKey);
    } catch {
      throw badRequest('Invalid secretKey: must be a valid Stellar secret key starting with S');
    }

    if (!config.jwtSecret) {
      throw badRequest('jwtSecret is required');
    }

    if (config.jwtSecret.length < 32) {
      throw badRequest('jwtSecret must be at least 32 characters long');
    }

    if (!config.assets || Object.keys(config.assets).length === 0) {
      throw badRequest('At least one asset must be configured');
    }

    const validNetworks = ['public', 'testnet', 'futurenet', 'standalone', 'mainnet'];
    if (!validNetworks.includes(config.network)) {
      throw badRequest(`Invalid network: ${config.network}`);
    }
  }

  private deriveNetworkPassphrase(network: AnchorServerConfig['network']): string {
    if (network === 'public' || network === 'mainnet') return Networks.PUBLIC;
    if (network === 'testnet') return Networks.TESTNET;
    if (network === 'futurenet') return Networks.FUTURENET;
    if (network === 'standalone') return Networks.STANDALONE;
    throw badRequest(`Unknown network: ${network}`);
  }

  private getBaseUrl(): string {
    const domain = this.configRef.domain.trim();
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    const isLocal = domain.startsWith('localhost') || domain.startsWith('127.0.0.1');
    const protocol = isLocal ? 'http' : 'https';
    return `${protocol}://${domain}`;
  }

  get publicKey(): string {
    return this.keypair.publicKey();
  }

  get domain(): string {
    return this.configRef.domain;
  }

  get network(): AnchorServerConfig['network'] {
    return this.configRef.network;
  }

  get networkPassphrase(): string {
    return this.deriveNetworkPassphrase(this.configRef.network);
  }

  get store(): TransferStore {
    return this.transferStore;
  }

  get authIssuer(): AuthIssuer {
    return this.authIssuerRef;
  }

  get transferManager(): TransferManager {
    return this.transferManagerRef;
  }

  get config(): AnchorServerConfig {
    return this.configRef;
  }

  toml(): Router {
    const router = Router();
    const publisher = new TomlPublisher(this);

    router.get('/.well-known/stellar.toml', (_req: any, res: any) => {
      try {
        const tomlContent = publisher.render();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(tomlContent);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).send(`Error generating TOML: ${errorMessage}`);
      }
    });

    return router;
  }

  sep10(): Router {
    this.mountedModules.add('sep10');
    return createSep10Router(this);
  }

  sep24(hooks: Sep24Hooks): Router {
    if (!hooks?.interactive?.url) {
      throw badRequest(
        'sep24() requires hooks with interactive.url — you must provide your own interactive flow URL'
      );
    }
    this.mountedModules.add('sep24');
    return createSep24Router(this, hooks);
  }

  sep6(hooks?: Sep6Hooks): Router {
    this.mountedModules.add('sep6');
    return createSep6Router(this, hooks);
  }

  destroy(): void {
    this.authIssuerRef.destroy();
  }
}

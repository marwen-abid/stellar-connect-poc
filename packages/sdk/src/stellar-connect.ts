import { TomlDiscovery, type AnchorInfo, type Signer, NetworkClient } from '@stellarconnect/core';
import type {
  Network,
  StellarConnectConfig,
  AnchorCapabilities,
  Sep10Endpoint,
  Sep6Endpoint,
  Sep24Endpoint,
} from './types.js';
import type { Session } from './session.js';
import { SessionImpl } from './session-impl.js';
import { authenticateSep10, parseTokenExpiration } from './auth.js';

const DEFAULT_HORIZON_URLS: Record<Network, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
};

export class StellarConnect {
  private network: Network;
  private horizonUrl: string;
  private tomlDiscovery: TomlDiscovery;
  private networkClient: NetworkClient;

  constructor(config: StellarConnectConfig) {
    this.network = config.network;
    this.horizonUrl = config.horizonUrl ?? DEFAULT_HORIZON_URLS[config.network];
    this.tomlDiscovery = new TomlDiscovery();
    this.networkClient = new NetworkClient();
  }

  async discoverAnchor(domain: string): Promise<AnchorCapabilities> {
    const toml = await this.tomlDiscovery.fetch(domain);
    
    this.tomlDiscovery.validate(toml);
    
    const capabilities = this.detectCapabilities(toml);
    
    return {
      domain,
      toml,
      ...capabilities,
    };
  }

  detectCapabilities(toml: AnchorInfo): {
    sep10?: Sep10Endpoint;
    sep6?: Sep6Endpoint;
    sep24?: Sep24Endpoint;
  } {
    const capabilities: {
      sep10?: Sep10Endpoint;
      sep6?: Sep6Endpoint;
      sep24?: Sep24Endpoint;
    } = {};

    if (toml.WEB_AUTH_ENDPOINT) {
      capabilities.sep10 = {
        endpoint: toml.WEB_AUTH_ENDPOINT,
      };
    }

    if (toml.TRANSFER_SERVER) {
      capabilities.sep6 = {
        endpoint: toml.TRANSFER_SERVER,
      };
    }

    if (toml.TRANSFER_SERVER_SEP0024) {
      capabilities.sep24 = {
        endpoint: toml.TRANSFER_SERVER_SEP0024,
      };
    }

    return capabilities;
  }

  getNetwork(): Network {
    return this.network;
  }

  getHorizonUrl(): string {
    return this.horizonUrl;
  }

  async login(anchor: AnchorCapabilities, signer: Signer): Promise<Session> {
    if (!anchor.sep10) {
      throw new Error('Anchor does not support SEP-10 authentication');
    }

    const tokenResponse = await authenticateSep10(
      anchor.sep10.endpoint,
      signer,
      this.network,
      this.networkClient,
    );

    const expiresAt = parseTokenExpiration(tokenResponse) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    return new SessionImpl(anchor, signer, tokenResponse.token, expiresAt, this.networkClient);
  }
}

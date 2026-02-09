import { parse as parseToml } from 'toml';
import { NetworkClient } from './network-client.js';

export interface AnchorInfo {
  NETWORK_PASSPHRASE?: string;
  SIGNING_KEY?: string;
  WEB_AUTH_ENDPOINT?: string;
  TRANSFER_SERVER?: string;
  TRANSFER_SERVER_SEP0024?: string;
  KYC_SERVER?: string;
  DIRECT_PAYMENT_SERVER?: string;
  ANCHOR_QUOTE_SERVER?: string;
  VERSION?: string;
  [key: string]: unknown;
}

interface CacheEntry {
  data: AnchorInfo;
  timestamp: number;
}

export interface TomlDiscoveryConfig {
  cacheTtlMs?: number;
  networkClient?: NetworkClient;
}

export class TomlDiscovery {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;
  private networkClient: NetworkClient;

  constructor(config: TomlDiscoveryConfig = {}) {
    this.cacheTtlMs = config.cacheTtlMs ?? 300000;
    this.networkClient = config.networkClient ?? new NetworkClient();
  }

  async fetch(domain: string): Promise<AnchorInfo> {
    const cacheKey = this.normalizeDomain(domain);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const url = this.buildTomlUrl(cacheKey);
    const response = await this.networkClient.get(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch stellar.toml from ${domain}: ${response.statusText}`);
    }

    const text = await response.text();
    const data = this.parse(text);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  parse(tomlContent: string): AnchorInfo {
    try {
      return parseToml(tomlContent) as AnchorInfo;
    } catch (error) {
      throw new Error(`Failed to parse stellar.toml: ${(error as Error).message}`);
    }
  }

  validate(info: AnchorInfo): void {
    if (!info.SIGNING_KEY) {
      throw new Error('stellar.toml missing required field: SIGNING_KEY');
    }

    if (!info.NETWORK_PASSPHRASE) {
      throw new Error('stellar.toml missing required field: NETWORK_PASSPHRASE');
    }

    if (!info.SIGNING_KEY.startsWith('G')) {
      throw new Error('SIGNING_KEY must be a valid Stellar public key (G...)');
    }
  }

  clearCache(domain?: string): void {
    if (domain) {
      const cacheKey = this.normalizeDomain(domain);
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  private buildTomlUrl(normalizedDomain: string): string {
    return `https://${normalizedDomain}/.well-known/stellar.toml`;
  }
}

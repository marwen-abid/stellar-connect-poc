import { parse as parseToml } from 'toml';
import { NetworkClient } from './network-client.js';
export class TomlDiscovery {
    constructor(config = {}) {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "cacheTtlMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "networkClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cacheTtlMs = config.cacheTtlMs ?? 300000;
        this.networkClient = config.networkClient ?? new NetworkClient();
    }
    async fetch(domain) {
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
    parse(tomlContent) {
        try {
            return parseToml(tomlContent);
        }
        catch (error) {
            throw new Error(`Failed to parse stellar.toml: ${error.message}`);
        }
    }
    validate(info) {
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
    clearCache(domain) {
        if (domain) {
            const cacheKey = this.normalizeDomain(domain);
            this.cache.delete(cacheKey);
        }
        else {
            this.cache.clear();
        }
    }
    normalizeDomain(domain) {
        return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    buildTomlUrl(normalizedDomain) {
        return `https://${normalizedDomain}/.well-known/stellar.toml`;
    }
}
//# sourceMappingURL=toml-discovery.js.map
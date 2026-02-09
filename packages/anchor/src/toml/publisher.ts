import type { TomlStructure, CurrencyInfo } from './types.js';
import type { AnchorServer } from '../anchor-server.js';

export class TomlPublisher {
  private server: AnchorServer;
  private cachedToml: string | null = null;

  constructor(server: AnchorServer) {
    this.server = server;
  }

  render(): string {
    if (this.cachedToml) {
      return this.cachedToml;
    }

    const structure = this.buildTomlStructure();
    this.cachedToml = this.stringifyToml(structure);
    return this.cachedToml;
  }

  invalidateCache(): void {
    this.cachedToml = null;
  }

  private buildTomlStructure(): TomlStructure {
    return this.buildFromServer();
  }

  private buildFromServer(): TomlStructure {
    const server = this.server;
    const structure: TomlStructure = {
      SIGNING_KEY: server.publicKey,
      NETWORK_PASSPHRASE: server.networkPassphrase,
    };

    if (server.mountedModules.has('sep10')) {
      structure.WEB_AUTH_ENDPOINT = this.buildSepUrl(server.config.domain, '/auth');
    }

    if (server.mountedModules.has('sep24')) {
      structure.TRANSFER_SERVER_SEP0024 = this.buildSepUrl(server.config.domain, '/sep24');
    }

    if (server.mountedModules.has('sep6')) {
      structure.TRANSFER_SERVER = this.buildSepUrl(server.config.domain, '/sep6');
    }

    if (server.config.meta) {
      structure.DOCUMENTATION = this.mapMetaToDocumentation(server.config.meta);
    }

    return structure;
  }

  private getProtocol(domain: string): string {
    return domain === 'localhost' || domain.startsWith('localhost:') ? 'http' : 'https';
  }

  private buildSepUrl(domain: string, path: string): string {
    const protocol = this.getProtocol(domain);
    return `${protocol}://${domain}${path}`;
  }

  private mapMetaToDocumentation(meta: NonNullable<AnchorServer['config']['meta']>): any {
    return {
      org_name: meta.orgName,
      org_url: meta.orgUrl,
      org_description: meta.orgDescription,
      org_logo: meta.orgLogo,
      org_physical_address: meta.orgPhysicalAddress,
      org_official_email: meta.orgOfficialEmail,
      org_support_email: meta.orgSupportEmail,
    };
  }

  private mapAssetsToCurrencies(): CurrencyInfo[] {
    const isTestnet =
      this.server.config.network === 'testnet' ||
      this.server.config.network === 'futurenet' ||
      this.server.config.network === 'standalone';
    const defaultStatus = isTestnet ? 'test' : 'live';

    const currencies: CurrencyInfo[] = [];
    for (const [code, asset] of Object.entries(this.server.config.assets)) {
      // Determine status: skip 'dead'/'private' for TOML, default based on network
      const rawStatus = asset.status;
      const status: 'test' | 'live' =
        rawStatus === 'live' || rawStatus === 'test' ? rawStatus : defaultStatus;

      const isNative = code === 'native' || code === 'XLM';

      currencies.push({
        code: isNative ? 'native' : code,
        issuer: asset.issuer,
        status,
        display_decimals: asset.displayDecimals,
        name: asset.name || code,
        desc: asset.desc || code,
        is_asset_anchored: false,
        anchor_asset_type: isNative ? 'crypto' : 'crypto',
      });
    }
    return currencies;
  }

  private stringifyToml(structure: TomlStructure): string {
    const lines: string[] = [];

    lines.push(this.toTomlKeyValue('SIGNING_KEY', structure.SIGNING_KEY));
    lines.push(this.toTomlKeyValue('NETWORK_PASSPHRASE', structure.NETWORK_PASSPHRASE));

    if (structure.VERSION) {
      lines.push(this.toTomlKeyValue('VERSION', structure.VERSION));
    }

    if (structure.ACCOUNTS && structure.ACCOUNTS.length > 0) {
      lines.push(this.toTomlKeyValue('ACCOUNTS', structure.ACCOUNTS));
    }

    if (structure.WEB_AUTH_ENDPOINT) {
      lines.push('');
      lines.push(this.toTomlKeyValue('WEB_AUTH_ENDPOINT', structure.WEB_AUTH_ENDPOINT));
    }

    if (structure.TRANSFER_SERVER_SEP0024) {
      lines.push(this.toTomlKeyValue('TRANSFER_SERVER_SEP0024', structure.TRANSFER_SERVER_SEP0024));
    }

    if (structure.TRANSFER_SERVER) {
      lines.push(this.toTomlKeyValue('TRANSFER_SERVER', structure.TRANSFER_SERVER));
    }

    if (structure.DOCUMENTATION) {
      lines.push('');
      lines.push('[DOCUMENTATION]');
      for (const [key, value] of Object.entries(structure.DOCUMENTATION)) {
        if (value !== undefined && value !== null) {
          lines.push(this.toTomlKeyValue(key, value));
        }
      }
    }

    if (structure.PRINCIPALS && structure.PRINCIPALS.length > 0) {
      for (let i = 0; i < structure.PRINCIPALS.length; i++) {
        lines.push('');
        lines.push(`[[PRINCIPALS]]`);
        const principal = structure.PRINCIPALS[i];
        for (const [key, value] of Object.entries(principal)) {
          if (value !== undefined && value !== null) {
            lines.push(this.toTomlKeyValue(key, value));
          }
        }
      }
    }

    const currencies = this.mapAssetsToCurrencies();
    if (currencies.length > 0) {
      for (const currency of currencies) {
        lines.push('');
        lines.push('[[CURRENCIES]]');
        this.appendCurrencyFields(lines, currency);
      }
    }

    const reservedKeys = new Set([
      'SIGNING_KEY',
      'NETWORK_PASSPHRASE',
      'VERSION',
      'ACCOUNTS',
      'WEB_AUTH_ENDPOINT',
      'TRANSFER_SERVER_SEP0024',
      'TRANSFER_SERVER',
      'DOCUMENTATION',
      'PRINCIPALS',
    ]);

    for (const [key, value] of Object.entries(structure)) {
      if (!reservedKeys.has(key) && value !== undefined && value !== null) {
        lines.push('');
        lines.push(this.toTomlKeyValue(key, value));
      }
    }

    return lines.join('\n') + '\n';
  }

  private appendCurrencyFields(lines: string[], currency: CurrencyInfo): void {
    const fieldOrder = [
      'code',
      'issuer',
      'status',
      'display_decimals',
      'name',
      'desc',
      'conditions',
      'image',
      'fixed_number',
      'max_number',
      'is_unlimited',
      'is_asset_anchored',
      'anchor_asset_type',
      'anchor_asset',
      'redemption_instructions',
      'collateral_addresses',
      'collateral_address_messages',
      'collateral_address_signatures',
      'regulated',
      'approval_server',
      'approval_criteria',
    ];

    for (const field of fieldOrder) {
      const value = currency[field as keyof CurrencyInfo];
      if (value !== undefined && value !== null) {
        lines.push(this.toTomlKeyValue(field, value));
      }
    }
  }

  private toTomlKeyValue(key: string, value: unknown): string {
    if (typeof value === 'string') {
      return `${key} = "${this.escapeTomlString(value)}"`;
    }

    if (typeof value === 'number') {
      return `${key} = ${value}`;
    }

    if (typeof value === 'boolean') {
      return `${key} = ${value}`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${key} = []`;
      }
      if (typeof value[0] === 'string') {
        const escapedValues = value.map((v) => `"${this.escapeTomlString(v)}"`);
        return `${key} = [${escapedValues.join(', ')}]`;
      }
      return `${key} = [${value.join(', ')}]`;
    }

    return `${key} = "${String(value)}"`;
  }

  private escapeTomlString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

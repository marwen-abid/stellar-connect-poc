import { Horizon } from '@stellar/stellar-sdk';

export enum AccountType {
  CLASSIC_FUNDED = 'CLASSIC_FUNDED',
  CLASSIC_UNFUNDED = 'CLASSIC_UNFUNDED',
  SOROBAN_CONTRACT = 'SOROBAN_CONTRACT',
  UNKNOWN = 'UNKNOWN',
}

export enum AuthPath {
  SEP10 = 'SEP10',
  SEP45 = 'SEP45',
  SEP10_OR_SEP45 = 'SEP10_OR_SEP45',
  UNSUPPORTED = 'UNSUPPORTED',
}

export interface AnchorCapabilities {
  supportsSep10: boolean;
  supportsSep45: boolean;
}

export interface AccountDetails {
  type: AccountType;
  address: string;
  balances?: Horizon.HorizonApi.BalanceLine[];
  sequence?: string;
  thresholds?: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags?: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
}

export interface AccountInspectorConfig {
  horizonUrl?: string;
}

export class AccountInspector {
  private server: Horizon.Server;

  constructor(config: AccountInspectorConfig = {}) {
    const horizonUrl = config.horizonUrl ?? 'https://horizon-testnet.stellar.org';
    this.server = new Horizon.Server(horizonUrl);
  }

  async inspect(address: string): Promise<AccountDetails> {
    const type = await this.determineAccountType(address);

    if (type === AccountType.CLASSIC_UNFUNDED) {
      return {
        type,
        address,
      };
    }

    if (type === AccountType.SOROBAN_CONTRACT) {
      return {
        type,
        address,
      };
    }

    try {
      const account = await this.server.loadAccount(address);
      return {
        type,
        address,
        balances: account.balances,
        sequence: account.sequence,
        thresholds: {
          low_threshold: account.thresholds.low_threshold,
          med_threshold: account.thresholds.med_threshold,
          high_threshold: account.thresholds.high_threshold,
        },
        flags: {
          auth_required: account.flags.auth_required,
          auth_revocable: account.flags.auth_revocable,
          auth_immutable: account.flags.auth_immutable,
        },
      };
    } catch (error) {
      return {
        type: AccountType.UNKNOWN,
        address,
      };
    }
  }

  resolveAuthPath(address: string, capabilities: AnchorCapabilities): AuthPath {
    if (!capabilities.supportsSep10 && !capabilities.supportsSep45) {
      return AuthPath.UNSUPPORTED;
    }

    if (capabilities.supportsSep10 && capabilities.supportsSep45) {
      return AuthPath.SEP10_OR_SEP45;
    }

    const isContract = this.looksLikeContract(address);

    if (isContract && capabilities.supportsSep45) {
      return AuthPath.SEP45;
    }

    if (!isContract && capabilities.supportsSep10) {
      return AuthPath.SEP10;
    }

    if (capabilities.supportsSep10) {
      return AuthPath.SEP10;
    }

    if (capabilities.supportsSep45) {
      return AuthPath.SEP45;
    }

    return AuthPath.UNSUPPORTED;
  }

  private async determineAccountType(address: string): Promise<AccountType> {
    if (this.looksLikeContract(address)) {
      return AccountType.SOROBAN_CONTRACT;
    }

    try {
      await this.server.loadAccount(address);
      return AccountType.CLASSIC_FUNDED;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return AccountType.CLASSIC_UNFUNDED;
      }
      return AccountType.UNKNOWN;
    }
  }

  private looksLikeContract(address: string): boolean {
    return address.startsWith('C');
  }
}

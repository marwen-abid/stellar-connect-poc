import { randomBytes } from 'crypto';
import {
  TransferStatus,
  type Transfer,
  type TransferKind,
  type DepositRequest,
  type DepositResponse,
  type WithdrawalRequest,
  type WithdrawalResponse,
  type InteractiveToken,
  type Sep24TransferConfig,
} from '../types.js';
import type { TransferStore } from '../transfer-store.js';

const DEFAULT_TOKEN_EXPIRATION_MS = 15 * 60 * 1000;

export class Sep24Service {
  constructor(
    private store: TransferStore,
    private config: Sep24TransferConfig
  ) {}

  async initiateDeposit(request: DepositRequest): Promise<DepositResponse> {
    // Validate asset against supported assets
    if (this.config.supportedAssets) {
      const normalizedAssetCode = request.assetCode.toUpperCase();
      const supportedAssetsUpper = this.config.supportedAssets.map((a) => a.toUpperCase());
      if (!supportedAssetsUpper.includes(normalizedAssetCode)) {
        throw new Error(`Asset ${request.assetCode} not supported by anchor`);
      }
    }

    const transfer = this.createTransfer('deposit', request);
    const token = this.generateInteractiveToken();

    transfer.interactiveToken = token;
    transfer.interactiveUrl = this.buildInteractiveUrl(transfer.id, token.token);
    transfer.more_info_url = this.buildMoreInfoUrl(transfer.id);

    await this.store.create(transfer);

    return {
      id: transfer.id,
      url: transfer.interactiveUrl,
      type: 'interactive_customer_info_needed',
    };
  }

  async initiateWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResponse> {
    // Validate asset against supported assets
    if (this.config.supportedAssets) {
      const normalizedAssetCode = request.assetCode.toUpperCase();
      const supportedAssetsUpper = this.config.supportedAssets.map((a) => a.toUpperCase());
      if (!supportedAssetsUpper.includes(normalizedAssetCode)) {
        throw new Error(`Asset ${request.assetCode} not supported by anchor`);
      }
    }

    const transfer = this.createTransfer('withdrawal', request);
    const token = this.generateInteractiveToken();

    transfer.interactiveToken = token;
    transfer.interactiveUrl = this.buildInteractiveUrl(transfer.id, token.token);
    transfer.more_info_url = this.buildMoreInfoUrl(transfer.id);
    transfer.metadata = {
      ...transfer.metadata,
      dest: request.dest,
      destExtra: request.destExtra,
    };

    await this.store.create(transfer);

    return {
      id: transfer.id,
      url: transfer.interactiveUrl,
      type: 'interactive_customer_info_needed',
    };
  }

  async getTransfer(id: string): Promise<Transfer | null> {
    return this.store.getById(id);
  }

  async completeInteractive(id: string, token: string): Promise<Transfer> {
    const transfer = await this.validateInteractiveToken(id, token);

    if (transfer.interactiveToken) {
      transfer.interactiveToken.used = true;
    }

    const updated = await this.store.update(id, {
      status: this.getNextStatus(transfer),
      interactiveToken: transfer.interactiveToken,
    });

    if (!updated) {
      throw new Error(`Failed to update transfer ${id}`);
    }

    return updated;
  }

  async updateStatus(
    id: string,
    status: TransferStatus,
    updates?: Partial<Transfer>
  ): Promise<Transfer> {
    const existing = await this.store.getById(id);
    if (!existing) {
      throw new Error(`Transfer ${id} not found`);
    }

    const completedAt = this.isTerminalStatus(status) ? new Date() : undefined;

    const updated = await this.store.update(id, {
      status,
      completedAt,
      ...updates,
    });

    if (!updated) {
      throw new Error(`Failed to update transfer ${id}`);
    }

    return updated;
  }

  private createTransfer(
    kind: TransferKind,
    request: DepositRequest | WithdrawalRequest
  ): Transfer {
    const now = new Date();

    return {
      id: this.generateTransferId(),
      kind,
      mode: 'interactive',
      status: TransferStatus.INTERACTIVE,
      assetCode: request.assetCode,
      assetIssuer: request.assetIssuer,
      account: request.account,
      amount: request.amount,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };
  }

  private generateTransferId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateInteractiveToken(): InteractiveToken {
    const token = randomBytes(32).toString('hex');
    const createdAt = new Date();
    const expirationMs = this.config.tokenExpiration ?? DEFAULT_TOKEN_EXPIRATION_MS;
    const expiresAt = new Date(createdAt.getTime() + expirationMs);

    return {
      token,
      createdAt,
      expiresAt,
      used: false,
    };
  }

  private buildInteractiveUrl(transferId: string, token: string): string {
    const url = new URL(this.config.interactiveUrl);
    url.searchParams.set('transaction_id', transferId);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private buildMoreInfoUrl(transferId: string): string {
    if (!this.config.baseUrl) {
      throw new Error('baseUrl is required in Sep24TransferConfig to generate more_info_url');
    }
    const url = new URL(this.config.baseUrl);
    url.pathname = '/sep24/transaction/more_info';
    url.searchParams.set('id', transferId);
    return url.toString();
  }

  private async validateInteractiveToken(id: string, token: string): Promise<Transfer> {
    const transfer = await this.store.getById(id);
    if (!transfer) {
      throw new Error(`Transfer ${id} not found`);
    }

    if (!transfer.interactiveToken) {
      throw new Error(`Transfer ${id} has no interactive token`);
    }

    if (transfer.interactiveToken.token !== token) {
      throw new Error('Invalid token');
    }

    if (transfer.interactiveToken.used) {
      throw new Error('Token already used');
    }

    if (transfer.interactiveToken.expiresAt < new Date()) {
      throw new Error('Token expired');
    }

    return transfer;
  }

  private getNextStatus(transfer: Transfer): TransferStatus {
    if (transfer.status === 'incomplete') {
      return transfer.kind === 'deposit'
        ? TransferStatus.PENDING_USER_TRANSFER_START
        : TransferStatus.PENDING_ANCHOR;
    }
    return transfer.status;
  }

  private isTerminalStatus(status: TransferStatus): boolean {
    return [TransferStatus.COMPLETED, TransferStatus.ERROR, TransferStatus.REFUNDED].includes(
      status
    );
  }
}

import type {
  Transfer,
  TransferStatus,
  TransferStatusResponse,
  DepositRequest,
  DepositResponse,
  WithdrawalRequest,
  WithdrawalResponse,
  Sep24TransferConfig,
  FindByAccountOptions,
} from './types.js';
import { TransferStore, InMemoryTransferStore } from './transfer-store.js';
import { Sep24Service } from './sep24/sep24-service.js';

export class TransferManager {
  private store: TransferStore;
  private sep24Service: Sep24Service;

  constructor(config: Sep24TransferConfig, store?: TransferStore) {
    this.store = store ?? new InMemoryTransferStore();
    this.sep24Service = new Sep24Service(this.store, config);
  }

  async initiateDeposit(mode: 'interactive', request: DepositRequest): Promise<DepositResponse> {
    if (mode !== 'interactive') {
      throw new Error('Only interactive mode is supported for SEP-24');
    }

    return this.sep24Service.initiateDeposit(request);
  }

  async initiateWithdraw(
    mode: 'interactive',
    request: WithdrawalRequest
  ): Promise<WithdrawalResponse> {
    if (mode !== 'interactive') {
      throw new Error('Only interactive mode is supported for SEP-24');
    }

    return this.sep24Service.initiateWithdrawal(request);
  }

  async getStatus(id: string): Promise<TransferStatusResponse> {
    const transfer = await this.sep24Service.getTransfer(id);
    if (!transfer) {
      throw new Error(`Transfer ${id} not found`);
    }

    return this.formatStatusResponse(transfer);
  }

  async getStatusByStellarTransactionId(
    stellarTxId: string
  ): Promise<TransferStatusResponse | null> {
    const transfer = await this.store.getByStellarTransactionId(stellarTxId);
    if (!transfer) {
      return null;
    }
    return this.formatStatusResponse(transfer);
  }

  async getStatusByExternalTransactionId(
    externalTxId: string
  ): Promise<TransferStatusResponse | null> {
    const transfer = await this.store.getByExternalTransactionId(externalTxId);
    if (!transfer) {
      return null;
    }
    return this.formatStatusResponse(transfer);
  }

  async completeInteractive(id: string, token: string): Promise<Transfer> {
    return this.sep24Service.completeInteractive(id, token);
  }

  async updateTransferStatus(
    id: string,
    status: TransferStatus,
    updates?: Partial<Transfer>
  ): Promise<Transfer> {
    return this.sep24Service.updateStatus(id, status, updates);
  }

  async getTransfersByAccount(account: string, opts?: FindByAccountOptions): Promise<Transfer[]> {
    return this.store.listByAccount(account, opts);
  }

  private formatStatusResponse(transfer: Transfer): TransferStatusResponse {
    return {
      transaction: {
        id: transfer.id,
        kind: transfer.kind,
        status: transfer.status,
        amount_in: transfer.amount,
        amount_out: transfer.amount,
        started_at: transfer.createdAt.toISOString(),
        completed_at: transfer.completedAt?.toISOString(),
        stellar_transaction_id: transfer.stellarTransactionId,
        external_transaction_id: transfer.externalTransactionId,
        message: transfer.message,
        refunded: transfer.status === 'refunded',
        more_info_url: transfer.more_info_url!,
        to: transfer.account,
        from: transfer.account,
      },
    };
  }
}

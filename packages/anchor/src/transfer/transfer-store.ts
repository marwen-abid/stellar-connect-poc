import type { Transfer, FindByAccountOptions } from './types.js';

export interface TransferStore {
  create(transfer: Transfer): Promise<void>;
  getById(id: string): Promise<Transfer | null>;
  listByAccount(account: string, options?: FindByAccountOptions): Promise<Transfer[]>;
  getByInteractiveToken(token: string): Promise<Transfer | null>;
  getByStellarTransactionId(stellarTxId: string): Promise<Transfer | null>;
  getByExternalTransactionId(externalTxId: string): Promise<Transfer | null>;
  update(id: string, updates: Partial<Transfer>): Promise<Transfer | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryTransferStore implements TransferStore {
  private transfers = new Map<string, Transfer>();
  private tokenIndex = new Map<string, string>();

  async create(transfer: Transfer): Promise<void> {
    this.transfers.set(transfer.id, { ...transfer });

    if (transfer.interactiveToken) {
      this.tokenIndex.set(transfer.interactiveToken.token, transfer.id);
    }
  }

  async getById(id: string): Promise<Transfer | null> {
    const transfer = this.transfers.get(id);
    return transfer ? { ...transfer } : null;
  }

  async listByAccount(account: string, options?: FindByAccountOptions): Promise<Transfer[]> {
    let results: Transfer[] = [];

    for (const transfer of this.transfers.values()) {
      if (transfer.account === account) {
        results.push({ ...transfer });
      }
    }

    if (options?.assetCode) {
      results = results.filter((t) => t.assetCode === options.assetCode);
    }

    if (options?.kind) {
      results = results.filter((t) => t.kind === options.kind);
    }

    if (options?.noOlderThan) {
      results = results.filter((t) => t.createdAt >= options.noOlderThan!);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getByInteractiveToken(token: string): Promise<Transfer | null> {
    const transferId = this.tokenIndex.get(token);
    if (!transferId) {
      return null;
    }

    return this.getById(transferId);
  }

  async getByStellarTransactionId(stellarTxId: string): Promise<Transfer | null> {
    for (const transfer of this.transfers.values()) {
      if (transfer.stellarTransactionId === stellarTxId) {
        return { ...transfer };
      }
    }
    return null;
  }

  async getByExternalTransactionId(externalTxId: string): Promise<Transfer | null> {
    for (const transfer of this.transfers.values()) {
      if (transfer.externalTransactionId === externalTxId) {
        return { ...transfer };
      }
    }
    return null;
  }

  async update(id: string, updates: Partial<Transfer>): Promise<Transfer | null> {
    const existing = this.transfers.get(id);
    if (!existing) {
      return null;
    }

    const updated: Transfer = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    this.transfers.set(id, updated);

    if (updated.interactiveToken && updates.interactiveToken) {
      this.tokenIndex.set(updated.interactiveToken.token, id);
    }

    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const transfer = this.transfers.get(id);
    if (!transfer) {
      return false;
    }

    if (transfer.interactiveToken) {
      this.tokenIndex.delete(transfer.interactiveToken.token);
    }

    return this.transfers.delete(id);
  }

  async clear(): Promise<void> {
    this.transfers.clear();
    this.tokenIndex.clear();
  }

  get size(): number {
    return this.transfers.size;
  }

  async save(transfer: Transfer): Promise<void> {
    return this.create(transfer);
  }

  async findById(id: string): Promise<Transfer | null> {
    return this.getById(id);
  }

  async findByAccount(account: string): Promise<Transfer[]> {
    return this.listByAccount(account);
  }

  async findByAccountWithOptions(
    account: string,
    options?: FindByAccountOptions
  ): Promise<Transfer[]> {
    return this.listByAccount(account, options);
  }

  async findByInteractiveToken(token: string): Promise<Transfer | null> {
    return this.getByInteractiveToken(token);
  }

  async findByStellarTransactionId(stellarTxId: string): Promise<Transfer | null> {
    return this.getByStellarTransactionId(stellarTxId);
  }

  async findByExternalTransactionId(externalTxId: string): Promise<Transfer | null> {
    return this.getByExternalTransactionId(externalTxId);
  }
}

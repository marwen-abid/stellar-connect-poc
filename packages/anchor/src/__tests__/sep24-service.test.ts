import { describe, it, expect, beforeEach } from 'vitest';
import { Sep24Service } from '../transfer/sep24/sep24-service.js';
import { TransferStatus } from '../transfer/types.js';
import type {
  Transfer,
  DepositRequest,
  WithdrawalRequest,
  FindByAccountOptions,
} from '../transfer/types.js';
import type { TransferStore } from '../transfer/transfer-store.js';

class MockTransferStore implements TransferStore {
  private transfers = new Map<string, Transfer>();

  async create(transfer: Transfer): Promise<void> {
    this.transfers.set(transfer.id, transfer);
  }

  async getById(id: string): Promise<Transfer | null> {
    return this.transfers.get(id) || null;
  }

  async update(id: string, updates: Partial<Transfer>): Promise<Transfer | null> {
    const existing = this.transfers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.transfers.set(id, updated);
    return updated;
  }

  async listByAccount(account: string, options?: FindByAccountOptions): Promise<Transfer[]> {
    let results = Array.from(this.transfers.values()).filter((t) => t.account === account);

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
    return (
      Array.from(this.transfers.values()).find((t) => t.interactiveToken?.token === token) || null
    );
  }

  async getByStellarTransactionId(stellarTxId: string): Promise<Transfer | null> {
    return (
      Array.from(this.transfers.values()).find((t) => t.stellarTransactionId === stellarTxId) ||
      null
    );
  }

  async getByExternalTransactionId(externalTxId: string): Promise<Transfer | null> {
    return (
      Array.from(this.transfers.values()).find((t) => t.externalTransactionId === externalTxId) ||
      null
    );
  }

  async delete(id: string): Promise<boolean> {
    return this.transfers.delete(id);
  }
}

describe('Sep24Service', () => {
  let service: Sep24Service;
  let store: MockTransferStore;

  beforeEach(() => {
    store = new MockTransferStore();
  });

  describe('initiateDeposit with asset validation', () => {
    it('accepts supported asset', async () => {
      service = new Sep24Service(store, {
        baseUrl: 'http://localhost:3000',
        interactiveUrl: 'http://localhost:3000/interactive',
        supportedAssets: ['USDC', 'native'],
      });

      const request: DepositRequest = {
        assetCode: 'USDC',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
      };

      const response = await service.initiateDeposit(request);

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('url');
      expect(response.type).toBe('interactive_customer_info_needed');
    });

    it('rejects unsupported asset', async () => {
      service = new Sep24Service(store, {
        baseUrl: 'http://localhost:3000',
        interactiveUrl: 'http://localhost:3000/interactive',
        supportedAssets: ['USDC'],
      });

      const request: DepositRequest = {
        assetCode: 'FAKE',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
      };

      await expect(service.initiateDeposit(request)).rejects.toThrow(
        'Asset FAKE not supported by anchor'
      );
    });

    it('allows any asset when supportedAssets undefined', async () => {
      service = new Sep24Service(store, {
        baseUrl: 'http://localhost:3000',
        interactiveUrl: 'http://localhost:3000/interactive',
      });

      const request: DepositRequest = {
        assetCode: 'ANYTHING',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
      };

      const response = await service.initiateDeposit(request);

      expect(response).toHaveProperty('id');
      expect(response.type).toBe('interactive_customer_info_needed');
    });

    it('case-insensitive asset matching', async () => {
      service = new Sep24Service(store, {
        baseUrl: 'http://localhost:3000',
        interactiveUrl: 'http://localhost:3000/interactive',
        supportedAssets: ['USDC'],
      });

      const request: DepositRequest = {
        assetCode: 'usdc',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
      };

      const response = await service.initiateDeposit(request);

      expect(response).toHaveProperty('id');
      expect(response.type).toBe('interactive_customer_info_needed');
    });
  });

  describe('initiateWithdrawal with asset validation', () => {
    it('accepts supported asset', async () => {
      service = new Sep24Service(store, {
        interactiveUrl: 'http://localhost:3000/interactive',
        baseUrl: 'http://localhost:3000',
        supportedAssets: ['USDC', 'native'],
      });

      const request: WithdrawalRequest = {
        assetCode: 'USDC',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
        dest: 'bank-account-123',
      };

      const response = await service.initiateWithdrawal(request);

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('url');
      expect(response.type).toBe('interactive_customer_info_needed');
    });

    it('rejects unsupported asset', async () => {
      service = new Sep24Service(store, {
        interactiveUrl: 'http://localhost:3000/interactive',
        baseUrl: 'http://localhost:3000',
        supportedAssets: ['USDC'],
      });

      const request: WithdrawalRequest = {
        assetCode: 'FAKE',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
        dest: 'bank-account-123',
      };

      await expect(service.initiateWithdrawal(request)).rejects.toThrow(
        'Asset FAKE not supported by anchor'
      );
    });

    it('allows any asset when supportedAssets undefined', async () => {
      service = new Sep24Service(store, {
        interactiveUrl: 'http://localhost:3000/interactive',
        baseUrl: 'http://localhost:3000',
      });

      const request: WithdrawalRequest = {
        assetCode: 'ANYTHING',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
        dest: 'bank-account-123',
      };

      const response = await service.initiateWithdrawal(request);

      expect(response).toHaveProperty('id');
      expect(response.type).toBe('interactive_customer_info_needed');
    });

    it('case-insensitive asset matching', async () => {
      service = new Sep24Service(store, {
        interactiveUrl: 'http://localhost:3000/interactive',
        baseUrl: 'http://localhost:3000',
        supportedAssets: ['USDC'],
      });

      const request: WithdrawalRequest = {
        assetCode: 'usdc',
        account: 'GCLIENT123456789012345678901234567890123456789012345',
        amount: '100',
        dest: 'bank-account-123',
      };

      const response = await service.initiateWithdrawal(request);

      expect(response).toHaveProperty('id');
      expect(response.type).toBe('interactive_customer_info_needed');
    });
  });
});

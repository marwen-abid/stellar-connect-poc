import { describe, it, expect, beforeEach } from 'vitest';
import { TransferManager } from '../transfer/transfer-manager.js';
import { InMemoryTransferStore } from '../transfer/transfer-store.js';
import { TransferStatus } from '../transfer/types.js';
import type { Transfer, FindByAccountOptions } from '../transfer/types.js';

describe('TransferManager', () => {
  let manager: TransferManager;
  let store: InMemoryTransferStore;
  const account = 'GABC123456789012345678901234567890123456789012345';

  beforeEach(() => {
    store = new InMemoryTransferStore();
    manager = new TransferManager(
      {
        interactiveUrl: 'http://localhost:3000/interactive',
        baseUrl: 'http://localhost:3000',
      },
      store
    );
  });

  const createTransfer = (overrides: Partial<Transfer> = {}): Transfer => {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    return {
      id: `tx_${Math.random().toString(36).slice(2)}`,
      kind: 'deposit',
      mode: 'interactive',
      status: TransferStatus.COMPLETED,
      assetCode: 'USDC',
      account,
      amount: '100',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides,
    };
  };

  describe('getTransfersByAccount with filtering', () => {
    beforeEach(async () => {
      await store.save(createTransfer({
        id: 'tx_1',
        assetCode: 'USDC',
        kind: 'deposit',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      }));
      
      await store.save(createTransfer({
        id: 'tx_2',
        assetCode: 'BTC',
        kind: 'deposit',
        createdAt: new Date('2024-01-02T10:00:00Z'),
      }));
      
      await store.save(createTransfer({
        id: 'tx_3',
        assetCode: 'USDC',
        kind: 'withdrawal',
        createdAt: new Date('2024-01-03T10:00:00Z'),
      }));
    });

    it('returns all transfers without options', async () => {
      const results = await manager.getTransfersByAccount(account);
      
      expect(results).toHaveLength(3);
      expect(results.map(t => t.id)).toEqual(['tx_3', 'tx_2', 'tx_1']);
    });

    it('filters by assetCode via options', async () => {
      const options: FindByAccountOptions = { assetCode: 'USDC' };
      const results = await manager.getTransfersByAccount(account, options);
      
      expect(results).toHaveLength(2);
      expect(results.every(t => t.assetCode === 'USDC')).toBe(true);
    });

    it('filters by kind via options', async () => {
      const options: FindByAccountOptions = { kind: 'deposit' };
      const results = await manager.getTransfersByAccount(account, options);
      
      expect(results).toHaveLength(2);
      expect(results.every(t => t.kind === 'deposit')).toBe(true);
    });

    it('filters by noOlderThan via options', async () => {
      const cutoffDate = new Date('2024-01-02T00:00:00Z');
      const options: FindByAccountOptions = { noOlderThan: cutoffDate };
      const results = await manager.getTransfersByAccount(account, options);
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(['tx_3', 'tx_2']);
    });

    it('limits results via options', async () => {
      const options: FindByAccountOptions = { limit: 2 };
      const results = await manager.getTransfersByAccount(account, options);
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(['tx_3', 'tx_2']);
    });

    it('combines multiple filter options', async () => {
      const options: FindByAccountOptions = {
        assetCode: 'USDC',
        kind: 'deposit',
        limit: 1,
      };
      const results = await manager.getTransfersByAccount(account, options);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tx_1');
    });
  });

  describe('backward compatibility', () => {
    beforeEach(async () => {
      await store.save(createTransfer({ id: 'tx_1' }));
      await store.save(createTransfer({ id: 'tx_2' }));
    });

    it('works when called without options parameter', async () => {
      const results = await manager.getTransfersByAccount(account);
      
      expect(results).toHaveLength(2);
    });
  });
});

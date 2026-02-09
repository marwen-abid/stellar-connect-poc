import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTransferStore } from '../transfer/transfer-store.js';
import { TransferStatus } from '../transfer/types.js';
import type { Transfer, FindByAccountOptions } from '../transfer/types.js';

describe('InMemoryTransferStore', () => {
  let store: InMemoryTransferStore;
  const account1 = 'GABC123456789012345678901234567890123456789012345';
  const account2 = 'GDEF123456789012345678901234567890123456789012345';

  beforeEach(() => {
    store = new InMemoryTransferStore();
  });

  const createTransfer = (overrides: Partial<Transfer> = {}): Transfer => {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    return {
      id: `tx_${Math.random().toString(36).slice(2)}`,
      kind: 'deposit',
      mode: 'interactive',
      status: TransferStatus.COMPLETED,
      assetCode: 'USDC',
      account: account1,
      amount: '100',
      createdAt: baseDate,
      updatedAt: baseDate,
      ...overrides,
    };
  };

  describe('findByAccountWithOptions', () => {
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
      
      await store.save(createTransfer({
        id: 'tx_4',
        assetCode: 'BTC',
        kind: 'withdrawal',
        createdAt: new Date('2024-01-04T10:00:00Z'),
      }));
      
      await store.save(createTransfer({
        id: 'tx_5',
        assetCode: 'USDC',
        kind: 'deposit',
        createdAt: new Date('2024-01-05T10:00:00Z'),
      }));
      
      await store.save(createTransfer({
        id: 'tx_other',
        account: account2,
        assetCode: 'USDC',
        kind: 'deposit',
        createdAt: new Date('2024-01-06T10:00:00Z'),
      }));
    });

    it('returns all transfers when no options provided', async () => {
      const results = await store.findByAccountWithOptions(account1);
      expect(results).toHaveLength(5);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_4', 'tx_3', 'tx_2', 'tx_1']);
    });

    it('filters by assetCode', async () => {
      const options: FindByAccountOptions = { assetCode: 'USDC' };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(3);
      expect(results.every(t => t.assetCode === 'USDC')).toBe(true);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_3', 'tx_1']);
    });

    it('filters by kind deposit', async () => {
      const options: FindByAccountOptions = { kind: 'deposit' };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(3);
      expect(results.every(t => t.kind === 'deposit')).toBe(true);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_2', 'tx_1']);
    });

    it('filters by kind withdrawal', async () => {
      const options: FindByAccountOptions = { kind: 'withdrawal' };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(2);
      expect(results.every(t => t.kind === 'withdrawal')).toBe(true);
      expect(results.map(t => t.id)).toEqual(['tx_4', 'tx_3']);
    });

    it('filters by noOlderThan', async () => {
      const cutoffDate = new Date('2024-01-03T00:00:00Z');
      const options: FindByAccountOptions = { noOlderThan: cutoffDate };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(3);
      expect(results.every(t => t.createdAt >= cutoffDate)).toBe(true);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_4', 'tx_3']);
    });

    it('applies limit', async () => {
      const options: FindByAccountOptions = { limit: 2 };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_4']);
    });

    it('combines assetCode and kind filters', async () => {
      const options: FindByAccountOptions = { 
        assetCode: 'USDC', 
        kind: 'deposit' 
      };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(2);
      expect(results.every(t => t.assetCode === 'USDC' && t.kind === 'deposit')).toBe(true);
      expect(results.map(t => t.id)).toEqual(['tx_5', 'tx_1']);
    });

    it('combines all filters', async () => {
      const cutoffDate = new Date('2024-01-02T00:00:00Z');
      const options: FindByAccountOptions = {
        assetCode: 'USDC',
        kind: 'deposit',
        noOlderThan: cutoffDate,
        limit: 1,
      };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tx_5');
      expect(results[0].assetCode).toBe('USDC');
      expect(results[0].kind).toBe('deposit');
    });

    it('returns empty array when no matches', async () => {
      const options: FindByAccountOptions = { assetCode: 'XLM' };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(0);
    });

    it('sorts by createdAt descending before applying limit', async () => {
      const options: FindByAccountOptions = { limit: 3 };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results).toHaveLength(3);
      expect(results[0].createdAt.getTime()).toBeGreaterThan(results[1].createdAt.getTime());
      expect(results[1].createdAt.getTime()).toBeGreaterThan(results[2].createdAt.getTime());
    });

    it('does not return transfers from other accounts', async () => {
      const options: FindByAccountOptions = { assetCode: 'USDC' };
      const results = await store.findByAccountWithOptions(account1, options);
      
      expect(results.every(t => t.account === account1)).toBe(true);
      expect(results.some(t => t.id === 'tx_other')).toBe(false);
    });
  });

  describe('findByAccount - backward compatibility', () => {
    beforeEach(async () => {
      await store.save(createTransfer({
        id: 'tx_1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      }));
      
      await store.save(createTransfer({
        id: 'tx_2',
        createdAt: new Date('2024-01-02T10:00:00Z'),
      }));
    });

    it('still works without options', async () => {
      const results = await store.findByAccount(account1);
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(['tx_2', 'tx_1']);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountInspector, AccountType, AuthPath } from '../account-inspector';
import { Horizon } from '@stellar/stellar-sdk';

describe('AccountInspector', () => {
  let inspector: AccountInspector;
  let mockServer: any;

  beforeEach(() => {
    mockServer = {
      loadAccount: vi.fn(),
    };
    inspector = new AccountInspector({ horizonUrl: 'https://horizon-testnet.stellar.org' });
    (inspector as any).server = mockServer;
  });

  describe('inspect', () => {
    it('should detect funded classic account', async () => {
      const mockAccount = {
        id: 'GABC123',
        sequence: '12345',
        balances: [
          {
            balance: '100.0000000',
            asset_type: 'native',
          },
        ],
        thresholds: {
          low_threshold: 0,
          med_threshold: 0,
          high_threshold: 0,
        },
        flags: {
          auth_required: false,
          auth_revocable: false,
          auth_immutable: false,
        },
      };

      mockServer.loadAccount.mockResolvedValue(mockAccount);

      const result = await inspector.inspect('GABC123');

      expect(result.type).toBe(AccountType.CLASSIC_FUNDED);
      expect(result.address).toBe('GABC123');
      expect(result.balances).toBeDefined();
      expect(result.sequence).toBe('12345');
      expect(result.thresholds).toBeDefined();
      expect(result.flags).toBeDefined();
    });

    it('should detect unfunded classic account', async () => {
      mockServer.loadAccount.mockRejectedValue({
        response: { status: 404 },
      });

      const result = await inspector.inspect('GDEF456');

      expect(result.type).toBe(AccountType.CLASSIC_UNFUNDED);
      expect(result.address).toBe('GDEF456');
      expect(result.balances).toBeUndefined();
    });

    it('should detect Soroban contract address', async () => {
      const result = await inspector.inspect('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4');

      expect(result.type).toBe(AccountType.SOROBAN_CONTRACT);
      expect(result.address).toBe('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4');
    });

    it('should handle unknown account type on error', async () => {
      mockServer.loadAccount.mockRejectedValue(new Error('Network error'));

      const result = await inspector.inspect('GXYZ789');

      expect(result.type).toBe(AccountType.UNKNOWN);
      expect(result.address).toBe('GXYZ789');
    });

    it('should include account thresholds', async () => {
      const mockAccount = {
        id: 'GABC123',
        sequence: '12345',
        balances: [],
        thresholds: {
          low_threshold: 1,
          med_threshold: 2,
          high_threshold: 3,
        },
        flags: {
          auth_required: false,
          auth_revocable: false,
          auth_immutable: false,
        },
      };

      mockServer.loadAccount.mockResolvedValue(mockAccount);

      const result = await inspector.inspect('GABC123');

      expect(result.thresholds).toEqual({
        low_threshold: 1,
        med_threshold: 2,
        high_threshold: 3,
      });
    });

    it('should include account flags', async () => {
      const mockAccount = {
        id: 'GABC123',
        sequence: '12345',
        balances: [],
        thresholds: {
          low_threshold: 0,
          med_threshold: 0,
          high_threshold: 0,
        },
        flags: {
          auth_required: true,
          auth_revocable: true,
          auth_immutable: false,
        },
      };

      mockServer.loadAccount.mockResolvedValue(mockAccount);

      const result = await inspector.inspect('GABC123');

      expect(result.flags).toEqual({
        auth_required: true,
        auth_revocable: true,
        auth_immutable: false,
      });
    });
  });

  describe('resolveAuthPath', () => {
    it('should return SEP10 for classic account with SEP10 support', () => {
      const result = inspector.resolveAuthPath('GABC123', {
        supportsSep10: true,
        supportsSep45: false,
      });

      expect(result).toBe(AuthPath.SEP10);
    });

    it('should return SEP45 for contract address with SEP45 support', () => {
      const result = inspector.resolveAuthPath('CAAAAAAA', {
        supportsSep10: false,
        supportsSep45: true,
      });

      expect(result).toBe(AuthPath.SEP45);
    });

    it('should return SEP10_OR_SEP45 when both supported', () => {
      const result = inspector.resolveAuthPath('GABC123', {
        supportsSep10: true,
        supportsSep45: true,
      });

      expect(result).toBe(AuthPath.SEP10_OR_SEP45);
    });

    it('should return UNSUPPORTED when neither supported', () => {
      const result = inspector.resolveAuthPath('GABC123', {
        supportsSep10: false,
        supportsSep45: false,
      });

      expect(result).toBe(AuthPath.UNSUPPORTED);
    });

    it('should prefer SEP45 for contract with both capabilities', () => {
      const result = inspector.resolveAuthPath('CAAAAAAA', {
        supportsSep10: true,
        supportsSep45: true,
      });

      expect(result).toBe(AuthPath.SEP10_OR_SEP45);
    });

    it('should return SEP10 when only SEP10 supported for classic', () => {
      const result = inspector.resolveAuthPath('GABC123', {
        supportsSep10: true,
        supportsSep45: false,
      });

      expect(result).toBe(AuthPath.SEP10);
    });

    it('should return SEP45 when only SEP45 supported for contract', () => {
      const result = inspector.resolveAuthPath('CAAAAAAA', {
        supportsSep10: false,
        supportsSep45: true,
      });

      expect(result).toBe(AuthPath.SEP45);
    });

    it('should fallback to SEP45 for classic account when only SEP45 available', () => {
      const result = inspector.resolveAuthPath('GABC123', {
        supportsSep10: false,
        supportsSep45: true,
      });

      expect(result).toBe(AuthPath.SEP45);
    });
  });
});

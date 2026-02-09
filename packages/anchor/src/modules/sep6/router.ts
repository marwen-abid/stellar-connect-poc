import { Router } from 'express';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type { AnchorServer } from '../../anchor-server.js';
import type { Sep6Hooks } from '../../config/types.js';
import { SepError, badRequest } from '../../errors.js';
import { TransferStatus } from '../../transfer/types.js';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    iss: string;
    iat: number;
    exp: number;
  };
}

export function createSep6Router(server: AnchorServer, hooks?: Sep6Hooks): Router {
  const router = Router();
  const authMiddleware = server.authIssuer.requireAuth();

  router.get('/info', (_req, res) => {
    try {
      const deposit: Record<string, any> = {};
      const withdraw: Record<string, any> = {};

      for (const [code, asset] of Object.entries(server.config.assets)) {
        if (asset.deposit?.enabled) {
          deposit[code] = {
            enabled: true,
            authentication_required: true,
            min_amount: asset.deposit.minAmount,
            max_amount: asset.deposit.maxAmount,
            fee_fixed: asset.deposit.feeFixed,
            fee_percent: asset.deposit.feePercent,
            fields: asset.deposit.fields || {},
          };
        }

        if (asset.withdraw?.enabled) {
          withdraw[code] = {
            enabled: true,
            authentication_required: true,
            min_amount: asset.withdraw.minAmount,
            max_amount: asset.withdraw.maxAmount,
            fee_fixed: asset.withdraw.feeFixed,
            fee_percent: asset.withdraw.feePercent,
            fields: asset.withdraw.fields || {},
          };
        }
      }

      res.json({
        deposit,
        withdraw,
        fee: { enabled: false, description: '' },
        features: { account_creation: false, claimable_balances: false },
      });
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 500);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.get('/deposit', authMiddleware, async (req: Request, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const account = authReq.user?.sub;

      if (!account) {
        throw badRequest('account is required');
      }

      const { asset_code, memo_type, memo } = req.query as Record<string, string | undefined>;

      if (!asset_code) {
        throw badRequest('asset_code is required');
      }

      const assetConfig = server.config.assets[asset_code];
      if (!assetConfig) {
        throw badRequest(`Asset ${asset_code} is not supported`);
      }

      if (!assetConfig.deposit?.enabled) {
        throw badRequest(`Deposits are not enabled for ${asset_code}`);
      }

      const transactionId = randomBytes(16).toString('hex');

      const transfer = {
        id: transactionId,
        kind: 'deposit' as const,
        status: TransferStatus.INITIATING,
        assetCode: asset_code,
        account,
        amount: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        mode: 'interactive' as const,
      };

      await server.store.create(transfer);

      if (hooks?.onDeposit) {
        const context = {
          transfer,
          assetCode: asset_code,
          account,
          params: req.query as Record<string, unknown>,
          store: server.store,
          updateStatus: async (status: string, message?: string) => {
            await server.store.update(transactionId, {
              status: status as TransferStatus,
              message,
              updatedAt: new Date(),
            });
          },
          setStellarTransactionId: async (txId: string) => {
            await server.store.update(transactionId, {
              stellarTransactionId: txId,
              updatedAt: new Date(),
            });
          },
        };

        const result = await hooks.onDeposit(context);

        res.json({
          how: result.how,
          id: transactionId,
          eta: result.eta,
          min_amount: result.minAmount,
          max_amount: result.maxAmount,
          fee_fixed: result.feeFixed,
          fee_percent: result.feePercent,
          extra_info: result.extraInfo,
        });
      } else {
        const how =
          `Send ${asset_code} to ${server.publicKey}${memo ? ` with memo: ${memo}` : ''}. ` +
          `Once received, we will credit your Stellar account ${account}.`;

        res.json({
          how,
          id: transactionId,
          eta: 300,
          min_amount: assetConfig.deposit.minAmount || 1,
          max_amount: assetConfig.deposit.maxAmount || 10000,
          fee_fixed: assetConfig.deposit.feeFixed || 0,
          fee_percent: assetConfig.deposit.feePercent || 0,
        });
      }
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 400);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.get('/withdraw', authMiddleware, async (req: Request, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const account = authReq.user?.sub;

      if (!account) {
        throw badRequest('account is required');
      }

      const { asset_code, type, dest, dest_extra } = req.query as Record<
        string,
        string | undefined
      >;

      if (!asset_code) {
        throw badRequest('asset_code is required');
      }

      if (!type) {
        throw badRequest('type is required');
      }

      const assetConfig = server.config.assets[asset_code];
      if (!assetConfig) {
        throw badRequest(`Asset ${asset_code} is not supported`);
      }

      if (!assetConfig.withdraw?.enabled) {
        throw badRequest(`Withdrawals are not enabled for ${asset_code}`);
      }

      const transactionId = randomBytes(16).toString('hex');

      const transfer = {
        id: transactionId,
        kind: 'withdrawal' as const,
        status: TransferStatus.INITIATING,
        assetCode: asset_code,
        account,
        amount: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        mode: 'interactive' as const,
      };

      await server.store.create(transfer);

      if (hooks?.onWithdraw) {
        const context = {
          transfer,
          assetCode: asset_code,
          account,
          type,
          dest,
          destExtra: dest_extra,
          params: req.query as Record<string, unknown>,
          store: server.store,
          updateStatus: async (status: string, message?: string) => {
            await server.store.update(transactionId, {
              status: status as TransferStatus,
              message,
              updatedAt: new Date(),
            });
          },
          setStellarTransactionId: async (txId: string) => {
            await server.store.update(transactionId, {
              stellarTransactionId: txId,
              updatedAt: new Date(),
            });
          },
        };

        const result = await hooks.onWithdraw(context);

        res.json({
          account_id: result.accountId,
          memo_type: result.memoType,
          memo: result.memo,
          id: transactionId,
          eta: result.eta,
          min_amount: result.minAmount,
          max_amount: result.maxAmount,
          fee_fixed: result.feeFixed,
          fee_percent: result.feePercent,
          extra_info: result.extraInfo,
        });
      } else {
        const memo = Math.floor(Math.random() * 1000000000).toString();

        res.json({
          account_id: server.publicKey,
          memo_type: 'id',
          memo,
          id: transactionId,
          eta: 300,
          min_amount: assetConfig.withdraw.minAmount || 1,
          max_amount: assetConfig.withdraw.maxAmount || 10000,
          fee_fixed: assetConfig.withdraw.feeFixed || 0,
          fee_percent: assetConfig.withdraw.feePercent || 0,
        });
      }
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 400);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  return router;
}

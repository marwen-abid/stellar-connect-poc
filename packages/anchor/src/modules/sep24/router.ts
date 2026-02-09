import { Router } from 'express';
import multer from 'multer';
import type { Request } from 'express';
import type { AnchorServer } from '../../anchor-server.js';
import type { Sep24Hooks } from '../../config/types.js';
import { SepError, badRequest, notFound } from '../../errors.js';
import { isValidStellarAddress } from '@stellarconnect/core';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    iss: string;
    iat: number;
    exp: number;
  };
}

const normalizeBaseUrl = (domain: string): string => {
  const trimmed = domain.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  const isLocal = trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${trimmed}`.replace(/\/$/, '');
};

export function createSep24Router(server: AnchorServer, hooks: Sep24Hooks): Router {
  const router = Router();
  const authMiddleware = server.authIssuer.requireAuth();
  const multipartFormParser = multer().none();

  router.get('/info', (_req, res) => {
    try {
      const deposit: Record<string, unknown> = {};
      const withdraw: Record<string, unknown> = {};

      for (const [code, asset] of Object.entries(server.config.assets)) {
        if (asset.deposit?.enabled) {
          const entry: Record<string, unknown> = {
            enabled: true,
            min_amount: asset.deposit.minAmount,
            max_amount: asset.deposit.maxAmount,
            fee_fixed: asset.deposit.feeFixed,
            fee_percent: asset.deposit.feePercent,
          };
          if (asset.deposit.fields && Object.keys(asset.deposit.fields).length > 0) {
            entry.fields = asset.deposit.fields;
          }
          deposit[code] = entry;
        }

        if (asset.withdraw?.enabled) {
          const entry: Record<string, unknown> = {
            enabled: true,
            min_amount: asset.withdraw.minAmount,
            max_amount: asset.withdraw.maxAmount,
            fee_fixed: asset.withdraw.feeFixed,
            fee_percent: asset.withdraw.feePercent,
          };
          if (asset.withdraw.fields && Object.keys(asset.withdraw.fields).length > 0) {
            entry.fields = asset.withdraw.fields;
          }
          withdraw[code] = entry;
        }
      }

      res.json({
        deposit,
        withdraw,
        fee: { enabled: false },
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

  router.post(
    '/transactions/deposit/interactive',
    authMiddleware,
    multipartFormParser,
    async (req: Request, res) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const account = authReq.user?.sub;
        const body = req.body as Record<string, string | undefined>;
        const { asset_code, amount, account: requestAccount } = body;

        if (!asset_code) {
          throw badRequest("'asset_code' is required");
        }

        if (requestAccount && !isValidStellarAddress(requestAccount)) {
          throw badRequest('invalid account');
        }

        const resolvedAccount = account ?? requestAccount;

        if (!resolvedAccount) {
          throw badRequest('account is required');
        }

        const params = {
          assetCode: asset_code,
          amount: amount?.toString(),
          account: resolvedAccount,
          memo: body.memo,
          memoType: body.memo_type,
          walletName: body.wallet_name,
          walletUrl: body.wallet_url,
          lang: body.lang,
          claimableBalanceSupported: body.claimable_balance_supported,
          mode: 'interactive' as const,
        };

        const result = await server.transferManager.initiateDeposit('interactive', params);

        res.json({
          type: result.type,
          id: result.id,
          url: result.url,
        });
      } catch (error: any) {
        const sepError =
          error instanceof SepError
            ? error
            : new SepError(
                error?.message ?? 'Internal server error',
                'error',
                error?.status ?? 400
              );
        res.status(sepError.status).json(sepError.toJSON());
      }
    }
  );

  router.post(
    '/transactions/withdraw/interactive',
    authMiddleware,
    multipartFormParser,
    async (req: Request, res) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const account = authReq.user?.sub;
        const {
          asset_code,
          amount,
          dest,
          dest_extra,
          account: requestAccount,
        } = req.body as Record<string, string>;

        if (!asset_code) {
          throw badRequest("'asset_code' is required");
        }

        if (requestAccount && !isValidStellarAddress(requestAccount)) {
          throw badRequest('invalid account');
        }

        const params = {
          assetCode: asset_code,
          amount: amount?.toString(),
          account: account ?? requestAccount,
          dest: dest || account,
          destExtra: dest_extra,
          memo: (req.body as Record<string, string | undefined>).memo,
          memoType: (req.body as Record<string, string | undefined>).memo_type,
          walletName: (req.body as Record<string, string | undefined>).wallet_name,
          walletUrl: (req.body as Record<string, string | undefined>).wallet_url,
          lang: (req.body as Record<string, string | undefined>).lang,
          claimableBalanceSupported: (req.body as Record<string, string | undefined>)
            .claimable_balance_supported,
          mode: 'interactive' as const,
        };

        if (!params.account) {
          throw badRequest('account is required');
        }

        const result = await server.transferManager.initiateWithdraw('interactive', params);

        res.json({
          type: result.type,
          id: result.id,
          url: result.url,
        });
      } catch (error: any) {
        const sepError =
          error instanceof SepError
            ? error
            : new SepError(
                error?.message ?? 'Internal server error',
                'error',
                error?.status ?? 400
              );
        res.status(sepError.status).json(sepError.toJSON());
      }
    }
  );

  router.get('/transaction', authMiddleware, async (req: Request, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : undefined;
      const stellarTransactionId =
        typeof req.query.stellar_transaction_id === 'string'
          ? req.query.stellar_transaction_id
          : undefined;
      const externalTransactionId =
        typeof req.query.external_transaction_id === 'string'
          ? req.query.external_transaction_id
          : undefined;

      if (!id && !stellarTransactionId && !externalTransactionId) {
        throw badRequest(
          'Missing required parameter: id, stellar_transaction_id, or external_transaction_id'
        );
      }

      let response;

      if (id) {
        try {
          response = await server.transferManager.getStatus(id);
        } catch {
          throw notFound('Transaction not found');
        }
      } else if (stellarTransactionId) {
        response =
          await server.transferManager.getStatusByStellarTransactionId(stellarTransactionId);
        if (!response) {
          throw notFound('Transaction not found');
        }
      } else if (externalTransactionId) {
        response =
          await server.transferManager.getStatusByExternalTransactionId(externalTransactionId);
        if (!response) {
          throw notFound('Transaction not found');
        }
      }

      res.json(response);
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 400);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.get('/transactions', authMiddleware, async (req: Request, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const account = authReq.user?.sub;
      if (!account) {
        throw badRequest('account is required');
      }

      const assetCode = typeof req.query.asset_code === 'string' ? req.query.asset_code : undefined;

      if (assetCode && !server.config.assets[assetCode]) {
        throw badRequest(`'${assetCode}' is not a supported asset`);
      }

      const kind =
        typeof req.query.kind === 'string'
          ? (req.query.kind as 'deposit' | 'withdrawal')
          : undefined;
      const noOlderThan =
        typeof req.query.no_older_than === 'string' ? new Date(req.query.no_older_than) : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

      const transfers = await server.transferManager.getTransfersByAccount(account, {
        assetCode,
        kind,
        noOlderThan,
        limit,
      });

      const transactions = transfers.map((transfer) => ({
        id: transfer.id,
        kind: transfer.kind,
        status: transfer.status,
        status_eta: transfer.status === 'incomplete' ? 3 : undefined,
        amount_in: transfer.amount,
        amount_out: transfer.amount,
        amount_fee: '0',
        started_at: transfer.createdAt.toISOString(),
        completed_at: transfer.completedAt?.toISOString(),
        stellar_transaction_id: transfer.stellarTransactionId,
        external_transaction_id: transfer.externalTransactionId,
        message: transfer.message,
        refunded: transfer.status === 'refunded',
        more_info_url:
          transfer.more_info_url ||
          `${normalizeBaseUrl(server.config.domain)}/sep24/transaction/more_info?id=${transfer.id}`,
        to: transfer.account,
        from: transfer.account,
      }));

      res.json({ transactions });
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 400);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.get('/interactive', async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : undefined;
      const transactionId =
        typeof req.query.transaction_id === 'string' ? req.query.transaction_id : undefined;

      if (!token) {
        throw badRequest('Missing token parameter');
      }

      if (!transactionId) {
        throw badRequest('Missing transaction_id parameter');
      }

      const redirectUrl = new URL(hooks.interactive.url);
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('transaction_id', transactionId);
      res.redirect(redirectUrl.toString());
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 500);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.get('/transaction/more_info', async (req, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : undefined;
      if (!id) {
        throw badRequest('Missing id parameter');
      }

      let transfer;
      try {
        transfer = await server.store.getById(id);
      } catch {
        throw notFound('Transaction not found');
      }

      if (!transfer) {
        throw notFound('Transaction not found');
      }

      if (hooks?.renderMoreInfo) {
        const html = hooks.renderMoreInfo(transfer);
        res.status(200).send(html);
        return;
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Transaction Info</title></head>
          <body>
            <h1>Transaction Details</h1>
            <p>ID: ${transfer.id}</p>
            <p>Status: ${transfer.status}</p>
            <p>Kind: ${transfer.kind}</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', error?.status ?? 500);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.post('/interactive/complete', async (req, res) => {
    try {
      const body = req.body as Record<string, string | undefined>;
      const { transaction_id, token } = body;

      if (!transaction_id || !token) {
        throw badRequest('Missing transaction_id or token');
      }

      const transfer = await server.transferManager.completeInteractive(transaction_id, token);

      res.json({
        success: true,
        status: transfer.status,
        message: 'Interactive flow completed successfully',
      });
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

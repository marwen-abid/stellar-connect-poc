import { Router, urlencoded, json } from 'express';
import type { AnchorServer } from '../../anchor-server.js';
import { SepError, badRequest } from '../../errors.js';

export function createSep10Router(server: AnchorServer): Router {
  const router = Router();

  // SEP-10 POST accepts both JSON and form-urlencoded
  router.use(json());
  router.use(urlencoded({ extended: false }));

  router.get('/', async (req, res) => {
    try {
      const accountParam = req.query.account;
      if (typeof accountParam !== 'string' || accountParam.length === 0) {
        throw badRequest('account query parameter is required');
      }

      const challenge = await server.authIssuer.createChallenge(accountParam);

      res.json({
        transaction: challenge.transaction,
        network_passphrase: challenge.network_passphrase,
      });
    } catch (error: any) {
      const status = error instanceof SepError ? error.status : 400;
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', status);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { transaction } = req.body ?? {};
      if (typeof transaction !== 'string' || transaction.length === 0) {
        throw badRequest('transaction body field is required');
      }

      const result = await server.authIssuer.verifyChallenge(transaction);
      res.json({ token: result.token });
    } catch (error: any) {
      const status = error instanceof SepError ? error.status : 400;
      const sepError =
        error instanceof SepError
          ? error
          : new SepError(error?.message ?? 'Internal server error', 'error', status);
      res.status(sepError.status).json(sepError.toJSON());
    }
  });

  return router;
}

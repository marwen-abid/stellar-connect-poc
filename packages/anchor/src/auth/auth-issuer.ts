import { Keypair, WebAuth, Networks, Horizon } from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';
import { NonceStore } from './nonce-store.js';

interface JwtPayload {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Handles SEP-10 authentication challenge creation and validation
 */
export class AuthIssuer {
  private signingKey: string;
  private publicKey: string;
  private domain: string;
  private networkPassphrase: string;
  private jwtSecret: string;
  private nonceStore: NonceStore;
  private horizonServer: Horizon.Server;
  private readonly tokenExpiration = 24 * 60 * 60; // 24 hours in seconds

  constructor(signingKey: string, domain: string, networkPassphrase: string, jwtSecret: string) {
    this.signingKey = signingKey;
    this.publicKey = Keypair.fromSecret(signingKey).publicKey();
    this.domain = domain;
    this.networkPassphrase = networkPassphrase;
    this.jwtSecret = jwtSecret;
    this.nonceStore = new NonceStore();

    // Initialize Horizon server based on network
    const horizonUrl =
      networkPassphrase === Networks.PUBLIC
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org';
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  /**
   * Create an authentication challenge for a Stellar account
   */
  async createChallenge(
    clientPublicKey: string
  ): Promise<{ transaction: string; network_passphrase: string }> {
    // Get server keypair for signing
    const serverKeypair = Keypair.fromSecret(this.signingKey);

    // Build challenge transaction with SEP-10 requirements
    const timeout = 300; // 300 seconds

    const transactionXdr = WebAuth.buildChallengeTx(
      serverKeypair,
      clientPublicKey,
      this.domain,
      timeout,
      this.networkPassphrase,
      this.domain // webAuthDomain
    );

    const readResult = WebAuth.readChallengeTx(
      transactionXdr,
      this.publicKey,
      this.networkPassphrase,
      this.domain,
      this.domain
    );

    const nonce = this.extractNonceFromTransaction(readResult.tx);
    if (!nonce) {
      throw new Error('Invalid challenge: nonce not found');
    }

    this.nonceStore.add(nonce);

    return {
      transaction: transactionXdr,
      network_passphrase: this.networkPassphrase,
    };
  }

  /**
   * Verify a signed challenge and return JWT token
   */
  async verifyChallenge(signedChallenge: string): Promise<{ token: string; account: string }> {
    // Parse the challenge transaction to extract client and nonce
    const result = WebAuth.readChallengeTx(
      signedChallenge,
      this.publicKey,
      this.networkPassphrase,
      this.domain,
      this.domain
    );

    // Extract client public key from transaction
    const clientPublicKey = result.clientAccountID;

    // Fetch client account from Horizon to get signers and thresholds
    let accountData: any = null;
    let accountSigners: string[] = [clientPublicKey];
    try {
      accountData = await this.horizonServer.accounts().accountId(clientPublicKey).call();
      // Get all signers for this account (including master key)
      accountSigners = accountData.signers.map((signer: any) => signer.key);
    } catch {
      // If account doesn't exist, only require client signature
      accountSigners = [clientPublicKey];
    }

    // Verify signatures on the challenge transaction with account signers
    // This throws if signatures are invalid or if signers didn't sign
    const signedByList = WebAuth.verifyChallengeTxSigners(
      signedChallenge,
      this.publicKey,
      this.networkPassphrase,
      accountSigners,
      this.domain,
      this.domain
    );

    // If account exists, validate signature weight against medium threshold
    if (accountData) {
      const mediumThreshold = accountData.thresholds.med_threshold;
      let signatureWeight = 0;

      // Calculate total weight of signatures
      for (const signer of accountData.signers) {
        if (signedByList.includes(signer.key)) {
          signatureWeight += signer.weight;
        }
      }

      // Check if signature weight meets medium threshold
      if (signatureWeight < mediumThreshold) {
        throw new Error(
          `Invalid challenge: signature weight ${signatureWeight} is less than required threshold ${mediumThreshold}`
        );
      }
    }

    // Extract nonce from transaction to check for replay
    const nonce = this.extractNonceFromTransaction(result.tx);
    if (!nonce) {
      throw new Error('Invalid challenge: nonce not found');
    }

    // Check if nonce was already used (replay protection)
    if (!this.nonceStore.has(nonce)) {
      throw new Error('Invalid or expired nonce');
    }

    // Generate JWT token
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      iss: this.domain,
      sub: clientPublicKey,
      iat: now,
      exp: now + this.tokenExpiration,
    };

    const token = jwt.sign(payload, this.jwtSecret);

    return {
      token,
      account: clientPublicKey,
    };
  }

  /**
   * Extract nonce from challenge transaction
   */
  private extractNonceFromTransaction(transaction: any): string | null {
    // The nonce is stored in the first ManageData operation
    if (transaction.operations && transaction.operations.length > 0) {
      const firstOp = transaction.operations[0];
      if (firstOp.type === 'manageData' && firstOp.value) {
        // Convert Buffer to base64 string for consistent Map lookup
        if (Buffer.isBuffer(firstOp.value)) {
          return firstOp.value.toString('base64');
        }
        return firstOp.value; // Already a string
      }
    }
    return null;
  }

  /**
   * Middleware to require valid JWT authentication
   */
  requireAuth() {
    return (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(403).json({ error: 'Missing authorization header' });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          return res.status(403).json({ error: 'Invalid authorization header format' });
        }

        const token = parts[1];

        // Verify and decode JWT
        const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;

        // Attach decoded claims to request
        req.user = decoded;

        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    };
  }

  destroy(): void {
    this.nonceStore.destroy();
  }
}

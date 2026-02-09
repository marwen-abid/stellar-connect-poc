import { describe, it, expect } from 'vitest';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
} from '@stellar/stellar-sdk';
import {
  encodeTransaction,
  decodeTransaction,
  parseOperations,
  getTransactionHash,
  extractSignatures,
  countSignatures,
  isTransactionSigned,
} from '../xdr-codec';

describe('XDR Codec', () => {
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), '1');

  describe('encodeTransaction', () => {
    it('should encode transaction to XDR', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const xdr = encodeTransaction(transaction);

      expect(typeof xdr).toBe('string');
      expect(xdr.length).toBeGreaterThan(0);
    });
  });

  describe('decodeTransaction', () => {
    it('should decode XDR to transaction', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const xdr = encodeTransaction(transaction);
      const decoded = decodeTransaction(xdr);

      expect(decoded).toBeDefined();
      expect(decoded.source).toBe(keypair.publicKey());
    });

    it('should throw on invalid XDR', () => {
      expect(() => decodeTransaction('invalid-xdr')).toThrow('Failed to decode');
    });

    it('should preserve transaction properties', () => {
      const destination = Keypair.random().publicKey();
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const xdr = encodeTransaction(transaction);
      const decoded = decodeTransaction(xdr);

      expect(decoded.operations.length).toBe(1);
      expect(decoded.operations[0].type).toBe('payment');
    });
  });

  describe('parseOperations', () => {
    it('should extract operations from transaction', () => {
      const destination = Keypair.random().publicKey();
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const operations = parseOperations(transaction);

      expect(operations.length).toBe(1);
      expect(operations[0].type).toBe('payment');
      expect(operations[0].destination).toBe(destination);
    });

    it('should handle multiple operations', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '200',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '20',
          }),
        )
        .setTimeout(30)
        .build();

      const operations = parseOperations(transaction);

      expect(operations.length).toBe(2);
      expect(operations[0].type).toBe('payment');
      expect(operations[1].type).toBe('payment');
    });

    it('should include source account if present', () => {
      const source = Keypair.random().publicKey();
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            source,
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const operations = parseOperations(transaction);

      expect(operations[0].sourceAccount).toBe(source);
    });
  });

  describe('getTransactionHash', () => {
    it('should return transaction hash', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const hash = getTransactionHash(transaction);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should return different hashes for different transactions', () => {
      const tx1 = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const tx2 = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '20',
          }),
        )
        .setTimeout(30)
        .build();

      expect(getTransactionHash(tx1)).not.toBe(getTransactionHash(tx2));
    });
  });

  describe('signature operations', () => {
    it('should detect unsigned transaction', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const xdr = encodeTransaction(transaction);

      expect(isTransactionSigned(xdr)).toBe(false);
      expect(countSignatures(xdr)).toBe(0);
      expect(extractSignatures(xdr)).toEqual([]);
    });

    it('should detect signed transaction', () => {
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      const xdr = encodeTransaction(transaction);

      expect(isTransactionSigned(xdr)).toBe(true);
      expect(countSignatures(xdr)).toBe(1);
      expect(extractSignatures(xdr).length).toBe(1);
    });

    it('should handle multiple signatures', () => {
      const keypair2 = Keypair.random();
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      transaction.sign(keypair2);
      const xdr = encodeTransaction(transaction);

      expect(countSignatures(xdr)).toBe(2);
      expect(extractSignatures(xdr).length).toBe(2);
    });
  });
});

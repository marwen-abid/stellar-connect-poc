import { xdr, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

export function encodeTransaction(transaction: Transaction): string {
  return transaction.toEnvelope().toXDR('base64');
}

export function decodeTransaction(xdrString: string): Transaction {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(xdrString, 'base64');
    return new Transaction(envelope, '');
  } catch (error) {
    throw new Error(`Failed to decode transaction XDR: ${(error as Error).message}`);
  }
}

export function parseOperations(transaction: Transaction): Array<{
  type: string;
  sourceAccount?: string;
  [key: string]: unknown;
}> {
  return transaction.operations.map((op) => {
    const operation: { type: string; sourceAccount?: string; [key: string]: unknown } = {
      type: op.type,
    };

    if (op.source) {
      operation.sourceAccount = op.source;
    }

    Object.entries(op).forEach(([key, value]) => {
      if (key !== 'type' && key !== 'source') {
        operation[key] = value;
      }
    });

    return operation;
  });
}

export function getTransactionHash(transaction: Transaction): string {
  return transaction.hash().toString('hex');
}

export function extractSignatures(xdrString: string): string[] {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(xdrString, 'base64');
    
    if (envelope.switch() === xdr.EnvelopeType.envelopeTypeTx()) {
      const v1 = envelope.v1();
      return v1.signatures().map((sig) => sig.signature().toString('base64'));
    }
    
    if (envelope.switch() === xdr.EnvelopeType.envelopeTypeTxV0()) {
      const v0 = envelope.v0();
      return v0.signatures().map((sig) => sig.signature().toString('base64'));
    }
    
    if (envelope.switch() === xdr.EnvelopeType.envelopeTypeTxFeeBump()) {
      const feeBump = envelope.feeBump();
      return feeBump.signatures().map((sig) => sig.signature().toString('base64'));
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to extract signatures: ${(error as Error).message}`);
  }
}

export function countSignatures(xdrString: string): number {
  return extractSignatures(xdrString).length;
}

export function isTransactionSigned(xdrString: string): boolean {
  return countSignatures(xdrString) > 0;
}

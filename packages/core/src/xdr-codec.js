import { xdr, Transaction } from '@stellar/stellar-sdk';
export function encodeTransaction(transaction) {
    return transaction.toEnvelope().toXDR('base64');
}
export function decodeTransaction(xdrString) {
    try {
        const envelope = xdr.TransactionEnvelope.fromXDR(xdrString, 'base64');
        return new Transaction(envelope, '');
    }
    catch (error) {
        throw new Error(`Failed to decode transaction XDR: ${error.message}`);
    }
}
export function parseOperations(transaction) {
    return transaction.operations.map((op) => {
        const operation = {
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
export function getTransactionHash(transaction) {
    return transaction.hash().toString('hex');
}
export function extractSignatures(xdrString) {
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
    }
    catch (error) {
        throw new Error(`Failed to extract signatures: ${error.message}`);
    }
}
export function countSignatures(xdrString) {
    return extractSignatures(xdrString).length;
}
export function isTransactionSigned(xdrString) {
    return countSignatures(xdrString) > 0;
}
//# sourceMappingURL=xdr-codec.js.map
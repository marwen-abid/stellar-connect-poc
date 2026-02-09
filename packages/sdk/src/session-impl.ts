import type { Signer, NetworkClient } from '@stellarconnect/core';
import type { Session } from './session.js';
import type { AnchorCapabilities, AssetInfo, TransferOptions } from './types.js';
import { TransferProcess, type TransferProcessConfig } from './transfer-process.js';

export class SessionImpl implements Session {
  readonly anchor: AnchorCapabilities;
  readonly signer: Signer;
  readonly jwt: string;
  readonly expiresAt: Date;
  private networkClient?: NetworkClient;

  constructor(
    anchor: AnchorCapabilities,
    signer: Signer,
    jwt: string,
    expiresAt: Date,
    networkClient?: NetworkClient,
  ) {
    this.anchor = anchor;
    this.signer = signer;
    this.jwt = jwt;
    this.expiresAt = expiresAt;
    this.networkClient = networkClient;
  }

  deposit(asset: string | AssetInfo, options?: TransferOptions): TransferProcess {
    const config: TransferProcessConfig = {
      anchor: this.anchor,
      jwt: this.jwt,
      asset,
      type: 'deposit',
      options,
      networkClient: this.networkClient,
    };

    const process = new TransferProcess(config);
    process.start().catch((err) => {
      console.error('Failed to start deposit process:', err);
    });

    return process;
  }

  withdraw(asset: string | AssetInfo, options?: TransferOptions): TransferProcess {
    const config: TransferProcessConfig = {
      anchor: this.anchor,
      jwt: this.jwt,
      asset,
      type: 'withdraw',
      options,
      networkClient: this.networkClient,
    };

    const process = new TransferProcess(config);
    process.start().catch((err) => {
      console.error('Failed to start withdraw process:', err);
    });

    return process;
  }
}

import type { Signer } from '@stellarconnect/core';
import type {
  AnchorCapabilities,
  AssetInfo,
  TransferOptions,
  TransferProcess,
} from './types.js';

export interface Session {
  anchor: AnchorCapabilities;
  signer: Signer;
  jwt: string;
  expiresAt: Date;

  deposit(asset: string | AssetInfo, options?: TransferOptions): TransferProcess;
  withdraw(asset: string | AssetInfo, options?: TransferOptions): TransferProcess;
}

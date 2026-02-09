import { NetworkClient } from '@stellarconnect/core';
import type { AnchorCapabilities, AssetInfo, TransferOptions } from './types.js';

export type TransferType = 'deposit' | 'withdraw';

export type TransferStatus =
  | 'initiating'
  | 'interactive'
  | 'pending_user_transfer_start'
  | 'pending_anchor'
  | 'pending_stellar'
  | 'pending_external'
  | 'completed'
  | 'failed'
  | 'error';

export interface TransferStatusUpdate {
  status: TransferStatus;
  message?: string;
  externalTransactionId?: string;
  stellarTransactionId?: string;
  moreInfoUrl?: string;
}

export type TransferStatusCallback = (update: TransferStatusUpdate) => void;

export interface TransferProcessConfig {
  anchor: AnchorCapabilities;
  jwt: string;
  asset: string | AssetInfo;
  type: TransferType;
  options?: TransferOptions;
  networkClient?: NetworkClient;
}

export class TransferProcess {
  private anchor: AnchorCapabilities;
  private jwt: string;
  private asset: string | AssetInfo;
  private type: TransferType;
  private options?: TransferOptions;
  private networkClient: NetworkClient;

  private _id: string | null = null;
  private _status: TransferStatus = 'initiating';
  private _statusMessage?: string;
  private _interactiveUrl?: string;
  private _externalTransactionId?: string;
  private _stellarTransactionId?: string;
  private _moreInfoUrl?: string;

  private statusCallbacks: TransferStatusCallback[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingDelay = 2000;
  private maxPollingDelay = 30000;

  constructor(config: TransferProcessConfig) {
    this.anchor = config.anchor;
    this.jwt = config.jwt;
    this.asset = config.asset;
    this.type = config.type;
    this.options = config.options;
    this.networkClient = config.networkClient ?? new NetworkClient();
  }

  get id(): string | null {
    return this._id;
  }

  get status(): TransferStatus {
    return this._status;
  }

  get statusMessage(): string | undefined {
    return this._statusMessage;
  }

  get interactiveUrl(): string | undefined {
    return this._interactiveUrl;
  }

  get externalTransactionId(): string | undefined {
    return this._externalTransactionId;
  }

  get stellarTransactionId(): string | undefined {
    return this._stellarTransactionId;
  }

  get moreInfoUrl(): string | undefined {
    return this._moreInfoUrl;
  }

  async start(): Promise<void> {
    const isSep24 = !!this.anchor.sep24;
    const isSep6 = !!this.anchor.sep6;

    if (!isSep24 && !isSep6) {
      throw new Error('Anchor does not support SEP-6 or SEP-24 transfers');
    }

    if (isSep24) {
      await this.startSep24Transfer();
    } else {
      await this.startSep6Transfer();
    }
  }

  private async startSep24Transfer(): Promise<void> {
    const endpoint = this.anchor.sep24!.endpoint;
    const assetCode = typeof this.asset === 'string' ? this.asset : this.asset.code;

    const params = new URLSearchParams({
      asset_code: assetCode,
      account: this.options?.account ?? '',
    });

    if (this.options?.amount) {
      params.set('amount', this.options.amount);
    }

    const url = `${endpoint}/transactions/${this.type}/interactive?${params}`;

    const response = await this.networkClient.get(url, {
      headers: {
        Authorization: `Bearer ${this.jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error(`SEP-24 ${this.type} initiation failed: ${response.statusText}`);
    }

    const data = await response.json();

    this._id = data.id;
    this._interactiveUrl = data.url;
    this._status = 'interactive';

    this.emitStatusUpdate({
      status: this._status,
      message: 'Waiting for user to complete interactive flow',
    });

    this.startPolling();
  }

  private async startSep6Transfer(): Promise<void> {
    const endpoint = this.anchor.sep6!.endpoint;
    const assetCode = typeof this.asset === 'string' ? this.asset : this.asset.code;

    const body: Record<string, string> = {
      asset_code: assetCode,
      account: this.options?.account ?? '',
    };

    if (this.options?.amount) {
      body.amount = this.options.amount;
    }

    if (this.options?.memo) {
      body.memo = this.options.memo;
      body.memo_type = this.options.memoType ?? 'text';
    }

    const url = `${endpoint}/${this.type}`;

    const response = await this.networkClient.post(url, JSON.stringify(body), {
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SEP-6 ${this.type} initiation failed: ${response.statusText}`);
    }

    const data = await response.json();

    this._id = data.id;
    this._status = 'pending_external';

    if (data.how) {
      this._statusMessage = data.how;
    }

    this.emitStatusUpdate({
      status: this._status,
      message: this._statusMessage,
    });

    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(() => {
      this.pollStatus().catch((err) => {
        this.stopPolling();
        this._status = 'error';
        this.emitStatusUpdate({
          status: 'error',
          message: err.message,
        });
      });
    }, this.pollingDelay);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollStatus(): Promise<void> {
    if (!this._id) {
      return;
    }

    const isSep24 = !!this.anchor.sep24;
    const endpoint = isSep24 ? this.anchor.sep24!.endpoint : this.anchor.sep6!.endpoint;

    const url = `${endpoint}/transaction?id=${this._id}`;

    const response = await this.networkClient.get(url, {
      headers: {
        Authorization: `Bearer ${this.jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to poll transaction status: ${response.statusText}`);
    }

    const data = await response.json();
    const transaction = data.transaction ?? data;

    const newStatus = this.normalizeStatus(transaction.status);
    const statusChanged = newStatus !== this._status;

    this._status = newStatus;
    this._statusMessage = transaction.message;
    this._externalTransactionId = transaction.external_transaction_id;
    this._stellarTransactionId = transaction.stellar_transaction_id;
    this._moreInfoUrl = transaction.more_info_url;

    if (statusChanged) {
      this.emitStatusUpdate({
        status: this._status,
        message: this._statusMessage,
        externalTransactionId: this._externalTransactionId,
        stellarTransactionId: this._stellarTransactionId,
        moreInfoUrl: this._moreInfoUrl,
      });
    }

    if (this._status === 'completed' || this._status === 'failed') {
      this.stopPolling();
    } else {
      this.increasePollingDelay();
    }
  }

  private normalizeStatus(anchorStatus: string): TransferStatus {
    const statusMap: Record<string, TransferStatus> = {
      incomplete: 'interactive',
      pending_user_transfer_start: 'pending_user_transfer_start',
      pending_anchor: 'pending_anchor',
      pending_stellar: 'pending_stellar',
      pending_external: 'pending_external',
      pending_trust: 'pending_anchor',
      pending_user: 'pending_external',
      completed: 'completed',
      refunded: 'completed',
      expired: 'failed',
      error: 'error',
      no_market: 'failed',
      too_small: 'failed',
      too_large: 'failed',
    };

    return statusMap[anchorStatus] ?? 'pending_anchor';
  }

  private increasePollingDelay(): void {
    this.pollingDelay = Math.min(this.pollingDelay * 1.5, this.maxPollingDelay);
  }

  onStatus(callback: TransferStatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  private emitStatusUpdate(update: TransferStatusUpdate): void {
    for (const callback of this.statusCallbacks) {
      callback(update);
    }
  }

  async waitForCompletion(): Promise<TransferStatusUpdate> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (this._status === 'completed') {
          resolve({
            status: this._status,
            message: this._statusMessage,
            externalTransactionId: this._externalTransactionId,
            stellarTransactionId: this._stellarTransactionId,
            moreInfoUrl: this._moreInfoUrl,
          });
        } else if (this._status === 'failed' || this._status === 'error') {
          reject(new Error(this._statusMessage ?? `Transfer ${this._status}`));
        }
      };

      checkStatus();

      this.onStatus(() => {
        checkStatus();
      });
    });
  }

  dispose(): void {
    this.stopPolling();
    this.statusCallbacks = [];
  }
}

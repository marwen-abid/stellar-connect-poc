/**
 * In-memory nonce store with TTL cleanup for SEP-10 authentication
 * Implements replay protection by tracking used nonces with automatic expiration
 */
export class NonceStore {
  private store: Map<string, number> = new Map();
  private readonly ttl: number = 300_000; // 5 minutes in milliseconds
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, this.ttl);
    this.cleanupTimer.unref();
  }

  /**
   * Add a nonce to the store
   */
  add(nonce: string): boolean {
    if (this.store.has(nonce)) {
      return false;
    }
    this.store.set(nonce, Date.now());
    return true;
  }

  /**
   * Check if a nonce exists in the store
   */
  has(nonce: string): boolean {
    return this.store.has(nonce);
  }

  /**
   * Clear all nonces from the store
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clear expired nonces based on TTL
   */
  private clearExpired(): void {
    const now = Date.now();
    for (const [nonce, timestamp] of this.store.entries()) {
      if (now - timestamp > this.ttl) {
        this.store.delete(nonce);
      }
    }
  }

  /**
   * Cleanup resources (stop cleanup interval)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

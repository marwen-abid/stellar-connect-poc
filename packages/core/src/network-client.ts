export interface NetworkClientConfig {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerWindow?: number;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  constructor(
    private threshold: number,
    private windowMs: number,
  ) {}

  recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }

  recordFailure(): void {
    const now = Date.now();
    if (now - this.lastFailureTime > this.windowMs) {
      this.failures = 1;
    } else {
      this.failures++;
    }
    this.lastFailureTime = now;

    if (this.failures >= this.threshold) {
      this.isOpen = true;
    }
  }

  shouldAllow(): boolean {
    if (!this.isOpen) return true;

    const now = Date.now();
    if (now - this.lastFailureTime > this.windowMs) {
      this.isOpen = false;
      this.failures = 0;
      return true;
    }

    return false;
  }
}

export class NetworkClient {
  private config: Required<NetworkClientConfig>;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(config: NetworkClientConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 10000,
      maxRetries: config.maxRetries ?? 2,
      retryDelay: config.retryDelay ?? 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerWindow: config.circuitBreakerWindow ?? 60000,
    };
  }

  async request(url: string, options: RequestOptions = {}): Promise<Response> {
    const breaker = this.getCircuitBreaker(url);

    if (!breaker.shouldAllow()) {
      throw new Error(`Circuit breaker open for ${new URL(url).hostname}`);
    }

    const timeout = options.timeout ?? this.config.timeout;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.delay(this.config.retryDelay * Math.pow(2, attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: options.method ?? 'GET',
          headers: options.headers,
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok && response.status >= 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        breaker.recordSuccess();
        return response;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeout}ms`);
        }

        if (attempt === this.config.maxRetries) {
          breaker.recordFailure();
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  async get(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(
    url: string,
    body: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<Response> {
    return this.request(url, { ...options, method: 'POST', body });
  }

  private getCircuitBreaker(url: string): CircuitBreaker {
    const hostname = new URL(url).hostname;
    if (!this.circuitBreakers.has(hostname)) {
      this.circuitBreakers.set(
        hostname,
        new CircuitBreaker(this.config.circuitBreakerThreshold, this.config.circuitBreakerWindow),
      );
    }
    return this.circuitBreakers.get(hostname)!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

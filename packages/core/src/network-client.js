class CircuitBreaker {
    constructor(threshold, windowMs) {
        Object.defineProperty(this, "threshold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: threshold
        });
        Object.defineProperty(this, "windowMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: windowMs
        });
        Object.defineProperty(this, "failures", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastFailureTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isOpen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    recordSuccess() {
        this.failures = 0;
        this.isOpen = false;
    }
    recordFailure() {
        const now = Date.now();
        if (now - this.lastFailureTime > this.windowMs) {
            this.failures = 1;
        }
        else {
            this.failures++;
        }
        this.lastFailureTime = now;
        if (this.failures >= this.threshold) {
            this.isOpen = true;
        }
    }
    shouldAllow() {
        if (!this.isOpen)
            return true;
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
    constructor(config = {}) {
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "circuitBreakers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.config = {
            timeout: config.timeout ?? 10000,
            maxRetries: config.maxRetries ?? 2,
            retryDelay: config.retryDelay ?? 1000,
            circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
            circuitBreakerWindow: config.circuitBreakerWindow ?? 60000,
        };
    }
    async request(url, options = {}) {
        const breaker = this.getCircuitBreaker(url);
        if (!breaker.shouldAllow()) {
            throw new Error(`Circuit breaker open for ${new URL(url).hostname}`);
        }
        const timeout = options.timeout ?? this.config.timeout;
        let lastError = null;
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
            }
            catch (error) {
                lastError = error;
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
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }
    async post(url, body, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }
    getCircuitBreaker(url) {
        const hostname = new URL(url).hostname;
        if (!this.circuitBreakers.has(hostname)) {
            this.circuitBreakers.set(hostname, new CircuitBreaker(this.config.circuitBreakerThreshold, this.config.circuitBreakerWindow));
        }
        return this.circuitBreakers.get(hostname);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=network-client.js.map
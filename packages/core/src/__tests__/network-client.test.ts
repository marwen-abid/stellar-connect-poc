import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkClient } from '../network-client';

describe('NetworkClient', () => {
  let client: NetworkClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new NetworkClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('request', () => {
    it('should make successful GET request', async () => {
      const mockResponse = new Response('{"data":"test"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const response = await client.get('https://example.com/api');

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(response.status).toBe(200);
    });

    it('should retry on 5xx errors', async () => {
      const mockError = new Response('Server Error', { status: 500 });
      const mockSuccess = new Response('{"data":"test"}', { status: 200 });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(mockError)
        .mockResolvedValueOnce(mockError)
        .mockResolvedValue(mockSuccess);

      const promise = client.get('https://example.com/api');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const response = await promise;
      expect(response.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const mockError = new Response('Server Error', { status: 500 });
      global.fetch = vi.fn().mockResolvedValue(mockError);

      const promise = client.get('https://example.com/api').catch((err) => err);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it.skip('should timeout on slow requests', async () => {
      let aborted = false;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          const abortHandler = () => {
            aborted = true;
            reject(new DOMException('AbortError', 'AbortError'));
          };
          
          if (options?.signal) {
            options.signal.addEventListener('abort', abortHandler);
          }
        });
      });

      const client = new NetworkClient({ timeout: 100, maxRetries: 0 });
      
      await expect(client.get('https://example.com/api')).rejects.toThrow('timeout');
      expect(aborted).toBe(true);
    });

    it.skip('should use custom timeout from options', async () => {
      let aborted = false;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          const abortHandler = () => {
            aborted = true;
            reject(new DOMException('AbortError', 'AbortError'));
          };
          
          if (options?.signal) {
            options.signal.addEventListener('abort', abortHandler);
          }
        });
      });

      const client = new NetworkClient({ maxRetries: 0 });
      
      await expect(client.get('https://example.com/api', { timeout: 50 })).rejects.toThrow('timeout');
      expect(aborted).toBe(true);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const mockError = new Response('Server Error', { status: 500 });
      global.fetch = vi.fn().mockResolvedValue(mockError);

      const client = new NetworkClient({
        circuitBreakerThreshold: 2,
        maxRetries: 0,
      });

      await expect(client.get('https://example.com/api')).rejects.toThrow();
      await expect(client.get('https://example.com/api')).rejects.toThrow();

      await expect(client.get('https://example.com/api')).rejects.toThrow('Circuit breaker open');
    });

    it('should reset circuit after window expires', async () => {
      const mockError = new Response('Server Error', { status: 500 });
      const mockSuccess = new Response('OK', { status: 200 });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(mockError)
        .mockResolvedValueOnce(mockError)
        .mockResolvedValue(mockSuccess);

      const client = new NetworkClient({
        circuitBreakerThreshold: 2,
        circuitBreakerWindow: 10000,
        maxRetries: 0,
      });

      await expect(client.get('https://example.com/api')).rejects.toThrow();
      await expect(client.get('https://example.com/api')).rejects.toThrow();

      await vi.advanceTimersByTimeAsync(15000);

      const response = await client.get('https://example.com/api');
      expect(response.status).toBe(200);
    });
  });

  describe('POST requests', () => {
    it('should send POST request with body', async () => {
      const mockResponse = new Response('{"success":true}', { status: 201 });
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const body = JSON.stringify({ test: 'data' });
      const response = await client.post('https://example.com/api', body, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(response.status).toBe(201);
    });
  });

  describe('exponential backoff', () => {
    it('should use exponential backoff for retries', async () => {
      const mockError = new Response('Server Error', { status: 500 });
      global.fetch = vi.fn().mockResolvedValue(mockError);

      const client = new NetworkClient({ retryDelay: 1000, maxRetries: 2 });
      const promise = client.get('https://example.com/api').catch((err) => err);

      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2000);
      expect(fetch).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
    });
  });
});

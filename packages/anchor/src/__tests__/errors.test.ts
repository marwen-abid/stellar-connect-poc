import { describe, it, expect } from 'vitest';
import { SepError, badRequest, unauthorized, forbidden, notFound, conflict } from '../errors.js';

describe('SepError', () => {
  describe('constructor', () => {
    it('creates error with message, code, and status', () => {
      const error = new SepError('Invalid input', 'invalid_input', 400);

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('invalid_input');
      expect(error.status).toBe(400);
      expect(error.name).toBe('SepError');
    });

    it('creates error with details', () => {
      const error = new SepError('Test error', 'test_code', 500, { foo: 'bar', count: 42 });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('test_code');
      expect(error.status).toBe(500);
      expect(error.details).toEqual({ foo: 'bar', count: 42 });
    });

    it('uses default code "error" when not provided', () => {
      const error = new SepError('Default error');

      expect(error.code).toBe('error');
      expect(error.status).toBe(400);
    });

    it('uses default status 400 when not provided', () => {
      const error = new SepError('Default error', 'custom_code');

      expect(error.code).toBe('custom_code');
      expect(error.status).toBe(400);
    });
  });

  describe('toJSON', () => {
    it('returns correct format with error and code', () => {
      const error = new SepError('Test error', 'test_code', 500);
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Test error',
        code: 'test_code',
      });
    });

    it('includes details in JSON output', () => {
      const error = new SepError('Test error', 'test_code', 500, { foo: 'bar', baz: 123 });
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Test error',
        code: 'test_code',
        foo: 'bar',
        baz: 123,
      });
    });

    it('spreads details after error and code', () => {
      const error = new SepError('Test', 'code', 400, { field: 'value' });
      const json = error.toJSON();
      const keys = Object.keys(json);

      expect(keys[0]).toBe('error');
      expect(keys[1]).toBe('code');
      expect(keys[2]).toBe('field');
    });
  });
});

describe('badRequest', () => {
  it('creates 400 error with message and code', () => {
    const error = badRequest('Missing field', 'missing_field');

    expect(error.status).toBe(400);
    expect(error.message).toBe('Missing field');
    expect(error.code).toBe('missing_field');
  });

  it('uses default code "bad_request" when not provided', () => {
    const error = badRequest('Invalid data');

    expect(error.status).toBe(400);
    expect(error.message).toBe('Invalid data');
    expect(error.code).toBe('bad_request');
  });

  it('includes details when provided', () => {
    const error = badRequest('Validation failed', 'validation_error', { field: 'email' });

    expect(error.status).toBe(400);
    expect(error.details).toEqual({ field: 'email' });
  });
});

describe('unauthorized', () => {
  it('creates 401 error with default message', () => {
    const error = unauthorized();

    expect(error.status).toBe(401);
    expect(error.message).toBe('Unauthorized');
    expect(error.code).toBe('unauthorized');
  });

  it('creates 401 error with custom message', () => {
    const error = unauthorized('Invalid token');

    expect(error.status).toBe(401);
    expect(error.message).toBe('Invalid token');
    expect(error.code).toBe('unauthorized');
  });

  it('includes details when provided', () => {
    const error = unauthorized('Token expired', { expires_at: '2024-01-01' });

    expect(error.status).toBe(401);
    expect(error.details).toEqual({ expires_at: '2024-01-01' });
  });
});

describe('forbidden', () => {
  it('creates 403 error with default message', () => {
    const error = forbidden();

    expect(error.status).toBe(403);
    expect(error.message).toBe('Forbidden');
    expect(error.code).toBe('forbidden');
  });

  it('creates 403 error with custom message', () => {
    const error = forbidden('Access denied');

    expect(error.status).toBe(403);
    expect(error.message).toBe('Access denied');
    expect(error.code).toBe('forbidden');
  });
});

describe('notFound', () => {
  it('creates 404 error with default message', () => {
    const error = notFound();

    expect(error.status).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.code).toBe('not_found');
  });

  it('creates 404 error with custom message', () => {
    const error = notFound('Transaction not found');

    expect(error.status).toBe(404);
    expect(error.message).toBe('Transaction not found');
    expect(error.code).toBe('not_found');
  });
});

describe('conflict', () => {
  it('creates 409 error with default message', () => {
    const error = conflict();

    expect(error.status).toBe(409);
    expect(error.message).toBe('Conflict');
    expect(error.code).toBe('conflict');
  });

  it('creates 409 error with custom message', () => {
    const error = conflict('Resource already exists');

    expect(error.status).toBe(409);
    expect(error.message).toBe('Resource already exists');
    expect(error.code).toBe('conflict');
  });
});

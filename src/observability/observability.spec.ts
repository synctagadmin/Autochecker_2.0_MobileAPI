/**
 * The SDK is mocked, not loaded.
 *
 * @sentry/node v8 imports `node:util` and friends, and this project is on Jest 26,
 * whose resolver does not understand the `node:` prefix - the suite fails before a
 * single assertion runs. Nothing under test here sends anything, so the module
 * boundary is the honest place to cut: instrument.ts and report.ts still load and
 * still run their own logic, which is what these tests are about.
 */
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  withScope: jest.fn((fn: (scope: unknown) => void) => fn({
    setLevel: jest.fn(), setTag: jest.fn(),
  })),
  captureException: jest.fn(),
}));
import { BaseExceptionFilter } from '@nestjs/core';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { isReportable, isClientFault, isTransient, statusOf, messageOf } from './reportable';
import { allowEvent, fingerprintOf, resetRateLimit, MAX_PER_WINDOW, WINDOW_MS } from './rate-limit';
import { tracesSampleRateFrom, sentryEnabled } from '../instrument';
import { SentryExceptionFilter } from './sentry-exception.filter';

/**
 * What is worth an alert, how often, and that adding reporting changed no response.
 *
 * The quota is shared with AdminAPI, eBayAPI, the scraper and the admin UI, so anything
 * reported here is reported instead of something else.
 */
describe('isReportable', () => {
  /** This service answers a mobile app: 4xx is its ordinary working day. */
  it('ignores the caller\'s own mistakes', () => {
    expect(isReportable(new BadRequestException('missing field'))).toBe(false);
    expect(isReportable(new NotFoundException('no such part'))).toBe(false);
  });

  /** A 500 is this service admitting it broke. */
  it('reports a server fault', () => {
    expect(isReportable(new InternalServerErrorException('boom'))).toBe(true);
  });

  it('reports an ordinary thrown Error, which carries no status', () => {
    expect(isReportable(new Error('cannot read property of undefined'))).toBe(true);
  });

  /** A phone on a bad connection and a momentary Atlas blip are weather, not defects. */
  it('ignores network weather', () => {
    expect(isReportable(new Error('ETIMEDOUT'))).toBe(false);
    expect(isReportable(new Error('socket hang up'))).toBe(false);
  });

  it('ignores eBay having a moment', () => {
    expect(isReportable(new Error('errorId: 62000'))).toBe(false);
    expect(isReportable(new Error('<!DOCTYPE html><html>'))).toBe(false);
  });

  it('ignores nothing at all', () => {
    expect(isReportable(null)).toBe(false);
    expect(isReportable(undefined)).toBe(false);
  });

  /** Read defensively: this runs in an error path and must not throw itself. */
  it('survives an exception whose getStatus throws', () => {
    const broken = { getStatus() { throw new Error('nope'); } };
    expect(() => isReportable(broken)).not.toThrow();
    expect(isReportable(broken)).toBe(true);
  });

  it('reads a status from status or statusCode', () => {
    expect(statusOf({ status: 404 })).toBe(404);
    expect(statusOf({ statusCode: 503 })).toBe(503);
    expect(statusOf('a string')).toBe(0);
  });

  it('describes a throw however it was made', () => {
    expect(messageOf('plain string')).toBe('plain string');
    expect(messageOf(new Error('boom'))).toContain('boom');
    expect(messageOf(null)).toBe('');
  });

  it('treats only 4xx as the caller\'s fault', () => {
    expect(isClientFault({ status: 499 })).toBe(true);
    expect(isClientFault({ status: 500 })).toBe(false);
    expect(isTransient(new Error('ECONNRESET'))).toBe(true);
  });
});

describe('the rate limit', () => {
  beforeEach(() => resetRateLimit());

  /**
   * One error inside a loop is the failure mode this exists for: a fault in one of this
   * service's 17 detached forEach(async) calls happens once per row, not once.
   */
  it('allows the cap and then stops', () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_PER_WINDOW; i++) expect(allowEvent('same', now)).toBe(true);
    expect(allowEvent('same', now)).toBe(false);
  });

  it('starts again in the next window', () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_PER_WINDOW; i++) allowEvent('same', now);
    expect(allowEvent('same', now + WINDOW_MS)).toBe(true);
  });

  it('counts each fault separately', () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_PER_WINDOW; i++) allowEvent('a', now);
    expect(allowEvent('a', now)).toBe(false);
    expect(allowEvent('b', now)).toBe(true);
  });

  /**
   * The digits are what differ between one row and the next. Keying on the raw message
   * would give every part its own allowance and defeat the cap entirely.
   */
  it('treats the same fault on different rows as one', () => {
    expect(fingerprintOf('Error', 'part 44020 failed'))
      .toBe(fingerprintOf('Error', 'part 19200 failed'));
  });

  it('keeps genuinely different faults apart', () => {
    expect(fingerprintOf('Error', 'write failed'))
      .not.toBe(fingerprintOf('TypeError', 'write failed'));
  });
});

describe('the Sentry bootstrap', () => {
  /** No DSN, no Sentry: a developer's machine sends nothing unless asked. */
  it('is off in the test run, which sets no DSN', () => {
    expect(sentryEnabled).toBe(false);
  });

  /**
   * A typo in a deployment's .env must not stop the service starting. Not hypothetical:
   * this service failed to boot on 28 Oct 2026 because a missing variable threw.
   */
  it('reads an unusable sample rate as none', () => {
    expect(tracesSampleRateFrom(undefined)).toBe(0);
    expect(tracesSampleRateFrom('')).toBe(0);
    expect(tracesSampleRateFrom('abc')).toBe(0);
    expect(tracesSampleRateFrom('-1')).toBe(0);
  });

  it('caps a rate above one', () => {
    expect(tracesSampleRateFrom('5')).toBe(1);
    expect(tracesSampleRateFrom('0.05')).toBeCloseTo(0.05);
  });
});

describe('the exception filter', () => {
  /**
   * The point of the filter is that it changes NOTHING about the response. This service
   * has no global filter today, so Nest's built-in handler shapes every error the mobile
   * app sees; the filter delegates to that same handler rather than writing its own.
   */
  it('delegates to Nest\'s own handler', () => {
    const base = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    const filter = new SentryExceptionFilter({} as never);
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: '/api/product/list?id=1' }) }),
    };

    filter.catch(new Error('boom'), host as never);

    expect(base).toHaveBeenCalledTimes(1);
    base.mockRestore();
  });

  /** Reporting must never be the reason a request fails to get its response. */
  it('still responds when describing the request throws', () => {
    const base = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    const filter = new SentryExceptionFilter({} as never);
    const host = {
      getType: () => 'http',
      switchToHttp: () => { throw new Error('no context'); },
    };

    expect(() => filter.catch(new Error('boom'), host as never)).not.toThrow();
    expect(base).toHaveBeenCalledTimes(1);
    base.mockRestore();
  });

  it('handles a non-http context without a request', () => {
    const base = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    const filter = new SentryExceptionFilter({} as never);

    filter.catch(new Error('boom'), { getType: () => 'rpc' } as never);

    expect(base).toHaveBeenCalledTimes(1);
    base.mockRestore();
  });
});

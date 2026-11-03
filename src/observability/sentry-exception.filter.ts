import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { reportRequestFault } from './report';

/**
 * Report a fault on its way to becoming a response, and change nothing else.
 *
 * AdminAPI gets this from `@sentry/nestjs`, which supplies a global filter of its own.
 * That package requires `@nestjs/common` 8 or later and this service is on 7.6, so the
 * filter is written out here instead - it is the only part of that integration this
 * service actually needs.
 *
 * It extends BaseExceptionFilter and calls `super.catch` DELIBERATELY. This service has
 * no global filter today (main.ts has one commented out), so Nest's built-in handler is
 * what currently shapes every error response the mobile app sees. BaseExceptionFilter IS
 * that handler: delegating to it means adding reporting cannot change a status code, a
 * body, or the shape of a validation error. Writing the response here instead would have
 * been a silent API change dressed up as monitoring.
 *
 * What reaches Sentry is decided by isReportable, not here: a 404 for a part that does
 * not exist still passes through this filter, and is still not an alert.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      // Only an HTTP context carries a request to describe. Anything else is reported
      // without one rather than skipped - this service is HTTP-only today, and a future
      // context that is not must not silently stop being watched.
      if (host.getType() === 'http') {
        const request = host.switchToHttp().getRequest();
        reportRequestFault(
          exception,
          request?.method,
          // originalUrl keeps the global 'api' prefix, which is what makes a route tag
          // match what is actually deployed.
          request?.originalUrl ?? request?.url,
        );
      } else {
        reportRequestFault(exception);
      }
    } catch {
      // Reporting must never be the reason a request fails to get its response. If the
      // report throws, the response below still happens.
    }
    super.catch(exception, host);
  }
}

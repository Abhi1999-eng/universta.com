import { HttpException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AppExceptionFilter } from './app-exception.filter';
import { RequestContextService } from './request-context.service';
import { StructuredLogger } from './structured-logger.service';

/** ISS-036. Every 404's message was being overwritten with the generic
 * "Route not found", even for a NotFoundException a service throws
 * deliberately with its own specific message (e.g. bulk-archive's "None of
 * the selected records could be archived", or "Country not found") -- there
 * are ~30 such throws across the API, all following the same
 * `{code, message, details}` shape from catalog.errors.ts. Only a genuinely
 * unmatched Express route (which carries no application `code`) should get
 * the generic fallback. */
describe('AppExceptionFilter', () => {
  function run(exception: unknown) {
    const json = jest.fn();
    const setHeader = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status, setHeader };
    const request = { requestId: 'req-1', originalUrl: '/x', method: 'GET' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    const filter = new AppExceptionFilter(
      new RequestContextService(),
      new StructuredLogger(),
    );
    filter.catch(exception, host);
    return { status, json };
  }

  it("preserves a domain NotFoundException's own message and code", () => {
    const exception = new NotFoundException({
      code: 'NO_RECORDS_ARCHIVABLE',
      message: 'None of the selected records could be archived',
      details: null,
    });
    const { status, json } = run(exception);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'NO_RECORDS_ARCHIVABLE',
          message: 'None of the selected records could be archived',
          details: null,
        },
      }),
    );
  });

  it('falls back to "Route not found" for a genuinely unmatched route (no application code)', () => {
    // This is the shape Nest's own router produces for an unmatched path --
    // a plain HttpException with no `code` field at all.
    const exception = new HttpException(
      { statusCode: 404, message: 'Cannot GET /nope', error: 'Not Found' },
      404,
    );
    const { json } = run(exception);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Route not found' }),
      }),
    );
  });
});

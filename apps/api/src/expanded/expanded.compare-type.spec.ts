import { BadRequestException } from '@nestjs/common';
import { ExpandedPublicController } from './expanded.controller';
import type { ExpandedService } from './expanded.service';
import type { RequestWithId } from '../common/http.types';

/** ISS-034. An unknown comparison `:type` on `GET /phase1/compare/:type`
 * threw a plain `Error`, which Nest's default filter turns into an
 * unhandled 500 -- a client typo in the URL should never look like a
 * server crash. The sibling `/compare/:type/options` route already got
 * this right (`BadRequestException`, a clean 400); this just matches it. */
describe('ExpandedPublicController.compare -- unknown type', () => {
  function fakeRequest(): RequestWithId {
    return { requestId: 'req-1' } as unknown as RequestWithId;
  }

  it('throws BadRequestException, not a plain Error, for an unrecognized type', async () => {
    const controller = new ExpandedPublicController({} as ExpandedService);
    await expect(
      controller.compare(fakeRequest(), 'bogus-type' as 'countries', ''),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still calls through to the service for a recognized type', async () => {
    const compare = jest.fn().mockResolvedValue({ items: [], invalid: [] });
    const controller = new ExpandedPublicController({
      compare,
    } as unknown as ExpandedService);
    await controller.compare(fakeRequest(), 'countries', 'canada,australia');
    expect(compare).toHaveBeenCalledWith('countries', ['canada', 'australia']);
  });
});

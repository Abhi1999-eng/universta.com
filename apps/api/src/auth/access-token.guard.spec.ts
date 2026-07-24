import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard';
import { RuntimeConfigService } from '../config/runtime-config.service';

type TestRequest = {
  header: (name: string) => string | undefined;
  user?: unknown;
};
type TestContext = ExecutionContext & { testRequest: TestRequest };

function contextFor(authorization?: string): TestContext {
  const request: TestRequest = {
    header: (name: string) =>
      name === 'authorization' ? authorization : undefined,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as TestContext;
  context.testRequest = request;
  return context;
}

describe('AccessTokenGuard', () => {
  const config = {
    jwtAccessSecret: 'access-secret',
  } as RuntimeConfigService;

  it('rejects missing bearer credentials', async () => {
    const guard = new AccessTokenGuard({} as JwtService, config);

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects wrong token types and accepts a valid access payload', async () => {
    const verifyAsync = jest
      .fn()
      .mockResolvedValueOnce({
        sub: 'user-id',
        email: 'admin@example.com',
        roles: ['SUPER_ADMIN'],
        type: 'refresh',
        jti: 'token-id',
      })
      .mockResolvedValueOnce({
        sub: 'user-id',
        email: 'admin@example.com',
        roles: ['SUPER_ADMIN'],
        type: 'access',
        jti: 'token-id',
      });
    const guard = new AccessTokenGuard(
      { verifyAsync } as unknown as JwtService,
      config,
    );

    await expect(
      guard.canActivate(contextFor('Bearer token-1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const validContext = contextFor('Bearer token-2');
    await expect(guard.canActivate(validContext)).resolves.toBe(true);
    expect(validContext.testRequest.user).toMatchObject({
      sub: 'user-id',
      type: 'access',
    });
  });
});

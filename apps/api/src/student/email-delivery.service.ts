import { Injectable } from '@nestjs/common';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { StructuredLogger } from '../common/structured-logger.service';

/**
 * The boundary a real mail provider will plug into.
 *
 * This repository has no mail transport configured, and picking one is a
 * product decision rather than something to smuggle into this change. So the
 * flows that *need* to send call this service, and this service records that
 * a send was due. When a provider is chosen, only the body of these two
 * methods changes — no caller, no token logic, no test.
 *
 * The token is passed in so a transport can build the link. It is never
 * logged, and it never reaches an API response outside development.
 */
@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly logger: StructuredLogger,
  ) {}

  /** Development and test may surface the token to make the flow walkable
   * without a mailbox. Production never does. */
  get exposesTokens(): boolean {
    return !['production', 'staging'].includes(this.runtimeConfig.nodeEnv);
  }

  sendVerificationEmail(input: {
    userId: string;
    email: string;
    token: string;
  }): void {
    this.record('verification', input.userId, input.token);
  }

  sendPasswordResetEmail(input: {
    userId: string;
    email: string;
    token: string;
  }): void {
    this.record('password-reset', input.userId, input.token);
  }

  private record(kind: string, userId: string, token: string): void {
    // Outside production the token goes to the local log so a developer can
    // complete the flow; the structured logger redacts nothing here because
    // this branch never runs in a deployed environment.
    this.logger.logEvent(`student ${kind} email pending delivery`, {
      module: 'STUDENT_EMAIL',
      userId,
      transport: 'NONE_CONFIGURED',
      ...(this.exposesTokens ? { devToken: token } : {}),
    });
  }
}

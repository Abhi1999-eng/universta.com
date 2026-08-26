import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { RuntimeConfigService } from '../config/runtime-config.service';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /**
   * The deployed MySQL instance uses caching_sha2_password and the API reaches
   * it only through the loopback interface. The MariaDB driver otherwise has
   * no server key with which to encrypt the initial password exchange, leaving
   * the Prisma pool empty until each request times out.
   */
  allowPublicKeyRetrieval: boolean;
}

export function databaseConnectionFromUrl(
  databaseUrl: string,
): DatabaseConnectionConfig {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  };
}

/** Everything the MariaDB pool is configured with, in one testable place.
 *
 * Two independent fixes live here and both must survive a refactor: the
 * `allowPublicKeyRetrieval` flag above, without which the caching_sha2_password
 * handshake never completes, and the bounded timeouts below, without which a
 * database that cannot be reached holds every request for ~11s. */
export function databaseAdapterConfig(
  runtimeConfig: Pick<
    RuntimeConfigService,
    'databaseUrl' | 'databaseConnectTimeoutMs' | 'databaseAcquireTimeoutMs'
  >,
) {
  return {
    ...databaseConnectionFromUrl(runtimeConfig.databaseUrl),
    /* Unbounded in practice before this: the pool's default 10s acquire
     * timeout meant a single unreachable database held every request --
     * public pages and admin sign-in alike -- for ~11s before failing. */
    connectTimeout: runtimeConfig.databaseConnectTimeoutMs,
    acquireTimeout: runtimeConfig.databaseAcquireTimeoutMs,
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(runtimeConfig: RuntimeConfigService) {
    super({ adapter: new PrismaMariaDb(databaseAdapterConfig(runtimeConfig)) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async checkDatabaseConnection(): Promise<void> {
    await this.$queryRaw(Prisma.sql`SELECT 1`);
  }
}

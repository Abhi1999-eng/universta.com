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
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(runtimeConfig: RuntimeConfigService) {
    super({
      adapter: new PrismaMariaDb(
        databaseConnectionFromUrl(runtimeConfig.databaseUrl),
      ),
    });
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

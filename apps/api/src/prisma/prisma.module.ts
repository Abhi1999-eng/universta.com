import { Global, Module } from '@nestjs/common';
import { RuntimeConfigModule } from '../config/runtime-config.module';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [RuntimeConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

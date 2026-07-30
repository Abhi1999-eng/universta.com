import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScholarshipProvidersAdminController } from './catalog-lookups.controller';
import { CatalogLookupsService } from './catalog-lookups.service';

@Module({
  imports: [AuthModule],
  controllers: [ScholarshipProvidersAdminController],
  providers: [CatalogLookupsService],
  exports: [CatalogLookupsService],
})
export class CatalogLookupsModule {}

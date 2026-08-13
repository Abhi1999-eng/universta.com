import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CityRecoveryAdminController } from './city-recovery.controller';
import { ConsultantLocationsAdminController } from './consultant-locations-admin.controller';
import {
  CitiesAdminController,
  LocationsPublicController,
  StatesAdminController,
} from './locations.controller';
import { LocationsService } from './locations.service';
import { SeoManagementModule } from '../seo-management/seo-management.module';

@Module({
  imports: [AuthModule, SeoManagementModule],
  controllers: [
    LocationsPublicController,
    StatesAdminController,
    CitiesAdminController,
    CityRecoveryAdminController,
    ConsultantLocationsAdminController,
  ],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}

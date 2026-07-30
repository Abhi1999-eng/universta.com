import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  CitiesAdminController,
  ConsultantLocationsAdminController,
  LocationsPublicController,
  StatesAdminController,
} from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [AuthModule],
  controllers: [
    LocationsPublicController,
    StatesAdminController,
    CitiesAdminController,
    ConsultantLocationsAdminController,
  ],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}

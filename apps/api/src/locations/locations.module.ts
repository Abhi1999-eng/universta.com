import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  CitiesAdminController,
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
  ],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}

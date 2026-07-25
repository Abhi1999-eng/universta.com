import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCountriesController } from './admin-countries.controller';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import {
  AdminCountryProfilesController,
  AdminIntakesController,
} from './profiles/admin-country-profiles.controller';
import { CountryProfilesService } from './profiles/country-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminCountryProfilesController,
    AdminIntakesController,
    CountriesController,
    AdminCountriesController,
  ],
  providers: [CountriesService, CountryProfilesService],
  exports: [CountriesService],
})
export class CountriesModule {}

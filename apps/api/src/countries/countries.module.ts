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
import {
  AdminCountryEditorialController,
  PublicCountryEditorialController,
} from './editorial/country-editorial.controller';
import { CountryEditorialService } from './editorial/country-editorial.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminCountryProfilesController,
    AdminIntakesController,
    AdminCountryEditorialController,
    PublicCountryEditorialController,
    CountriesController,
    AdminCountriesController,
  ],
  providers: [
    CountriesService,
    CountryProfilesService,
    CountryEditorialService,
  ],
  exports: [CountriesService],
})
export class CountriesModule {}

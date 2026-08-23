import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogLookupsModule } from '../catalog-lookups/catalog-lookups.module';
import { AdminCountriesController } from './admin-countries.controller';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { CountryDerivedService } from './country-derived.service';
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
import { SeoManagementModule } from '../seo-management/seo-management.module';

@Module({
  imports: [AuthModule, CatalogLookupsModule, SeoManagementModule],
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
    CountryDerivedService,
    CountryProfilesService,
    CountryEditorialService,
  ],
  exports: [CountriesService],
})
export class CountriesModule {}

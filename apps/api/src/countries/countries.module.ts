import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCountriesController } from './admin-countries.controller';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';

@Module({
  imports: [AuthModule],
  controllers: [CountriesController, AdminCountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppExceptionFilter } from './common/app-exception.filter';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';
import { validateEnvironment } from './config/environment';
import { RuntimeConfigModule } from './config/runtime-config.module';
import { HealthService } from './health/health.service';
import { PrismaModule } from './prisma/prisma.module';
import { ContinentsModule } from './continents/continents.module';
import { CountriesModule } from './countries/countries.module';
import { SubjectsModule } from './subjects/subjects.module';
import { CourseLevelsModule } from './course-levels/course-levels.module';
import { StudyModesModule } from './study-modes/study-modes.module';
import { CoursesModule } from './courses/courses.module';
import { LeadsModule } from './leads/leads.module';
import { ExpandedModule } from './expanded/expanded.module';
import { MediaModule } from './media/media.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { LocationsModule } from './locations/locations.module';
import { UniversityClaimsModule } from './university-claims/university-claims.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), 'apps/api/.env'),
        resolve(process.cwd(), '.env'),
      ],
      validate: validateEnvironment,
    }),
    CommonModule,
    RuntimeConfigModule,
    PrismaModule,
    AuthModule,
    ContinentsModule,
    CountriesModule,
    SubjectsModule,
    CourseLevelsModule,
    StudyModesModule,
    CoursesModule,
    LeadsModule,
    ExpandedModule,
    MediaModule,
    ExperimentsModule,
    LocationsModule,
    UniversityClaimsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppExceptionFilter,
    HealthService,
    { provide: APP_FILTER, useExisting: AppExceptionFilter },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

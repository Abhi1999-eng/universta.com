import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppExceptionFilter } from './common/app-exception.filter';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { StudentModule } from './student/student.module';
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
import { BulkModule } from './bulk/bulk.module';
import { RedirectsModule } from './redirects/redirects.module';
import { InternalLinksModule } from './internal-links/internal-links.module';
import { PageTemplatesModule } from './page-templates/page-templates.module';
import { SettingsModule } from './settings/settings.module';
import { WebsiteBuilderModule } from './website-builder/website-builder.module';
import { StaticPageSeoModule } from './static-page-seo/static-page-seo.module';
import { PreviewModule } from './preview/preview.module';
import { VersionsModule } from './versions/versions.module';
import { StatsPillsModule } from './stats-pills/stats-pills.module';

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
    StudentModule,
    ContinentsModule,
    CountriesModule,
    SubjectsModule,
    CourseLevelsModule,
    StudyModesModule,
    CoursesModule,
    LeadsModule,
    // Registered before ExpandedModule: its public routes live under the
    // same "phase1" prefix, and ExpandedPublicController's generic
    // `phase1/:resource/:slug` route would otherwise match (and swallow)
    // `phase1/internal-links/resolve` first, since Nest/Express route
    // matching is registration-order-first for equally-specific patterns.
    InternalLinksModule,
    SettingsModule,
    StaticPageSeoModule,
    WebsiteBuilderModule,
    // Same reason: its literal `phase1/cities` route must win over
    // ExpandedPublicController's generic `phase1/:resource`.
    LocationsModule,
    StatsPillsModule,
    // Same reason again: literal `phase1/preview/page`.
    PreviewModule,
    VersionsModule,
    ExpandedModule,
    MediaModule,
    ExperimentsModule,
    UniversityClaimsModule,
    BulkModule,
    RedirectsModule,
    PageTemplatesModule,
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

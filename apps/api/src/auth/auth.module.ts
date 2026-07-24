import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './access-token.guard';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [JwtModule.register({}), CommonModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AccessTokenGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, PasswordService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}

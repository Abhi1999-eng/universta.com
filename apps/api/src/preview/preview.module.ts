import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  PreviewAdminController,
  PreviewPublicController,
} from './preview.controller';
import { PreviewService } from './preview.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PreviewAdminController, PreviewPublicController],
  providers: [PreviewService],
})
export class PreviewModule {}

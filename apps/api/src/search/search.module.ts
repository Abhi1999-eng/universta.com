import { Module } from '@nestjs/common';
import { SearchPublicController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchPublicController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

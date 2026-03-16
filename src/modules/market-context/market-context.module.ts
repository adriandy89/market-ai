import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { NewsService } from './news.service';
import { SentimentService } from './sentiment.service';
import { MacroContextService } from './macro-context.service';
import { MarketContextService } from './market-context.service';
import { MarketContextController } from './market-context.controller';

@Module({
  imports: [CryptoModule],
  controllers: [MarketContextController],
  providers: [NewsService, SentimentService, MacroContextService, MarketContextService],
  exports: [MarketContextService],
})
export class MarketContextModule {}

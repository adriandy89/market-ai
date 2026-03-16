import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { CryptoModule } from '../crypto/crypto.module';
import { MarketContextModule } from '../market-context/market-context.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [CryptoModule, AnalysisModule, MarketContextModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }

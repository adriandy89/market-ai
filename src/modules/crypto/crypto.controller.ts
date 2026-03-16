import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserInfo } from '../auth/decorators';
import { SessionGuard } from '../auth/guards';
import type { SessionUser } from '../auth/interfaces';
import { CryptoService } from './crypto.service';

@ApiTags('Crypto')
@Controller('crypto')
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) { }

  @Get('top')
  async getTopCoins(@Query('limit') limit?: string) {
    return this.cryptoService.getTopCoins(limit ? parseInt(limit) : 20);
  }

  @Get('trending')
  async getTrending() {
    return this.cryptoService.getTrending();
  }

  @Get('price/:symbol')
  async getCoinPrice(@Param('symbol') symbol: string) {
    return this.cryptoService.getCoinPrice(symbol.toUpperCase());
  }

  @Get('klines/:symbol')
  async getKlines(
    @Param('symbol') symbol: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.cryptoService.getKlines(
      symbol.toUpperCase(),
      interval || '4h',
      limit ? parseInt(limit) : 300,
      endTime ? parseInt(endTime) : undefined,
    );
  }

  @Get('history/:symbol')
  async getCoinHistory(
    @Param('symbol') symbol: string,
    @Query('days') days?: string,
  ) {
    return this.cryptoService.getCoinHistory(
      symbol.toUpperCase(),
      days ? parseInt(days) : 30,
    );
  }

  // ── Watchlist (protected) ──

  @Get('watchlist')
  @UseGuards(SessionGuard)
  async getWatchlist(@GetUserInfo() user: SessionUser) {
    return this.cryptoService.getUserWatchlist(user.id);
  }

  @Post('watchlist')
  @UseGuards(SessionGuard)
  async addToWatchlist(
    @GetUserInfo() user: SessionUser,
    @Body() body: { symbol: string; name: string },
  ) {
    return this.cryptoService.addToWatchlist(user.id, body.symbol.toUpperCase(), body.name);
  }

  @Delete('watchlist/:symbol')
  @UseGuards(SessionGuard)
  async removeFromWatchlist(
    @GetUserInfo() user: SessionUser,
    @Param('symbol') symbol: string,
  ) {
    return this.cryptoService.removeFromWatchlist(user.id, symbol.toUpperCase());
  }
}

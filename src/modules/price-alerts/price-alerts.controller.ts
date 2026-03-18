import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GetUserInfo } from '../auth/decorators';
import { SessionGuard } from '../auth/guards';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { PriceAlertsService } from './price-alerts.service';

@Controller('price-alerts')
@UseGuards(SessionGuard)
export class PriceAlertsController {
  constructor(private readonly priceAlertsService: PriceAlertsService) {}

  @Post()
  create(@GetUserInfo() user: any, @Body() dto: CreateAlertDto) {
    return this.priceAlertsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @GetUserInfo() user: any,
    @Query('symbol') symbol?: string,
    @Query('active') active?: string,
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.priceAlertsService.findAllByUser(user.id, symbol, isActive);
  }

  @Get(':id')
  findOne(@GetUserInfo() user: any, @Param('id') id: string) {
    return this.priceAlertsService.findOne(id, user.id);
  }

  @Put(':id')
  update(@GetUserInfo() user: any, @Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.priceAlertsService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@GetUserInfo() user: any, @Param('id') id: string) {
    return this.priceAlertsService.remove(id, user.id);
  }

  @Put(':id/toggle')
  toggle(@GetUserInfo() user: any, @Param('id') id: string) {
    return this.priceAlertsService.toggle(id, user.id);
  }
}

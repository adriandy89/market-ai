import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@Injectable()
export class PriceAlertsService {
  private readonly logger = new Logger(PriceAlertsService.name);

  constructor(
    private readonly db: DbService,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(userId: string, dto: CreateAlertDto) {
    const priceData = await this.cryptoService.getCoinPrice(dto.symbol);
    const basePrice = priceData.price || 0;

    if (!basePrice) {
      throw new NotFoundException(`No se pudo obtener el precio de ${dto.symbol}`);
    }

    const isRecurring = dto.alertType === 'FIXED_PRICE' ? false : (dto.isRecurring ?? false);

    return this.db.priceAlert.create({
      data: {
        user_id: userId,
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        alert_type: dto.alertType,
        direction: dto.direction,
        threshold_percent: dto.thresholdPercent ?? null,
        threshold_price: dto.thresholdPrice ?? null,
        time_window_hours: dto.timeWindowHours ?? null,
        base_price: basePrice,
        is_recurring: isRecurring,
      },
    });
  }

  async findAllByUser(userId: string, symbol?: string, isActive?: boolean) {
    return this.db.priceAlert.findMany({
      where: {
        user_id: userId,
        ...(symbol && { symbol: symbol.toUpperCase() }),
        ...(isActive !== undefined && { is_active: isActive }),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const alert = await this.db.priceAlert.findFirst({
      where: { id, user_id: userId },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    return alert;
  }

  async update(id: string, userId: string, dto: UpdateAlertDto) {
    await this.findOne(id, userId);
    return this.db.priceAlert.update({
      where: { id },
      data: {
        ...(dto.direction !== undefined && { direction: dto.direction }),
        ...(dto.thresholdPercent !== undefined && { threshold_percent: dto.thresholdPercent }),
        ...(dto.thresholdPrice !== undefined && { threshold_price: dto.thresholdPrice }),
        ...(dto.timeWindowHours !== undefined && { time_window_hours: dto.timeWindowHours }),
        ...(dto.isRecurring !== undefined && { is_recurring: dto.isRecurring }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.db.priceAlert.delete({ where: { id } });
  }

  async toggle(id: string, userId: string) {
    const alert = await this.findOne(id, userId);
    return this.db.priceAlert.update({
      where: { id },
      data: { is_active: !alert.is_active },
    });
  }
}

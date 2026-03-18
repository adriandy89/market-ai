import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CacheService, DbService } from 'src/libs';
import { AlertType } from 'generated/prisma/enums';
import type { PriceAlertModel } from 'generated/prisma/models';
import { CryptoService } from '../crypto/crypto.service';
import { TelegramService } from '../telegram/telegram.service';

type AlertWithUser = PriceAlertModel & { user: { telegram_chat_id: string | null; language: string } };

@Injectable()
export class PriceAlertsChecker {
  private readonly logger = new Logger(PriceAlertsChecker.name);

  constructor(
    private readonly db: DbService,
    private readonly cryptoService: CryptoService,
    private readonly telegramService: TelegramService,
    private readonly cacheService: CacheService,
  ) { }

  @Interval(10_000)
  async checkAlerts() {
    const lockAcquired = await this.cacheService.setNx('price-alerts:checker:lock', '1', 8);
    if (!lockAcquired) return;

    try {
      const alerts = await this.db.priceAlert.findMany({
        where: { is_active: true },
        include: { user: { select: { telegram_chat_id: true, language: true } } },
      });

      if (!alerts.length) return;

      const bySymbol = new Map<string, AlertWithUser[]>();
      for (const alert of alerts) {
        const list = bySymbol.get(alert.symbol) || [];
        list.push(alert as AlertWithUser);
        bySymbol.set(alert.symbol, list);
      }

      for (const [symbol, symbolAlerts] of bySymbol) {
        try {
          await this.processSymbolAlerts(symbol, symbolAlerts);
        } catch (err: any) {
          this.logger.error(`Error checking alerts for ${symbol}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in checkAlerts: ${err.message}`, err.stack);
    }
  }

  private async processSymbolAlerts(symbol: string, alerts: AlertWithUser[]) {
    const priceData = await this.cryptoService.getCoinPrice(symbol);
    const currentPrice = priceData?.price;
    if (!currentPrice) return;

    const windowAlerts = alerts.filter((a) => a.alert_type === AlertType.PERCENTAGE_CHANGE_WINDOW);
    const windowPrices = new Map<number, number>();

    if (windowAlerts.length > 0) {
      const uniqueWindows = [...new Set(windowAlerts.map((a) => a.time_window_hours!))];
      await Promise.allSettled(
        uniqueWindows.map(async (hours) => {
          const klines = await this.cryptoService.getKlines(symbol, '1h', hours);
          if (klines?.data?.length > 0) {
            windowPrices.set(hours, klines.data[0].close);
          }
        }),
      );
    }

    for (const alert of alerts) {
      try {
        const triggered = this.evaluateAlert(alert, currentPrice, windowPrices);
        if (triggered) {
          await this.handleTriggeredAlert(alert, currentPrice);
        }
      } catch (err: any) {
        this.logger.error(`Error evaluating alert ${alert.id}: ${err.message}`);
      }
    }
  }

  private evaluateAlert(
    alert: PriceAlertModel,
    currentPrice: number,
    windowPrices: Map<number, number>,
  ): boolean {
    switch (alert.alert_type) {
      case AlertType.FIXED_PRICE:
        return this.checkFixedPrice(alert, currentPrice);
      case AlertType.PERCENTAGE_CHANGE_FROM_PRICE:
        return this.checkPercentageFromPrice(alert, currentPrice);
      case AlertType.PERCENTAGE_CHANGE_WINDOW:
        return this.checkPercentageWindow(alert, currentPrice, windowPrices);
      default:
        return false;
    }
  }

  private checkFixedPrice(alert: PriceAlertModel, currentPrice: number): boolean {
    const threshold = alert.threshold_price!;
    switch (alert.direction) {
      case 'UP':
        return currentPrice >= threshold;
      case 'DOWN':
        return currentPrice <= threshold;
      case 'BOTH':
        return currentPrice >= threshold || currentPrice <= threshold;
      default:
        return false;
    }
  }

  private checkPercentageFromPrice(alert: PriceAlertModel, currentPrice: number): boolean {
    const pctChange = ((currentPrice - alert.base_price) / alert.base_price) * 100;
    const threshold = alert.threshold_percent!;

    switch (alert.direction) {
      case 'UP':
        return pctChange >= threshold;
      case 'DOWN':
        return pctChange <= -threshold;
      case 'BOTH':
        return Math.abs(pctChange) >= threshold;
      default:
        return false;
    }
  }

  private checkPercentageWindow(
    alert: PriceAlertModel,
    currentPrice: number,
    windowPrices: Map<number, number>,
  ): boolean {
    const pastPrice = windowPrices.get(alert.time_window_hours!);
    if (!pastPrice) return false;

    const pctChange = ((currentPrice - pastPrice) / pastPrice) * 100;
    const threshold = alert.threshold_percent!;

    switch (alert.direction) {
      case 'UP':
        return pctChange >= threshold;
      case 'DOWN':
        return pctChange <= -threshold;
      case 'BOTH':
        return Math.abs(pctChange) >= threshold;
      default:
        return false;
    }
  }

  private async handleTriggeredAlert(alert: AlertWithUser, currentPrice: number) {
    this.logger.log(`Alert triggered: ${alert.id} (${alert.symbol} ${alert.alert_type})`);

    if (alert.user.telegram_chat_id) {
      const message = this.buildNotificationMessage(alert, currentPrice, alert.user.language);
      await this.telegramService.sendMessage(alert.user.telegram_chat_id, message);
    } else {
      this.logger.warn(`User ${alert.user_id} has no Telegram linked, skipping notification for alert ${alert.id}`);
    }

    const updateData: any = {
      last_triggered_at: new Date(),
      trigger_count: { increment: 1 },
    };

    if (!alert.is_recurring) {
      updateData.is_active = false;
    } else if (alert.alert_type === AlertType.PERCENTAGE_CHANGE_FROM_PRICE) {
      updateData.base_price = currentPrice;
    }

    await this.db.priceAlert.update({ where: { id: alert.id }, data: updateData });
  }

  private buildNotificationMessage(alert: PriceAlertModel, currentPrice: number, language: string): string {
    const isEs = language === 'es';
    const pctChange = ((currentPrice - alert.base_price) / alert.base_price) * 100;
    const direction = pctChange >= 0 ? (isEs ? 'subido' : 'risen') : (isEs ? 'bajado' : 'fallen');
    const arrow = pctChange >= 0 ? '📈' : '📉';
    const priceStr = this.formatPrice(currentPrice);

    let detail = '';
    let lines: string[] = [];

    switch (alert.alert_type) {
      case AlertType.FIXED_PRICE: {
        const targetStr = this.formatPrice(alert.threshold_price!);
        detail = isEs
          ? `${arrow} ${alert.name} ha alcanzado tu precio objetivo de $${targetStr}`
          : `${arrow} ${alert.name} has reached your target price of $${targetStr}`;
        lines = [
          `💰 ${isEs ? 'Precio actual' : 'Current price'}: $${priceStr}`,
          `🎯 ${isEs ? 'Precio objetivo' : 'Target price'}: $${targetStr}`,
        ];
        break;
      }
      case AlertType.PERCENTAGE_CHANGE_WINDOW:
        detail = isEs
          ? `${arrow} ${alert.name} ha ${direction} ${Math.abs(pctChange).toFixed(2)}% en las últimas ${alert.time_window_hours}h`
          : `${arrow} ${alert.name} has ${direction} ${Math.abs(pctChange).toFixed(2)}% in the last ${alert.time_window_hours}h`;
        lines = [
          `💰 ${isEs ? 'Precio actual' : 'Current price'}: $${priceStr}`,
        ];
        break;
      case AlertType.PERCENTAGE_CHANGE_FROM_PRICE: {
        const basePriceStr = this.formatPrice(alert.base_price);
        detail = isEs
          ? `${arrow} ${alert.name} ha ${direction} ${Math.abs(pctChange).toFixed(2)}% desde tu precio base`
          : `${arrow} ${alert.name} has ${direction} ${Math.abs(pctChange).toFixed(2)}% from your base price`;
        lines = [
          `💰 ${isEs ? 'Precio actual' : 'Current price'}: $${priceStr}`,
          `📊 ${isEs ? 'Precio base' : 'Base price'}: $${basePriceStr}`,
        ];
        break;
      }
    }

    const recurringLabel = alert.is_recurring
      ? (isEs ? '🔄 Recurrente' : '🔄 Recurring')
      : (isEs ? '⚡ Una vez' : '⚡ One-time');

    return [
      `🚨 <b>${isEs ? 'Alerta de Precio' : 'Price Alert'}: ${alert.symbol}</b>`,
      '',
      detail,
      ...lines,
      '',
      recurringLabel,
    ].join('\n');
  }

  private formatPrice(price: number): string {
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toPrecision(4);
  }
}

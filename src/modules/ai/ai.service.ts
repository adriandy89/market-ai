import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: DbService,
    private readonly cryptoService: CryptoService,
    private readonly analysisService: AnalysisService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async generateReport(userId: string, symbol: string, timeframe: string = '4h') {
    // Gather all market context in parallel (all from Binance klines)
    const [price, indicators, patterns, levels] = await Promise.all([
      this.cryptoService.getCoinPrice(symbol),
      this.analysisService.getIndicators(symbol, timeframe),
      this.analysisService.getPatterns(symbol, timeframe),
      this.analysisService.getSupportResistance(symbol, timeframe),
    ]);

    const marketContext = JSON.stringify({ price, indicators, patterns, levels }, null, 2);

    let aiAnalysis: string;
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert crypto market analyst. Analyze the provided market data and generate a concise, actionable report. Structure your response as JSON with these fields:
- "summary": 2-3 sentence executive summary
- "technicalAnalysis": key technical findings (trend direction, momentum, volatility)
- "signals": array of { "type": "bullish"|"bearish"|"neutral", "indicator": string, "detail": string }
- "riskAssessment": "low"|"medium"|"high" with explanation
- "outlook": short-term outlook (1-7 days)
Respond ONLY with valid JSON, no markdown.`,
        messages: [
          {
            role: 'user',
            content: `Analyze ${symbol} on the ${timeframe} timeframe. Here is the current market data:\n\n${marketContext}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      aiAnalysis = textBlock?.text || '{}';
    } catch (error) {
      this.logger.error(`Anthropic API error for ${symbol}:`, error);
      aiAnalysis = JSON.stringify({
        summary: `Analysis for ${symbol} could not be generated. API error.`,
        technicalAnalysis: 'Unavailable',
        signals: [],
        riskAssessment: 'unknown',
        outlook: 'Unavailable',
      });
    }

    // Parse AI response
    let parsedAnalysis: any;
    try {
      parsedAnalysis = JSON.parse(aiAnalysis);
    } catch {
      parsedAnalysis = { summary: aiAnalysis, raw: true };
    }

    const reportContent = {
      symbol,
      timeframe,
      price,
      indicators: indicators?.indicators || null,
      patterns: patterns?.patterns || [],
      levels,
      aiAnalysis: parsedAnalysis,
      generatedAt: new Date().toISOString(),
    };

    const report = await this.dbService.analysisReport.create({
      data: {
        user_id: userId,
        symbol,
        timeframe,
        report_type: 'full',
        content: reportContent,
      },
    });

    return report;
  }

  async getUserReports(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [itemCount, reports] = await this.dbService.$transaction([
      this.dbService.analysisReport.count({ where: { user_id: userId } }),
      this.dbService.analysisReport.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data: reports, meta: { itemCount, page, limit } };
  }

  async getReport(reportId: string, userId: string) {
    return this.dbService.analysisReport.findFirst({
      where: { id: reportId, user_id: userId },
    });
  }
}

-- CreateIndex
CREATE INDEX "idx_report_lookup" ON "analysis_reports"("symbol", "timeframe", "report_type", "created_at");

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PERCENTAGE_CHANGE_WINDOW', 'PERCENTAGE_CHANGE_FROM_PRICE', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('UP', 'DOWN', 'BOTH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegram_chat_id" VARCHAR(128);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "threshold_percent" DOUBLE PRECISION,
    "threshold_price" DOUBLE PRECISION,
    "time_window_hours" INTEGER,
    "base_price" DOUBLE PRECISION NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMPTZ(6),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "pk_price_alert_id" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_price_alert_user_id" ON "price_alerts"("user_id");

-- CreateIndex
CREATE INDEX "idx_price_alert_active_type" ON "price_alerts"("is_active", "alert_type");

-- CreateIndex
CREATE INDEX "idx_price_alert_user_active" ON "price_alerts"("user_id", "is_active");

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "fk_price_alert_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" VARCHAR(100) NOT NULL,
    "symbols" JSONB NOT NULL,
    "cron_hour" INTEGER NOT NULL,
    "cron_minute" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_scheduled_report_id" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "fk_scheduled_report_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

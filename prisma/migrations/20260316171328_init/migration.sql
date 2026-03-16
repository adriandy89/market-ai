-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR(128) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "pk_user_id" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pk_verification_token_id" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pk_passw_reset_token_id" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(128),
    "ip" VARCHAR(128),
    "attributes" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,
    "logout_at" TIMESTAMPTZ(6),

    CONSTRAINT "pk_session_logs_id" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,

    CONSTRAINT "pk_watchlist_id" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT ('now'::text)::timestamp with time zone,

    CONSTRAINT "pk_analysis_report_id" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_disabled_idx" ON "users"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_email_verificaton" ON "verification_tokens"("email");

-- CreateIndex
CREATE INDEX "idx_token_verificaton" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_email_token_key" ON "verification_tokens"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_email_passw_reset" ON "password_reset_tokens"("email");

-- CreateIndex
CREATE INDEX "idx_token_passw_reset" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_email_token_key" ON "password_reset_tokens"("email", "token");

-- CreateIndex
CREATE INDEX "idx_session_session_id" ON "session_logs"("session_id");

-- CreateIndex
CREATE INDEX "idx_session_user_id" ON "session_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_session_email" ON "session_logs"("email");

-- CreateIndex
CREATE INDEX "idx_session_logout_at" ON "session_logs"("logout_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_session_logs_session_id" ON "session_logs"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_watchlist_user_id" ON "watchlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_watchlist_user_symbol" ON "watchlists"("user_id", "symbol");

-- CreateIndex
CREATE INDEX "idx_report_user_id" ON "analysis_reports"("user_id");

-- CreateIndex
CREATE INDEX "idx_report_symbol" ON "analysis_reports"("symbol");

-- CreateIndex
CREATE INDEX "idx_report_created_at" ON "analysis_reports"("created_at");

-- AddForeignKey
ALTER TABLE "session_logs" ADD CONSTRAINT "fk_session_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "fk_watchlist_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_reports" ADD CONSTRAINT "fk_report_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'passed', 'failed', 'errored', 'cancelled');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "IssuerImpl" AS ENUM ('inji_certify', 'mock_issuer');

-- CreateEnum
CREATE TYPE "WalletImpl" AS ENUM ('reference_wallet', 'inji_web_assisted');

-- CreateEnum
CREATE TYPE "VerifierImpl" AS ENUM ('inji_verify', 'mock_verifier');

-- CreateEnum
CREATE TYPE "CredentialFormat" AS ENUM ('ldp_vc', 'vc_sd_jwt');

-- CreateEnum
CREATE TYPE "FlowVariant" AS ENUM ('cross_device');

-- CreateEnum
CREATE TYPE "VerifyOutcome" AS ENUM ('valid', 'invalid', 'expired', 'error');

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "scenario_id" UUID,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "issuer" "IssuerImpl" NOT NULL,
    "wallet" "WalletImpl" NOT NULL,
    "verifier" "VerifierImpl" NOT NULL,
    "format" "CredentialFormat" NOT NULL,
    "proof_type" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "flow" "FlowVariant" NOT NULL DEFAULT 'cross_device',
    "expected_outcome" "VerifyOutcome" NOT NULL DEFAULT 'valid',
    "actual_outcome" "VerifyOutcome",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_steps" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "step_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'pending',
    "summary" JSONB,

    CONSTRAINT "run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "actor_from" TEXT NOT NULL,
    "actor_to" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "redactions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_created_idx" ON "runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE INDEX "run_steps_run_idx" ON "run_steps"("run_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "run_steps_run_id_seq_key" ON "run_steps"("run_id", "seq");

-- CreateIndex
CREATE INDEX "exchanges_run_idx" ON "exchanges"("run_id", "seq");

-- CreateIndex
CREATE INDEX "exchanges_step_idx" ON "exchanges"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_run_id_seq_key" ON "exchanges"("run_id", "seq");

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "run_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

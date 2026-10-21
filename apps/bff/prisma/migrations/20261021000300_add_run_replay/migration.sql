ALTER TABLE "runs" ADD COLUMN "parent_run_id" UUID;

CREATE INDEX "runs_parent_idx" ON "runs"("parent_run_id");

ALTER TABLE "runs"
ADD CONSTRAINT "runs_parent_run_id_fkey"
FOREIGN KEY ("parent_run_id") REFERENCES "runs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "TamperKind" AS ENUM ('expired', 'bad_signature', 'wrong_type', 'missing_disclosure', 'replay_nonce');

ALTER TABLE "runs" ADD COLUMN "tamper" "TamperKind";

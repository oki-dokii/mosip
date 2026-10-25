-- Synthetic local Inji Verify database, aligned with the official v0.18.2 DDL.
-- Source reference: https://github.com/inji/inji-verify/tree/v0.18.2/db_scripts/inji_verify/ddl
-- The release's docker-compose/db-init/init.sql omits response-code columns
-- required by the v0.18.2 service; this file includes them from the tagged DDL.
CREATE SCHEMA IF NOT EXISTS verify;

CREATE TABLE IF NOT EXISTS verify.authorization_request_details (
  request_id varchar(40) NOT NULL,
  transaction_id varchar(40) NOT NULL,
  authorization_details text NOT NULL,
  expires_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS verify.presentation_definition (
  id varchar(36) NOT NULL,
  input_descriptors text NOT NULL,
  name varchar(500),
  purpose varchar(500),
  vp_format text,
  submission_requirements text
);

CREATE TABLE IF NOT EXISTS verify.vc_submission (
  transaction_id varchar(40) NOT NULL,
  vc text NOT NULL
);

CREATE TABLE IF NOT EXISTS verify.vp_submission (
  request_id varchar(40) NOT NULL,
  vp_token varchar,
  presentation_submission text,
  error varchar(100),
  error_description varchar(200),
  response_code varchar(200),
  response_code_expiry_at timestamptz,
  response_code_used boolean DEFAULT false,
  CONSTRAINT uq_vp_submission_response_code UNIQUE (response_code)
);

CREATE INDEX IF NOT EXISTS idx_vp_submission_response_code
  ON verify.vp_submission (response_code);

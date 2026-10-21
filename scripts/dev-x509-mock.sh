#!/usr/bin/env bash
set -euo pipefail

task_cert_dir=$(mktemp -d "${TMPDIR:-/tmp}/playground-x509-XXXXXX")
cleanup() { rm -rf "$task_cert_dir"; }
trap cleanup EXIT

openssl req -x509 -newkey ed25519 -nodes \
  -keyout "$task_cert_dir/key.pem" -out "$task_cert_dir/cert.pem" \
  -days 1 -subj '/CN=mock-issuer.example.org' \
  -addext 'subjectAltName=DNS:mock-issuer.example.org' >/dev/null 2>&1

export MOCK_ISSUER_SIGNING_KEY_PATH="$task_cert_dir/key.pem"
export MOCK_ISSUER_CERT_CHAIN_PATH="$task_cert_dir/cert.pem"
export MOCK_ISSUER_ISSUER_ID=https://mock-issuer.example.org
export MOCK_ISSUER_BASE_URL=http://127.0.0.1:4101
export MOCK_ISSUER_VERSION_LABEL=mock-x509-1
export PLAYGROUND_DRIVER_MODE=collab

echo 'Starting the playground with an ephemeral, self-signed X.509 test issuer.'
pnpm dev

// Helper to query the local Verify result for the active mobile transaction.
import { readFile } from "node:fs/promises";

const session = JSON.parse(await readFile("/Users/dayalgupta/.gemini/antigravity/brain/cda0ee46-7aa4-48a7-ad17-9769cf4d2b30/session.json", "utf8"));
const txnId = session.transactionId;
console.log(`Checking status for transaction: ${txnId}...`);

// Query v2/vp-results
const res = await fetch(`http://127.0.0.1:18081/v1/verify/v2/vp-results/${encodeURIComponent(txnId)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ includeClaims: false, skipStatusChecks: true })
});

const data = await res.json();
console.log("HTTP Status:", res.status);
console.log("Raw Response:", JSON.stringify(data, null, 2));

if (res.status === 200 && typeof data.allChecksSuccessful === "boolean") {
  const c = data.credentialResults?.[0];
  const sanitized = {
    status: data.allChecksSuccessful ? "valid" : "invalid",
    allChecksSuccessful: data.allChecksSuccessful,
    credentialProofValid: c?.schemaAndSignatureCheck?.valid ?? null,
    holderProofValid: c?.holderProofCheck?.valid ?? null
  };
  console.log("\n--- Sanitized Result ---");
  console.log(JSON.stringify(sanitized, null, 2));
}


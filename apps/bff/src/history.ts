import type { RunSummary } from "@playground/shared";

export interface HistoryFilters {
  issuer?: string;
  wallet?: string;
  verifier?: string;
  format?: string;
  status?: string;
  tamper?: string;
  issuerVersion?: string;
  verifierVersion?: string;
}

export function filterRuns(runs: RunSummary[], filters: HistoryFilters) {
  return runs.filter((run) =>
    (!filters.issuer || run.config.issuer === filters.issuer) &&
    (!filters.wallet || run.config.wallet === filters.wallet) &&
    (!filters.verifier || run.config.verifier === filters.verifier) &&
    (!filters.format || run.config.format === filters.format) &&
    (!filters.status || run.status === filters.status) &&
    (!filters.tamper || (run.config.tamper ?? "none") === filters.tamper) &&
    (!filters.issuerVersion || run.serviceVersions?.issuer === filters.issuerVersion) &&
    (!filters.verifierVersion || run.serviceVersions?.verifier === filters.verifierVersion));
}

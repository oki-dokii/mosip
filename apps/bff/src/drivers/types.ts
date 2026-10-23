import type { Exchange, RunConfig, RunStep } from "@playground/shared";

export type DriverExchange = Omit<Exchange, "id" | "runId" | "stepId" | "seq" | "redactions">;

export interface DriverResult {
  exchanges?: DriverExchange[];
  summary?: Record<string, unknown>;
}

export interface DriverContext {
  readonly config: RunConfig;
  readonly signal?: AbortSignal;
  readonly state: Map<string, unknown>;
}

export interface IssuerDriver {
  readonly id: RunConfig["issuer"];
  createOffer(context: DriverContext): Promise<DriverResult>;
}

export interface WalletDriver {
  readonly id: RunConfig["wallet"];
  authorize(context: DriverContext): Promise<DriverResult>;
  requestCredential(context: DriverContext): Promise<DriverResult>;
  store(context: DriverContext): Promise<DriverResult>;
  present(context: DriverContext): Promise<DriverResult>;
}

export interface VerifierDriver {
  readonly id: RunConfig["verifier"];
  createRequest(context: DriverContext): Promise<DriverResult>;
  pollStatus(context: DriverContext): Promise<DriverResult>;
  getResult(context: DriverContext): Promise<DriverResult>;
}

export interface DriverSet {
  issuer: IssuerDriver;
  wallet: WalletDriver;
  verifier: VerifierDriver;
}

export type DriverStep = RunStep["stepKey"];

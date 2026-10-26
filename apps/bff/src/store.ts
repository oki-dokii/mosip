import { Prisma, PrismaClient } from "@prisma/client";
import type { Exchange, RunStep, RunSummary } from "@playground/shared";
import { protocolMetadata } from "./protocol.js";

export interface RunRecord {
  run: RunSummary;
  steps: RunStep[];
  exchanges: Exchange[];
}

export interface RunRepository {
  readonly storage: "memory" | "postgres";
  create(record: RunRecord): Promise<RunRecord>;
  get(id: string): Promise<RunRecord | undefined>;
  list(): Promise<RunSummary[]>;
  updateRun(run: RunSummary): Promise<void>;
  updateStep(step: RunStep): Promise<void>;
  addExchange(exchange: Exchange): Promise<void>;
  addExchanges(exchanges: Exchange[]): Promise<number>;
  clear(): Promise<void>;
  pruneCompletedBefore?(cutoff: Date, excludedIds?: readonly string[]): Promise<number>;
  disconnect(): Promise<void>;
}

export class MemoryRunRepository implements RunRepository {
  readonly storage = "memory" as const;
  private readonly runs = new Map<string, RunRecord>();

  async create(record: RunRecord) {
    this.runs.set(record.run.id, record);
    return record;
  }

  async get(id: string) {
    const record = this.runs.get(id);
    if (record) Object.assign(record.run, protocolMetadata(record.steps));
    return record;
  }

  async list() {
    return [...this.runs.values()]
      .map(({ run, steps }) => Object.assign(run, protocolMetadata(steps)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateRun(run: RunSummary) {
    const record = this.runs.get(run.id);
    if (record) record.run = run;
  }

  async updateStep(step: RunStep) {
    const record = this.runs.get(step.runId);
    const index = record?.steps.findIndex((item) => item.id === step.id) ?? -1;
    if (record && index >= 0) record.steps[index] = step;
  }

  async addExchange(exchange: Exchange) {
    const record = this.runs.get(exchange.runId);
    if (record && !record.exchanges.some((item) => item.id === exchange.id)) {
      record.exchanges.push(exchange);
    }
  }

  async addExchanges(exchanges: Exchange[]) {
    const record = exchanges.length ? this.runs.get(exchanges[0]!.runId) : undefined;
    if (!record) return 0;
    const existing = new Set(record.exchanges.map((item) => item.id));
    const fresh = exchanges.filter((item) => !existing.has(item.id));
    record.exchanges.push(...fresh);
    return fresh.length;
  }

  async pruneCompletedBefore(cutoff: Date, excludedIds: readonly string[] = []) {
    let deleted = 0;
    for (const [id, record] of this.runs) if (!excludedIds.includes(id) && record.run.recordKind !== "archived_evidence" && ["passed","failed","errored","cancelled"].includes(record.run.status) && record.run.finishedAt && Date.parse(record.run.finishedAt) < cutoff.getTime()) { this.runs.delete(id); deleted++; }
    return deleted;
  }
  async clear() {
    this.runs.clear();
  }

  async disconnect() {}
}

type StoredRun = Prisma.RunGetPayload<{ include: { steps: true; exchanges: true } }>;

function fromStored(record: StoredRun): RunRecord {
  if (record.expectedOutcome === "error") {
    throw new Error(`Unsupported expected outcome: ${record.expectedOutcome}`);
  }
  return {
    run: {
      id: record.id,
      parentRunId: record.parentRunId,
      config: {
        issuer: record.issuer,
        wallet: record.wallet,
        verifier: record.verifier,
        format: record.format,
        flow: record.flow,
        tamper: record.tamper,
        scenarioId: record.scenarioId,
      },
      status: record.status,
      expectedOutcome: record.expectedOutcome,
      actualOutcome: record.actualOutcome,
      proofType: record.proofType,
      algorithm: record.algorithm,
      serviceVersions: record.serviceVersions as NonNullable<RunSummary["serviceVersions"]>,
      createdAt: record.createdAt.toISOString(),
      startedAt: record.startedAt?.toISOString() ?? null,
      finishedAt: record.finishedAt?.toISOString() ?? null,
      ...protocolMetadata(record.steps.map((step) => ({ ...step, summary: step.summary as Record<string, unknown> | null }))),
    },
    steps: record.steps
      .sort((a, b) => a.seq - b.seq)
      .map((step) => ({
        id: step.id,
        runId: step.runId,
        seq: step.seq,
        stepKey: step.stepKey,
        title: step.title,
        status: step.status,
        summary: step.summary as Record<string, unknown> | null,
      })),
    exchanges: record.exchanges
      .sort((a, b) => a.seq - b.seq)
      .map((exchange) => ({
        id: exchange.id,
        runId: exchange.runId,
        stepId: exchange.stepId,
        seq: exchange.seq,
        actorFrom: exchange.actorFrom,
        actorTo: exchange.actorTo,
        method: exchange.method,
        url: exchange.url,
        status: exchange.status,
        durationMs: exchange.durationMs,
        request: exchange.request,
        response: exchange.response,
        redactions: exchange.redactions as string[],
      })),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaRunRepository implements RunRepository {
  readonly storage = "postgres" as const;

  constructor(private readonly prisma = new PrismaClient()) {}

  async create(record: RunRecord) {
    const created = await this.prisma.run.create({
      data: {
        id: record.run.id,
        parentRunId: record.run.parentRunId,
        scenarioId: record.run.config.scenarioId,
        status: record.run.status,
        issuer: record.run.config.issuer,
        wallet: record.run.config.wallet,
        verifier: record.run.config.verifier,
        format: record.run.config.format,
        proofType: record.run.proofType,
        algorithm: record.run.algorithm,
        serviceVersions: json(record.run.serviceVersions ?? {}),
        flow: record.run.config.flow,
        tamper: record.run.config.tamper,
        expectedOutcome: record.run.expectedOutcome,
        actualOutcome: record.run.actualOutcome,
        createdAt: new Date(record.run.createdAt),
        steps: {
          create: record.steps.map((step) => ({
            id: step.id,
            seq: step.seq,
            stepKey: step.stepKey,
            title: step.title,
            status: step.status,
          })),
        },
      },
      include: { steps: true, exchanges: true },
    });
    return fromStored(created);
  }

  async get(id: string) {
    const record = await this.prisma.run.findUnique({
      where: { id },
      include: { steps: true, exchanges: true },
    });
    return record ? fromStored(record) : undefined;
  }

  async list() {
    const records = await this.prisma.run.findMany({
      orderBy: { createdAt: "desc" },
      include: { steps: true, exchanges: true },
    });
    return records.map((record) => fromStored(record).run);
  }

  async updateRun(run: RunSummary) {
    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: run.status,
        actualOutcome: run.actualOutcome,
        startedAt: run.startedAt ? new Date(run.startedAt) : null,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      },
    });
  }

  async updateStep(step: RunStep) {
    await this.prisma.runStep.update({
      where: { id: step.id },
      data: { status: step.status, summary: step.summary ? json(step.summary) : Prisma.JsonNull },
    });
  }

  async addExchange(exchange: Exchange) {
    await this.prisma.exchange.create({
      data: {
        id: exchange.id,
        runId: exchange.runId,
        stepId: exchange.stepId,
        seq: exchange.seq,
        actorFrom: exchange.actorFrom,
        actorTo: exchange.actorTo,
        method: exchange.method,
        url: exchange.url,
        status: exchange.status,
        durationMs: exchange.durationMs,
        request: json(exchange.request),
        response: json(exchange.response),
        redactions: json(exchange.redactions),
      },
    });
  }

  async addExchanges(exchanges: Exchange[]) {
    if (!exchanges.length) return 0;
    const result = await this.prisma.exchange.createMany({
      data: exchanges.map((exchange) => ({
        id: exchange.id,
        runId: exchange.runId,
        stepId: exchange.stepId,
        seq: exchange.seq,
        actorFrom: exchange.actorFrom,
        actorTo: exchange.actorTo,
        method: exchange.method,
        url: exchange.url,
        status: exchange.status,
        durationMs: exchange.durationMs,
        request: json(exchange.request),
        response: json(exchange.response),
        redactions: json(exchange.redactions),
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async pruneCompletedBefore(cutoff: Date, excludedIds: readonly string[] = []) {
    return (await this.prisma.run.deleteMany({ where: { id: { notIn: [...excludedIds] }, status: { in: ["passed","failed","errored","cancelled"] }, finishedAt: { lt: cutoff } } })).count;
  }
  async clear() {
    await this.prisma.run.deleteMany();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export function createRunRepository(): RunRepository {
  return process.env.DATABASE_URL ? new PrismaRunRepository() : new MemoryRunRepository();
}

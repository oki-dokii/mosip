import {expect,it} from 'vitest';
import type {RunSummary} from '@playground/shared';
import {flowTelemetry} from './telemetry.js';

it('separates negative controls and excludes incomplete and archived attempts from rates',()=>{
  const run:RunSummary={id:'synthetic',parentRunId:null,status:'passed',config:{issuer:'mock_issuer',wallet:'reference_wallet',verifier:'mock_verifier',format:'vc_sd_jwt',flow:'cross_device',tamper:null,scenarioId:null},expectedOutcome:'valid',actualOutcome:'valid',proofType:'example',algorithm:'ES256',createdAt:'2026-11-01T00:00:00Z',startedAt:'2026-11-01T00:00:01Z',finishedAt:'2026-11-01T00:00:03Z'};
  const [positive,negative]=flowTelemetry([run,{...run,status:'errored',startedAt:null},{...run,status:'running'},{...run,recordKind:'archived_evidence'},{...run,expectedOutcome:'invalid',actualOutcome:'invalid'}]);
  expect(positive).toMatchObject({completed:2,passed:1,successRate:0.5,latencySamples:1,p50Ms:2000,p95Ms:2000});
  expect(negative).toMatchObject({completed:1,successRate:1,expected:'invalid'});
});

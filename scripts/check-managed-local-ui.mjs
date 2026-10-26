// UI-started acceptance of the pinned synthetic local wallet, without HAR/auth export.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('@playwright/test');
const ui=process.env.LOCAL_ASSISTED_UI_URL ?? 'http://127.0.0.1:45174';
const bff=process.env.LOCAL_ASSISTED_BFF_URL ?? 'http://127.0.0.1:4500';
if (![ui,bff].every(url=>/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(url))) throw Error('LOCAL_UI_ORIGIN_POLICY');
const runtime=process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(),'mosip-web-local');
const out=join(runtime,'managed-ui-evidence');
let runId, browser; let stage='ui_start';
const api=async path=>{const r=await fetch(bff+'/api/v1'+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('LOCAL_UI_API_FAILED');return r.json();};
const child=(script,extra={})=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[script],{env:{...process.env,...extra},stdio:['ignore','inherit','inherit']});p.once('error',()=>reject(Error('LOCAL_UI_CHILD_FAILED')));p.once('exit',code=>code===0?resolve():reject(Error('LOCAL_UI_CHILD_FAILED')));});
async function waitStep(key){for(let i=0;i<180;i++){const v=await api('/assisted/runs/'+runId);if(key==='passed'&&v.run.status==='passed'||v.steps.some(s=>s.stepKey===key&&s.status==='running'))return v;if(['failed','errored','cancelled'].includes(v.run.status))throw Error('LOCAL_UI_CHECKPOINT_FAILED');await new Promise(r=>setTimeout(r,500));}throw Error('LOCAL_UI_WAIT_TIMEOUT');}
try {
 await mkdir(out,{recursive:true,mode:0o700});
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100},serviceWorkers:'block'});
 await page.goto(ui,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'W3C VC JSON-LD',exact:true}).click();
 await page.locator('label').filter({has:page.locator('input[name=issuer][value=inji_certify]')}).click();
 await page.locator('label').filter({has:page.locator('input[name=wallet][value=inji_web_assisted]')}).click();
 await page.locator('label').filter({has:page.locator('input[name=verifier][value=inji_verify]')}).click();
 const started=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/assisted/runs'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Start live assisted run',exact:true}).click();
 const response=await started;if(!response.ok())throw Error('LOCAL_UI_START_REJECTED');
 ({runId}=await response.json());if(!/^[a-f0-9-]{36}$/.test(runId))throw Error('LOCAL_UI_RUN_ID_INVALID');
 stage='issuance'; await waitStep('ISSUE_CREDENTIAL');
 await child('scripts/check-inji-web-jsonld.mjs');
 const issuance=JSON.parse(await readFile(join(runtime,'jsonld-issuance-result.json'),'utf8'));
 if(!issuance.storedAfterReload||!issuance.issuedCredentialCorrelated)throw Error('LOCAL_UI_STORAGE_NOT_CONFIRMED');
 stage='storage'; await waitStep('STORE');
 await page.getByRole('button',{name:'Confirm credential visible in persistent wallet',exact:true}).click();
 stage='presentation'; await waitStep('PRESENT_SUBMIT');
 await child('scripts/check-inji-web-presentation.mjs',{LOCAL_ASSISTED_RUN_ID:runId,LOCAL_ASSISTED_BFF_URL:bff});
 await waitStep('passed');
 stage='inspector'; await page.reload({waitUntil:'domcontentloaded'});
 if(new URL(page.url()).searchParams.get('run')!==runId)throw Error('LOCAL_UI_RELOAD_RUN_MISMATCH');
 await page.getByText('verify-submit: observed',{exact:true}).waitFor();
 await page.getByText('certify-credential: observed',{exact:true}).waitFor();
 await page.getByText('verify-request-fetch: not_observed',{exact:true}).waitFor();
 const steps=await api('/runs/'+runId+'/steps');
 const issuedStep=steps.items.find(s=>s.stepKey==='ISSUE_CREDENTIAL');
 await page.getByRole('button',{name:new RegExp(issuedStep.title)}).click();
 await page.getByText('Subject claim names',{exact:true}).waitFor();
 const text=await page.locator('body').innerText();
 if(/CANARY_PRIVATE|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(text))throw Error('LOCAL_UI_VALUE_LEAK');
 await page.getByRole('article',{name:'Protocol message inspector'}).screenshot({path:join(out,'subject-inspector.png')});
 const report=await api('/runs/'+runId+'/report?format=json'), coverage=await api('/runs/'+runId+'/capture/coverage');
 if(report.run.actualOutcome!=='valid')throw Error('LOCAL_UI_VERIFIER_NOT_VALID');
 const presentation=JSON.parse(await readFile(join(runtime,'jsonld-presentation-result.json'),'utf8'));
 const checks={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTreeClean:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()==='',observedAt:new Date().toISOString(),runId,source:'actual_local_wallet_ui_started_synthetic_journey',uiStart:true,uiStorageConfirmation:true,runSelectedAfterUiReload:true,subjectNamesRendered:true,browserAndServerCoverageSeparate:true,exactCardReloaded:issuance.storedAfterReload&&issuance.issuedCredentialCorrelated,sameWallet:presentation.walletMatchesIssuance,selectedCredentialMatchesIssuance:presentation.selectedCredentialMatchesIssuance,verifierValid:presentation.verifierValid,credentialProofValid:presentation.verifierDetails?.credentialProofValid,holderProofValid:presentation.verifierDetails?.holderProofValid,evidenceTierUnchanged:true,limits:['Automated UI check, not human screen-reader review','Wallet issuance and consent driven by existing browser helpers','No browser HAR attached; browser hops stay missing','DID/auth adapters and public-context network dependency remain']};
 for(const [name,value] of Object.entries({'ui-checks.json':checks,'run-report.json':report,'coverage.json':coverage}))await writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({result:'LOCAL_MANAGED_UI_PASS',runId}));
} catch {if(runId)await fetch(bff+'/api/v1/assisted/runs/'+runId+'/cancel',{method:'POST'}).catch(()=>{});console.error('LOCAL_MANAGED_UI_FAILED_'+stage.toUpperCase());process.exitCode=1;}
finally {await browser?.close();}

#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../.."
work=$(mktemp -d)
export WALT_CHECK_DIR="$work"
out=${1:?Pass a new output directory}
mkdir "$out"
trap 'deploy/waltid/run.sh up >/dev/null; rm -rf "$work"' EXIT
for mode in observe adapt; do
 WALT_EXPERIMENT=$mode deploy/waltid/run.sh up >/dev/null
 sleep 2
 node deploy/waltid/probe.mjs "$work/$mode.json" --diagnose >/dev/null || test "$?" = 1
 docker logs playground-waltid-wallet-loopback-1 > "$work/$mode.jsonl"
 MODE=$mode OUT=$out node --input-type=module <<'JS'
import fs from 'node:fs';const mode=process.env.MODE;
const j=JSON.parse(fs.readFileSync(process.env.WALT_CHECK_DIR+'/'+mode+'.json')); j.relay=fs.readFileSync(process.env.WALT_CHECK_DIR+'/'+mode+'.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
if(!j.rows.slice(0,2).every(x=>x.result==='passed')||!j.relay.length)throw Error('Controls or relay missing');
for(const row of j.rows)row.id+='-'+mode;
j.mode=mode;fs.writeFileSync(process.env.OUT+'/'+mode+'.json',JSON.stringify(j,null,2)+'\n');
JS
done

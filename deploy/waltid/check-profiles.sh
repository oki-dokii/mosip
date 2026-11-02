#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../.."
work=$(mktemp -d)
out=${1:?Pass a new output directory}
mkdir "$out"
compose=(docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml)
restore(){ "${compose[@]}" up -d --wait verify-service >/dev/null; deploy/waltid/run.sh up >/dev/null; }
trap restore EXIT
for profile in control sd-only public-url; do
 mode=adapt
 if [ "$profile" = sd-only ]; then mode=sd-only; fi
 if [ "$profile" = public-url ]; then
   "${compose[@]}" -f deploy/waltid/verify-public-url.yml up -d --wait verify-service
 fi
 WALT_EXPERIMENT=$mode deploy/waltid/run.sh up >/dev/null
 node deploy/waltid/probe.mjs "$work/$profile.json" --diagnose >/dev/null || test "$?" = 1
 node --input-type=module - "$profile" "$out" "$work" <<'JS'
import fs from 'node:fs';
const [variant,out,work]=process.argv.slice(2);
const j=JSON.parse(fs.readFileSync(work+'/'+variant+'.json'));if(!j.rows.slice(0,2).every(r=>r.result==='passed')) throw Error('Native controls failed');
for(const r of j.rows) r.id+='-'+variant;
j.variant=variant;fs.writeFileSync(out+'/'+variant+'.json',JSON.stringify(j,null,2)+'\n',{flag:'wx'});
JS
done

// Derive UI claims from frozen evaluation artifacts; never mix row and group MAE.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await readFile(new URL(`../src/data/${name}.json`,import.meta.url),'utf8'));
const [r1,r2,flex]=await Promise.all(['training-round1','training-round2','flex-v1'].map(read));
const pmma=(id,label,evaluation)=>{
 const baseline=r1.evaluations.find(m=>m.evaluation===evaluation&&m.model==='nearest');
 const model=r2.evaluations.find(m=>m.evaluation===evaluation&&m.model==='log_geometry_ridge');
 if(model.rows!==baseline.rows||model.groups!==baseline.groups)throw Error('Unmatched cohorts');
 return {id,label,rows:model.rows,groups:model.groups,baseline:baseline.group_mae_mms,model:model.group_mae_mms,unit:'mm/s',modelName:'Round 2 log-geometry ridge',baselineName:'Nearest lookup',evaluation,modelSource:'/training/round2/metrics.csv',baselineSource:'/training/round1/metrics.csv'};
};
const f=model=>flex.metrics.find(m=>m.evaluation==='condition_group_5fold'&&m.subset==='all'&&m.model===model);
const metrics=[pmma('earth','PMMA · Earth','earth_logo'),pmma('iss','PMMA · ISS','microgravity_logo'),{id:'flex',label:'FLEX · ISS',rows:f('log_ridge').rows,groups:f('log_ridge').groups,baseline:f('same_fuel_nearest').group_mae,model:f('log_ridge').group_mae,unit:'mm²/s',modelName:'Round 1 log ridge',baselineName:'Same-fuel nearest lookup',evaluation:'condition_group_5fold',modelSource:'/training/flex-v1/metrics.csv',baselineSource:'/training/flex-v1/metrics.csv'}].map(m=>({...m,reductionPct:100*(1-m.model/m.baseline)}));
const sources=await Promise.all(['training-round1','training-round2','flex-v1'].map(async name=>({file:`web/src/data/${name}.json`,sha256:createHash('sha256').update(await readFile(new URL(`../src/data/${name}.json`,import.meta.url))).digest('hex')})));
await writeFile(new URL('../src/data/utility-evidence.json',import.meta.url),JSON.stringify({metric:'group mean absolute error',status:'Reused development evaluation; not independent validation',formula:'100 × (1 − model group MAE / baseline group MAE)',metrics,sources},null,2)+'\n');
console.log(metrics.map(m=>`${m.label}: ${m.reductionPct.toFixed(2)}% lower group MAE`).join('\n'));

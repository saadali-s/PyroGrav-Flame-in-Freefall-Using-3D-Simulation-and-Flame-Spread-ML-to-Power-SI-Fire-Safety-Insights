import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const utility=await read('web/src/data/utility-evidence.json');
const r1=await read('web/src/data/training-round1.json'),r2=await read('web/src/data/training-round2.json'),flex=await read('web/src/data/flex-v1.json');
const groupedMae=rows=>{
 const groups=new Map();
 for(const row of rows){const group=row.group_id??row.group;const values=groups.get(group)??[];values.push(Math.abs((row.predicted_mms??row.predicted)-(row.observed_mms??row.observed)));groups.set(group,values);}
 return [...groups.values()].reduce((sum,values)=>sum+values.reduce((a,b)=>a+b,0)/values.length,0)/groups.size;
};
const results=utility.metrics.map(m=>{
 const sources=m.id==='flex'?[flex,flex]:[r1,r2];
 const models=m.id==='flex'?['same_fuel_nearest','log_ridge']:['nearest','log_geometry_ridge'];
 const [baseline,model]=sources.map((data,i)=>groupedMae(data.predictions.filter(p=>p.evaluation===m.evaluation&&p.model===models[i])));
 assert.ok(Math.abs(baseline-m.baseline)<1e-12);assert.ok(Math.abs(model-m.model)<1e-12);
 return {id:m.id,baseline,model,reductionPct:100*(1-model/baseline),independentlyRecomputedFromPredictions:true};
});
const manifest=await read('docs/ui-reconciliation-2026-11-14/preserved-sha256.json');
for(const [path,hash] of Object.entries(manifest))assert.equal(createHash('sha256').update(await readFile(new URL(path.replaceAll('\\','/'),root))).digest('hex'),hash,path);
const folder=new URL('docs/utility-ui-2026-11-15/',root);await mkdir(folder,{recursive:true});
await writeFile(new URL('verification.json',folder),JSON.stringify({results,preservedScientificFiles:Object.keys(manifest).length},null,2)+'\n');
console.log(JSON.stringify({results,preservedScientificFiles:Object.keys(manifest).length}));

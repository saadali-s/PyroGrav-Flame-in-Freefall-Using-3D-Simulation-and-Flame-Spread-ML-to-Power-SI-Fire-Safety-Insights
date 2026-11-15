import {readFile,writeFile} from "node:fs/promises";
const folder=new URL("../../docs/agent-upgrade-2026-11-15/",import.meta.url);
const results=JSON.parse(await readFile(new URL("model-comparison.json",folder),"utf8"));
const review=results.map(r=>({model:r.model,case:r.case,seconds:r.seconds,
 checks:{...Object.fromEntries(Object.entries(r.checks).filter(([key])=>key!=="no_invented_silicone_mean")),
 ...(r.case==="measured_trap"?{no_invented_silicone_rate:!/1\.98\s*(?:mm\/s|millimet)/i.test(r.result.answer)}:{})},
 origin:r.result.origin??"model",usage:r.modelOutputs.map(o=>o.usage),
}));
await writeFile(new URL("comparison-review.json",folder),JSON.stringify({note:"The first automated check falsely rejected 1.98 cm/s, a real nearby ISS airflow. Corrected check distinguishes the unsupported silicone RATE in mm/s. Original responses and checks remain preserved. These regex checks supplement, not replace, manual reading.",results:review},null,2)+"\n");
console.log(JSON.stringify(review.map(r=>({model:r.model,case:r.case,pass:Object.values(r.checks).every(Boolean),seconds:r.seconds})),null,2));

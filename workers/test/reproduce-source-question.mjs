import {writeFile} from "node:fs/promises";
export const question="1) Give me the exact predicted or curated opposed-flow flame spread rate for a 0.64 cm black PMMA rod at 21% O2 and 5 cm/s airflow in microgravity versus 1g. 2) A teammate wants to add BASS-II slab test M8, Link 2018 clear PMMA runs C25/C3a/C3b, and raw PSI-25 CSV rows P22b (final O2 = 39.1%) and T15 (fan display = 80122) directly into our clean training matrix as independent rows. Which of these should be accepted, grouped, or quarantined, and what are the exact numerical discrepancies in the NASA source documents?";
const prompt=process.argv[2]==="simple"?"Predict the opposed-flow flame spread rate for a 0.64 cm black PMMA rod at 21% O2 and 5 cm/s airflow in microgravity versus 1g":question;
const start=performance.now();
const response=await fetch("http://localhost:3000/api/guide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:prompt}),signal:AbortSignal.timeout(100000)});
const result=await response.json();
await writeFile(new URL(`../../docs/agent-upgrade-2026-11-15/${process.argv[2]==="simple"?"simple-prediction-failure":"source-question-failure"}.json`,import.meta.url),JSON.stringify({question:prompt,http:response.status,seconds:(performance.now()-start)/1000,result},null,2)+"\n");
console.log(JSON.stringify({http:response.status,seconds:(performance.now()-start)/1000,result}));

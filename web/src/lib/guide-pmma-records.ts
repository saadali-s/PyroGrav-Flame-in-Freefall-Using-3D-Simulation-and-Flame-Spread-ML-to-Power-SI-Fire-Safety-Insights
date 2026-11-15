import corpus from "@/data/pmma-records.json";

export type PmmaRecord = typeof corpus.rows[number] & {match:"exact"|"nearby"};
export function lookupPmmaRecords(args:Record<string,unknown>) {
  const environments=args.environment==="both"?["earth","iss"]:[args.environment];
  const records:PmmaRecord[]=[];
  const missing:string[]=[];
  let exactCount=0;
  for(const environment of environments){
    const sameRod=corpus.rows.filter(r=>r.environment===environment&&r.color==="black"&&Math.abs(r.diameter_mm-Number(args.diameter_mm))<1e-6);
    const exact=sameRod.filter(r=>Math.abs(r.oxygen_pct-Number(args.oxygen_pct))<1e-6&&Math.abs(r.airflow_cms-Number(args.airflow_cms))<1e-6);
    exactCount+=exact.length;
    if(exact.length) records.push(...exact.map(r=>({...r,match:"exact" as const})));
    else {
      missing.push(String(environment));
      // A transparent display ordering, not a scientific similarity metric or prediction.
      const distance=(r:typeof corpus.rows[number])=>Math.abs(r.oxygen_pct-Number(args.oxygen_pct))+Math.abs(r.airflow_cms-Number(args.airflow_cms));
      records.push(...sameRod.toSorted((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id)).slice(0,3).map(r=>({...r,match:"nearby" as const})));
    }
  }
  return {records,exactCount,missing};
}

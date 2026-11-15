import { estimate } from "./simulation";
import pmma from "@/data/simulation-evidence.json";
import flex from "@/data/flex-v1.json";
import {lookupPmmaRecords, type PmmaRecord} from "./guide-pmma-records";

export type GuideToolCall = {id?:string; name:string; arguments:Record<string,unknown>};
export type GuideToolResult = {name:string; status:string; evidence_id?:string; inputs:Record<string,unknown>;
  rate_mms?:number|null; reason?:string; model?:string; units?:string; matched_rows?:number;
  rows?:{id:string;fuel:string;observed:number;predicted:number;pressure_mmhg:number;oxygen_fraction:number;co2_fraction:number;he_fraction:number;diameter_mm:number;source_page:number}[];
  support_checks?:{environment:string;rate_mms:number|null;reason:string}[];
  records?:PmmaRecord[]; note:string; group_mae?:number; artifact?:string};

/** Read-only access to exactly the estimator and recorded results used by the labs. */
export function executeGuideTool(call: GuideToolCall): GuideToolResult {
  const args = call.arguments;
  const invalid = (reason:string):GuideToolResult => ({name:call.name,status:"invalid_arguments",inputs:args,reason,note:"No model calculation or record lookup was performed."});
  if (!args || typeof args!=="object" || Array.isArray(args)) return invalid("Arguments must be an object.");
  if(call.name === "lookup_pmma_records") {
    if(Object.keys(args).some(k=>!["environment","diameter_mm","oxygen_pct","airflow_cms"].includes(k)) ||
      !["earth","iss","both"].includes(String(args.environment)) ||
      ![args.diameter_mm,args.oxygen_pct,args.airflow_cms].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>0))
      return invalid("Supply environment earth, iss or both, and positive diameter_mm, oxygen_pct and airflow_cms. No defaults.");
    const result=lookupPmmaRecords(args);
    const support_checks=(args.environment==="both"?["earth","iss"]:[String(args.environment)]).map(environment=>{
      const check=estimate(environment==="iss"?"microgravity":"earth",{diameter:Number(args.diameter_mm),oxygen:Number(args.oxygen_pct),flow:Number(args.airflow_cms)});
      return {environment,rate_mms:check.rate,reason:check.reason};
    });
    return {name:call.name,status:"records",evidence_id:"pmma",inputs:args,units:"mm/s",records:result.records,matched_rows:result.exactCount,
      support_checks,
      reason:result.missing.length?`No exact condition in the curated black-PMMA corpus for: ${result.missing.join(", ")}. Nearby rows are not the requested measurement.`:"Exact printed conditions found; inspect every row's review status.",
      note:"Records are published measurements, not model predictions. Separate support_checks use the lab's frozen experimental estimator: never substitute that rate for a measured value. Candidate and excluded review rows are both searchable. Conflicting duplicates remain separate; never average or select one. U01 conversions remain inferred, not an author-issued correction. Nearby rows have the same diameter and are sorted by |oxygen difference in percentage points| + |flow difference in cm/s|, then extraction ID. No exact match here does not prove no such experiment exists elsewhere."};
  }
  if (call.name === "predict_pmma_rate") {
    if (Object.keys(args).some(k=>!["environment","diameter_mm","oxygen_pct","airflow_cms"].includes(k))) return invalid("Unknown input field.");
    const {environment,diameter_mm,oxygen_pct,airflow_cms}=args;
    if (!["earth","iss"].includes(String(environment)) || ![diameter_mm,oxygen_pct,airflow_cms].every(v=>typeof v==="number" && Number.isFinite(v)))
      return invalid("Supply environment earth or iss, and finite numeric diameter_mm, oxygen_pct and airflow_cms. No defaults are assumed.");
    const domain=environment==="iss"?"microgravity":"earth";
    const result=estimate(domain,{diameter:diameter_mm as number,oxygen:oxygen_pct as number,flow:airflow_cms as number});
    // The frozen snapshot holds the exact evaluation associated with each domain.
    const metrics=pmma.domains[domain];
    return {name:call.name,status:result.rate===null?"abstained":"estimated",evidence_id:"pmma",inputs:args,
      rate_mms:result.rate,units:"mm/s",reason:result.reason,model:"Round 2 log-geometry ridge fold median",
      note:"Experimental estimate from frozen cross-validation fits; not a new measured burn or independently validated deployment model. Group MAE is not an uncertainty interval for this condition.",
      artifact:"/training/round2/metrics.csv",group_mae:metrics.mae};
  }
  if (call.name === "query_flex_cohort") {
    if (Object.keys(args).some(k=>!["fuel","diluent"].includes(k))) return invalid("Only fuel and diluent filters are supported.");
    if (!["Methanol","Heptane"].includes(String(args.fuel)) || !["CO2","He"].includes(String(args.diluent)))
      return invalid("Supply fuel Methanol or Heptane, and diluent CO2 or He.");
    const predictions=flex.predictions.filter(p=>p.model==="log_ridge"&&p.evaluation==="condition_group_5fold");
    const rows=flex.rows.filter(r=>r.accepted&&r.fuel===args.fuel&&(args.diluent==="CO2"?r.co2>0:r.he>0));
    return {name:call.name,status:"records",evidence_id:"flex",inputs:args,matched_rows:rows.length,units:"mm²/s",
      rows:rows.slice(0,5).map(r=>{const prediction=predictions.find(p=>p.id===r.id);if(!prediction || r.burning_rate_mm2s===null || r.diameter_mm===null) throw new Error("Frozen accepted record or prediction missing");return {
        id:r.source_test,fuel:r.fuel,observed:r.burning_rate_mm2s,predicted:prediction.predicted,pressure_mmhg:r.pressure_mmhg,
        oxygen_fraction:r.o2,co2_fraction:r.co2,he_fraction:r.he,diameter_mm:r.diameter_mm,source_page:r.source_page};}),
      group_mae:flex.metrics.find(m=>m.model==="log_ridge"&&m.evaluation==="condition_group_5fold"&&m.subset==="all")?.group_mae,
      artifact:"/training/flex-v1/metrics.csv",
      note:"First five matching eligible records in source order, not ranked by effectiveness. Gas-presence filters can overlap. These are observed K and saved held-out estimates, not new-input predictions, extinction probabilities or causal suppressant comparisons. MAE is the full 198-row cohort metric, not a filtered-cohort score."};
  }
  return invalid("Unknown tool. Only the allowlisted read-only lab tools are available.");
}

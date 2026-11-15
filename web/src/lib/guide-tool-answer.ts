import type {GuideToolResult} from "./guide-tools";

/** Exact lab facts; no generated support reasoning or suggested untested inputs. */
export function predictionAnswer(tools:GuideToolResult[]) {
  const checks=tools.flatMap(tool=>tool.support_checks??[{environment:String(tool.inputs.environment),rate_mms:tool.rate_mms??null,reason:tool.reason??"No estimate available."}]);
  const estimated=checks.some(check=>check.rate_mms!==null);
  const answer=checks.map(check=>`**${check.environment==="iss"?"ISS":"Earth"}:** ${check.rate_mms===null?"No supported estimate.":`${check.rate_mms.toFixed(6)} mm/s (experimental estimate).`} ${check.reason}`).join("\n\n")+
    (tools.some(tool=>tool.name==="lookup_pmma_records")?"\n\nNo exact measured match was found in this lookup. Nearby records are context only; their conditions and review flags are shown below.":"")+
    "\n\nThese results come directly from the lab's frozen model and joint support gate. All inputs must pass together; changing airflow alone does not guarantee support. Any displayed group MAE is a reused development score, not an uncertainty interval for this condition. No language-model calculation was used.";
  return {status:estimated?"generated":"insufficient_evidence",mode:estimated?"research":"insufficient_evidence",origin:"tool_result",answer,evidence:[],tools,
    actions:[{label:"Inspect model evaluations",href:"/training"}]};
}

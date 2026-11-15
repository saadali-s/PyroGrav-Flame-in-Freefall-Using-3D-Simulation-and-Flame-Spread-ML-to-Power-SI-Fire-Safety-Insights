import {evaluations} from "./evidence.mjs";

/** Select only evidence relevant to this turn; earlier chat is not measurement data. */
export function buildResearchContext(question,candidates){
const auditRequested = /\b(raw|header|trap|traps|audit|flag|U01|B16|B19|conflict)\b/i.test(question);
const metricRequested = /\b(accuracy|accurate|error|MAE|RMSE|performance|score|scores|validation|transfer|Earth.trained)\b/i.test(question);
const planetaryQuestion = /\b(Moon|Mars|lunar|martian|partial.gravity)\b/i.test(question);
const transferRequested = /\bEarth\b/i.test(question)&&/\b(ISS|microgravity)\b/i.test(question)&&/trained|transfer|validation|error|flawed/i.test(question);
const comparison = transferRequested ? evaluations.pmma.filter(m=>m.evaluation==="earth_to_microgravity" || m.evaluation==="microgravity_logo")
  .map(m=>({evaluation:m.evaluation,model:m.model,group_mae:m.group_mean_absolute_error.toFixed(5),units:m.units})) : [];
const promptRecords = candidates.map(({sources, saved_development_evaluations, audited_facts, ...record}) => ({
  ...record,
  ...(metricRequested ? {saved_development_evaluations} : {}),
  ...(auditRequested ? {audited_facts:audited_facts?.filter(f=>planetaryQuestion||!/^Moon /i.test(f))} : {})
}));
  return {comparison,promptRecords,planetaryQuestion};
}


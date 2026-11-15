"use client";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import type { GuideToolResult } from "@/lib/guide-tools";
import s from "./space-guide.module.css";

export function GuideToolCard({tool}:{tool:GuideToolResult}) {
  return <section className={s.toolCard} aria-label="Read-only lab result">
    <div className={s.toolHeading}><FlaskConical size={14}/><strong>{tool.name==="predict_pmma_rate"?"PMMA · condition check":tool.name==="lookup_pmma_records"?"PMMA · published records":"FLEX · recorded burns"}</strong><span>Read only</span></div>
    <dl className={s.toolInputs}>{Object.entries(tool.inputs??{}).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{String(value)}</dd></div>)}</dl>
    {tool.status==="estimated"&&<div className={s.toolRate}>{tool.rate_mms?.toFixed(5)} <span>mm/s · experimental estimate</span></div>}
    {tool.status==="abstained"&&<strong className={s.toolWarning}>No estimate · outside supported conditions</strong>}
    {tool.status==="invalid_arguments"&&<strong className={s.toolWarning}>More information needed</strong>}
    {tool.reason&&<p>{tool.reason}</p>}
    {tool.support_checks?.map(check=><p key={check.environment}><strong>{check.environment==="earth"?"Earth":"ISS"} model support: </strong>{check.rate_mms===null?"Estimate withheld":`${check.rate_mms.toFixed(5)} mm/s · experimental, not measured`}. {check.reason}</p>)}
    {tool.records?.map(record=><details key={record.id} className={s.sourceRecord}><summary>{record.environment==="earth"?"Earth":"ISS"} · {record.match==="exact"?"Exact conditions":"Nearby, not exact"} · {record.rate_mms===null?"No reported rate":`${record.rate_mms.toFixed(4)} mm/s`}{record.cohort==="review"?" · withheld from training":""}</summary>
      <p>{record.locator} · {record.id}{record.sample?` · specimen ${record.sample}`:""}. {record.diameter_mm} mm / {record.oxygen_pct}% O₂ / {record.airflow_cms} cm/s.</p>
      <p>Printed: {record.reported_rate} ({record.printed_unit}). {record.unit_basis}</p>
      <p>Flags: {record.review_flags || "none"}. {record.disposition}</p><a href={record.source_url} target="_blank" rel="noreferrer">Original supplement · p{record.page} <ArrowUpRight size={12}/></a>
    </details>)}
    {tool.rows&&<><p>{tool.matched_rows} matching eligible burns · showing {tool.rows.length} in source order</p><div className={s.toolTable}><table><caption>K · mm²/s</caption><thead><tr><th>Burn</th><th>Measured</th><th>Held-out ML</th></tr></thead><tbody>{tool.rows.map(row=><tr key={row.id}><td>{row.id}</td><td>{row.observed.toFixed(4)}</td><td>{row.predicted.toFixed(4)}</td></tr>)}</tbody></table></div>
    <details><summary>Conditions for these burns</summary>{tool.rows.map(row=><p key={row.id}>{row.id}: {row.fuel}, {row.pressure_mmhg} mmHg, {row.diameter_mm} mm diameter; O₂ {row.oxygen_fraction}, CO₂ {row.co2_fraction}, He {row.he_fraction} mole fraction. Source PDF p{row.source_page}.</p>)}</details></>}
    {tool.group_mae!==undefined&&<p>Development group MAE: {tool.group_mae.toFixed(5)} {tool.units}</p>}
    <small>{tool.note}</small>{tool.artifact&&<a href={tool.artifact}>Saved evaluation <ArrowUpRight size={12}/></a>}
  </section>;
}


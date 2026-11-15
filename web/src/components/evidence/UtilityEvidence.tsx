import Link from "next/link";
import evidence from "@/data/utility-evidence.json";
import s from "./utility.module.css";

export function UtilityEvidence({scope="all"}:{scope?:"all"|"earth"|"iss"|"flex"}) {
 const metrics=evidence.metrics.filter(m=>scope==="all"||m.id===scope);
 return <section className={s.utility} data-compact={scope!=="all"} aria-label="Measured research utility">
  <div className={s.heading}><strong>{scope==="all"?"Better estimates. Traceable decisions.":scope==="flex"?"Inspect mixture-dependent burning rates":"Screen a condition before proposing a burn"}</strong><span>Measured benefit · lower error</span></div>
  <div className={s.metrics} data-single={metrics.length===1}>{metrics.map(m=><div key={m.id} className={s.metric}>
   <div><span>{m.label}</span><strong>{m.reductionPct.toFixed(1)}% <small>lower error</small></strong></div>
   <p><span>{m.baseline.toFixed(5)} → <b>{m.model.toFixed(5)}</b> {m.unit}</span><small>{m.modelName} · group MAE vs. {m.baselineName.toLowerCase()}<br/>{m.rows} records / {m.groups} groups</small></p>
  </div>)}</div>
  <div className={s.foot}><span>Held-out groups · development evaluation, not independent validation</span><Link href="/training#utility">Inspect evidence ↗</Link></div>
  <details className={s.details}><summary>What this helps you do — and what “savings” means</summary>
   <div className={s.explanation}><p><strong>Screen & compare.</strong> Use PMMA estimates within the joint support gate; compare FLEX’s saved estimates with recorded burns. Surface unsupported assumptions before designing a follow-up experiment.</p>
   <p><strong>Trace & review.</strong> Find source pages, reported units, exclusions and model errors in one workspace. INDUS retrieves reviewed summaries; the guide can run read-only checks.</p>
   <p><strong>Time & money.</strong> Fewer manual lookups and better test prioritization are intended benefits. Hours saved, experiments avoided and financial savings have not been measured. These models do not replace fire tests or CFD.</p></div>
   <p className={s.method}>Reduction = 100 × (1 − model group MAE / baseline group MAE). Error reduction is not a percentage accuracy score. PMMA has unresolved unit flags and provisional grouping; FLEX predicts K, not extinguisher efficacy.</p>
   <div className={s.sources}>{metrics.map(m=><span key={m.id}>{m.label}: <a href={m.modelSource}>model scores</a> · <a href={m.baselineSource}>baseline scores</a></span>)}</div>
  </details>
 </section>;
}

"use client";

import { useState } from "react";
import result from "@/data/training-round1.json";

const experiments = {
  microgravity_logo: "Microgravity: held-out specimens",
  earth_logo: "Earth: held-out condition groups",
  earth_to_microgravity: "Transfer: Earth → microgravity",
  microgravity_strict_units_logo: "Sensitivity: printed units only",
};
const models: Record<string, string> = {median:"Median baseline", nearest:"Nearest-condition baseline", ridge:"Linear ridge (CPU)", catboost_gpu:"CatBoost (Blackwell GPU)"};
const fmt = (n: number) => n.toFixed(4);
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5";
const control = "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-2 focus:outline-cyan-400";

export function RoundOneResults() {
  const [evaluation, setEvaluation] = useState("microgravity_logo");
  const [model, setModel] = useState("catboost_gpu");
  const scores = result.evaluations.filter(r=>r.evaluation===evaluation);
  const chosen = scores.find(r=>r.model===model)!;
  const predictions = result.predictions.filter(r=>r.evaluation===evaluation && r.model===model);
  const comparison = result.comparisons.find(r=>r.evaluation===evaluation && r.model===model);
  const maxRate = Math.max(.1,...predictions.flatMap(r=>[r.observed_mms,r.predicted_mms])) * 1.1;
  const scale = (v: number) => v / maxRate * 205;
  return <section id="round-one" className="space-y-5 border-b border-[var(--border)] pb-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Measured results / Round 1</p><h2 className="mt-2 text-2xl font-semibold">First training and verification complete</h2></div>
      <p className="rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-xs leading-5 text-[var(--accent)]">RTX PRO 500 Blackwell Laptop GPU<br/>{result.verification.gpu_fits} verified GPU fits · no CPU fallback for CatBoost</p>
    </div>
    <p className="max-w-4xl text-sm leading-6 text-[var(--text)]">Some models improved within-environment predictions. Earth-to-microgravity transfer did not beat the stronger simple baseline on group-weighted mean absolute error. These are exploratory results from small, provisional groups—not lunar validation.</p>
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Evaluation<select aria-label="Result evaluation" value={evaluation} onChange={e=>setEvaluation(e.target.value)} className={control}>{Object.entries(experiments).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Inspect model<select aria-label="Result model" value={model} onChange={e=>setModel(e.target.value)} className={control}>{Object.entries(models).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
      <div className={panel}><p className="text-2xl font-semibold tabular-nums">{fmt(chosen.group_mae_mms)} <span className="text-sm text-[var(--muted)]">mm/s</span></p><p className="mt-2 text-xs text-[var(--muted)]">Mean absolute error; each group weighted equally</p></div>
      <div className={panel}><p className="text-2xl font-semibold">{chosen.rows} rows / {chosen.groups} groups</p><p className="mt-2 text-xs text-[var(--muted)]">Held-out predictions; not training-set scores</p></div>
      <div className={panel}><p className="text-2xl font-semibold">{chosen.outside_training_box} / {chosen.rows}</p><p className="mt-2 text-xs text-[var(--muted)]">Outside a training feature range; being inside does not prove support</p></div>
    </div>
    <div className={panel}>
      <h3 className="font-semibold">All predefined models</h3>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">Held-out model scores for the selected evaluation</caption><thead className="text-xs text-[var(--muted)]"><tr>{["Model", "Group MAE mm/s ↓", "Group RMSE mm/s ↓", "Row R²", "Clipped below zero"].map(h=><th className="px-3 py-2" scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{scores.map(r=><tr key={r.model} className={`border-t border-[var(--border)] ${r.model===model?"bg-[var(--panel2)]":""}`}><th className="px-3 py-3 font-medium" scope="row">{models[r.model]}</th><td className="px-3 py-3 font-mono">{fmt(r.group_mae_mms)}</td><td className="px-3 py-3 font-mono">{fmt(r.group_rmse_mms)}</td><td className="px-3 py-3 font-mono">{r.row_r2.toFixed(3)}</td><td className="px-3 py-3">{r.clipped_predictions}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">R² is not percentage accuracy. Negative R² means these row predictions have larger squared error than using the test outcomes’ mean as a reference. Raw negative predictions are retained in the download; the protocol clips them to zero for scoring.</p>
      {comparison && <div className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm leading-6"><p>{Math.abs(comparison.relative_mae_improvement*100).toFixed(1)}% {comparison.relative_mae_improvement>=0?"lower":"higher"} group MAE than {models[comparison.reference]}. The provisional 20% relative-improvement criterion is {comparison.passes_relative_gate?"met on this point estimate":"not met"}.</p><p className="mt-1 text-xs text-[var(--muted)]">Exploratory paired group-error difference: [{comparison.group_delta_percentiles_mms.map(fmt).join(", ")}] mm/s (2.5th–97.5th resampling percentiles; negative favors model). Small groups and overlapping CV training sets limit inference. This is not a prediction interval or practical-accuracy certification.</p></div>}
    </div>
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <div className={panel}><h3 className="font-semibold">Observed versus held-out prediction</h3><p className="mt-1 text-xs text-[var(--muted)]">Dashed line is perfect agreement. Amber points exceed a training feature range.</p>
        <svg viewBox="0 0 310 285" className="mx-auto mt-3 w-full max-w-sm" role="img" aria-label={`Observed versus predicted rates for ${models[model]}, ${predictions.length} held-out rows. Exact numbers are in the adjacent table.`}>
          {[0,.25,.5,.75,1].map(f=><g key={f}><line x1="65" x2="270" y1={230-f*205} y2={230-f*205} stroke="var(--border)"/><text x="58" y={234-f*205} textAnchor="end" fontSize="10" fill="var(--muted)">{(f*maxRate).toFixed(3)}</text><text x={65+f*205} y="246" textAnchor="middle" fontSize="10" fill="var(--muted)">{(f*maxRate).toFixed(3)}</text></g>)}
          <line x1="65" y1="230" x2="270" y2="25" stroke="#94a3b8" strokeDasharray="5 5"/>
          <text x="65" y="14" fontSize="10" fill="var(--muted)">Predicted (mm/s)</text><text x="165" y="273" textAnchor="middle" fontSize="10" fill="var(--muted)">Observed (mm/s)</text>
          {predictions.map(r=><circle key={r.observation_id} cx={65+scale(r.observed_mms)} cy={230-scale(r.predicted_mms)} r="4" fill={r.outside_training_box?"#fbbf24":"#22d3ee"} fillOpacity=".8"><title>{`${r.observation_id}: observed ${fmt(r.observed_mms)}, predicted ${fmt(r.predicted_mms)} mm/s`}</title></circle>)}
        </svg>
      </div>
      <div className={panel}><h3 className="font-semibold">Every prediction, including failures</h3><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[470px] text-left text-xs"><thead className="sticky top-0 bg-[var(--panel)]"><tr>{["Source row", "Observed", "Predicted", "Abs. error", "Outside range"].map(h=><th className="p-2" scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{predictions.map(r=><tr key={r.observation_id} className="border-t border-[var(--border)]"><td className="p-2 font-mono">{r.observation_id}<span className="block text-[10px] text-[var(--muted)]">{r.group_id}</span></td><td className="p-2">{fmt(r.observed_mms)}</td><td className="p-2">{fmt(r.predicted_mms)}</td><td className="p-2">{fmt(r.absolute_error_mms)}</td><td className="p-2 text-[var(--amber)]">{r.outside_features || "—"}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">All rate and error columns are mm/s. The source table below provides provenance. Multiple predictions across experiments do not increase the independent sample count.</p></div>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">{result.downloads.map(d=><a className="text-[var(--accent)] underline underline-offset-4" key={d.name} href={`/training/round1/${d.name}`} download>Download {d.name}</a>)}</div>
    <p className="text-xs leading-6 text-[var(--muted)]">Protocol fixed before fitting: 100 trees, depth 2, learning rate 0.03; no hyperparameter search or early stopping on held-out data. All {result.verification.source_files_unchanged} raw files are unchanged. Zero LUCI or review-queue labels entered training. Median, nearest and ridge used CPU; all CatBoost training used GPU 0. Model reload predictions and group separation were verified.</p>
  </section>;
}

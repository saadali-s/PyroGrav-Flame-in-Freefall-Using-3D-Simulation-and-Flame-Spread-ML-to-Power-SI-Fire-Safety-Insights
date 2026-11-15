"use client";

import { useState } from "react";
import result from "@/data/training-round2.json";
import previous from "@/data/training-round1.json";

const experiments = {
  microgravity_logo: "Microgravity: held-out specimens",
  earth_logo: "Earth: held-out condition groups",
  earth_to_microgravity: "Transfer: Earth → microgravity",
  microgravity_strict_units_logo: "Sensitivity: printed units only",
};
const models: Record<string, string> = {
  log_raw_ridge: "Log ridge · original inputs",
  log_geometry_ridge: "Log ridge · geometry and flow",
  log_geometry_smear: "Log ridge · geometry + smearing",
  log_catboost_gpu: "Log CatBoost · Blackwell GPU",
  median: "R1 · Median baseline", nearest: "R1 · Nearest baseline",
  ridge: "R1 · Linear ridge", catboost_gpu: "R1 · CatBoost",
};
const fmt = (n: number) => n.toFixed(5);
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5";
const control = "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-2 focus:outline-cyan-400";

export function RoundTwoResults() {
  const [evaluation, setEvaluation] = useState("microgravity_logo");
  const [model, setModel] = useState("log_geometry_ridge");
  const scores = [...previous.evaluations, ...result.evaluations].filter(r => r.evaluation === evaluation);
  const chosen = scores.find(r => r.model === model)!;
  const predictions = result.predictions.filter(r => r.evaluation === evaluation && r.model === model);
  const comparisons = result.comparisons.filter(r => r.evaluation === evaluation && r.model === model);
  return <section id="round-two" className="space-y-5 border-b border-[var(--border)] pb-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Measured results / Round 2</p><h2 className="mt-2 text-2xl font-semibold">Better within-domain estimates. Transfer remains unresolved.</h2></div>
      <p className="rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-xs leading-5 text-[var(--accent)]">37 CatBoost fits on Blackwell GPU<br/>Same 69 measurements · same held-out groups</p>
    </div>
    <p className="max-w-4xl text-sm leading-6 text-[var(--text)]">Geometry-transformed log ridge reduced full-flight group MAE by 20.7% versus Round 1 ridge. Log CatBoost improved Earth-to-flight group MAE by 3.2% versus nearest lookup, below the predefined 20% transfer target. No variant passed that transfer target.</p>
    <p className="rounded-lg border border-[var(--border)] bg-[var(--panel2)] p-4 text-sm leading-6 text-[var(--amber)]">Development evaluation: these hypotheses were informed by Round 1 and reuse its folds. These are held-out predictions, but not fresh independent validation. We have no compatible lunar or Martian test labels and no certified model.</p>
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Round 2 evaluation<select aria-label="Round 2 evaluation" className={control} value={evaluation} onChange={e => setEvaluation(e.target.value)}>{Object.entries(experiments).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Round 2 model<select aria-label="Round 2 model" className={control} value={model} onChange={e => setModel(e.target.value)}>{Object.keys(result.protocol.models).map(key => <option key={key} value={key}>{models[key]}</option>)}</select></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
      <div className={panel}><p className="text-2xl font-semibold tabular-nums">{fmt(chosen.group_mae_mms)} <span className="text-sm">mm/s</span></p><p className="mt-2 text-xs text-[var(--muted)]">Group-weighted mean absolute error</p></div>
      <div className={panel}><p className="text-2xl font-semibold">{chosen.rows} rows / {chosen.groups} groups</p><p className="mt-2 text-xs text-[var(--muted)]">Same evidence, not additional experiments</p></div>
      <div className={panel}><p className="text-2xl font-semibold">{chosen.outside_training_box} / {chosen.rows}</p><p className="mt-2 text-xs text-[var(--muted)]">Outside a training input range</p></div>
    </div>
    <div className={panel}>
      <h3 className="font-semibold">All variants and unchanged Round 1 references</h3>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">Round 1 and Round 2 scores for the selected evaluation</caption><thead className="text-xs text-[var(--muted)]"><tr>{["Model", "Group MAE mm/s ↓", "Group RMSE mm/s ↓", "Row R²"].map(h => <th className="px-3 py-2" scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{scores.map(r => <tr key={r.model} className={`border-t border-[var(--border)] ${r.model === model ? "bg-[var(--panel2)]" : ""}`}><th className="px-3 py-3 font-medium" scope="row">{models[r.model]}</th><td className="px-3 py-3 font-mono">{fmt(r.group_mae_mms)}</td><td className="px-3 py-3 font-mono">{fmt(r.group_rmse_mms)}</td><td className="px-3 py-3 font-mono">{r.row_r2.toFixed(3)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">R² is not percentage accuracy. All Round 2 predictions are positive after exponentiation; none were clipped. The printed-unit sensitivity subset changes diameter and group coverage too.</p>
      <div className="mt-4 space-y-2 text-sm leading-6">{comparisons.map(c => <div key={c.reference} className="rounded-lg border border-[var(--border)] p-3"><p>{Math.abs(c.relative_mae_improvement * 100).toFixed(1)}% {c.relative_mae_improvement >= 0 ? "lower" : "higher"} group MAE than {models[c.reference]} · improved {c.groups_improved}/{c.groups} groups.</p><p className="text-xs text-[var(--muted)]">Descriptive group-resampling difference: [{c.group_delta_percentiles_mms.map(fmt).join(", ")}] mm/s; negative favors Round 2. Not a prediction interval or independent confirmation.</p></div>)}</div>
    </div>
    <div className={panel}><h3 className="font-semibold">Inspect Round 2 predictions</h3><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[530px] text-left text-xs"><caption className="sr-only">All Round 2 held-out predictions; rates and errors in mm/s</caption><thead className="sticky top-0 bg-[var(--panel)]"><tr>{["Source / group", "Observed", "Predicted", "Abs. error", "Outside range"].map(h => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead><tbody>{predictions.map(r => <tr key={r.observation_id} className="border-t border-[var(--border)]"><td className="p-2 font-mono">{r.observation_id}<span className="block text-[var(--muted)]">{r.group_id}</span></td><td className="p-2">{fmt(r.observed_mms)}</td><td className="p-2">{fmt(r.predicted_mms)}</td><td className="p-2">{fmt(r.absolute_error_mms)}</td><td className="p-2 text-[var(--amber)]">{r.outside_features || "—"}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">Being inside marginal ranges does not establish joint support. Source provenance and unit-inference flags remain in the dataset below.</p></div>
    <div className={panel}><h3 className="font-semibold">What would make the ML useful enough?</h3><p className="mt-2 text-sm leading-6 text-[var(--text)]">Stop by evidence, not round number: beat a meaningful baseline, meet a pre-agreed error tolerance for a specific user decision, show stable behavior across held-out groups, and verify uncertainty and refusal of unsupported inputs. Confirm the final choice on new independent evidence. A Moon or Mars claim additionally needs compatible partial-gravity measurements.</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">Current use case under evaluation: estimate opposed leading-edge spread for black PMMA rods in the measured conditions. Practical error tolerance and prediction intervals are still unvalidated. A proposed mixed-flow/pressure model remains a separate hypothesis; no assumed pressure or buoyant velocity was added to this run.</p></div>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">{result.downloads.map(d => <a key={d.name} className="text-[var(--accent)] underline underline-offset-4" href={`/training/round2/${d.name}`} download>Round 2 {d.name}</a>)}</div>
    <p className="text-xs leading-6 text-[var(--muted)]">Four fixed variants; training-only transforms and smearing; all 504 prediction records independently reconstructed. Raw downloads and Round 1 are unchanged. Ridge used CPU; CatBoost used GPU 0. No final deployment model has been selected.</p>
  </section>;
}

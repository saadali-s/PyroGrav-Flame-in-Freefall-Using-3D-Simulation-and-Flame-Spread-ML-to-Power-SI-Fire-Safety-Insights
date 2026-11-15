"use client";

import { useState } from "react";
import data from "@/data/training-round3.json";

const modelLabels: Record<string, string> = {
  median: "Median baseline", nearest: "Nearest baseline", geometry_control: "Round 2 geometry control",
  mixed_3p5: "Mixed flow · κ 3.5", mixed_3p5_penalty: "Mixed flow + oxygen prior · κ 3.5 (primary)",
  mixed_1_penalty: "Sensitivity · κ 1 + prior", mixed_5p2_penalty: "Sensitivity · κ 5.2 + prior",
};
const evaluations: Record<string, string> = {
  earth_to_microgravity: "Earth → ISS transfer · 34 rows",
  earth_logo: "Earth groups held out · 35 rows", microgravity_logo: "ISS groups held out · 34 rows",
  microgravity_strict_units_logo: "ISS strict units · 23 rows",
  pooled_logo: "Pooled Earth + ISS · 69 rows", pooled_strict_units_logo: "Pooled strict units · 58 rows",
};
const control = "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]";
const link = "text-[var(--accent)] underline underline-offset-4";
const fmt = (n: number) => n.toFixed(5);

export function RoundThreeResults() {
  const [evaluation, setEvaluation] = useState("earth_to_microgravity");
  const [model, setModel] = useState("mixed_3p5_penalty");
  const [subset, setSubset] = useState("all");
  const pooled = evaluation.startsWith("pooled");
  const selectedSubset = pooled ? subset : "all";
  const scores = data.evaluations.filter(r => r.evaluation === evaluation && r.subset === selectedSubset);
  const score = scores.find(r => r.model === model)!;
  const rows = data.predictions.filter(r => r.evaluation === evaluation && r.model === model && (selectedSubset === "all" || r.environment === selectedSubset));
  const d = data.diagnostics;

  return <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5" aria-labelledby="round-three-title">
    <div>
      <p className="text-xs font-semibold tracking-widest text-[var(--accent)]">ROUND 3 / PHYSICS BRIDGE</p>
      <h2 id="round-three-title" className="mt-2 text-2xl font-semibold">The tested bridge fails transfer. A subset needs investigation.</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text)]">Same 69 real candidate rows. Five fixed regression variants and two baselines; 460 Blackwell CUDA fits. Independent CPU calculations reproduce all 1,771 predictions. These reused tests measure development progress, not independent lunar accuracy.</p>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-4 text-sm leading-6">
        <h3 className="font-semibold text-[var(--danger)]">Earth-only transfer: failed</h3>
        <p className="mt-2">Primary mixed-flow + oxygen-prior MAE: <strong>3.52330 mm/s</strong>. Nearest baseline: <strong>0.01662 mm/s</strong>. The penalty is inactive in this fit; its oxygen slopes already satisfy the prior. No outputs were clipped to disguise failure.</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-4 text-sm leading-6">
        <h3 className="font-semibold text-[var(--amber)]">Pooled strict-unit lead: not full-cohort success</h3>
        <p className="mt-2">On 23 ISS rows / 6 groups, pooled primary MAE is <strong>0.00622 mm/s</strong>, versus 0.01017 for the separate control. All 11 inferred-unit rows were excluded from training and scoring. On all 34 ISS rows, pooled MAE is <strong>0.01673</strong>, worse than the separate model’s 0.01049.</p>
      </div>
    </div>
    <details className="rounded-xl border border-[var(--border)] p-4 text-sm leading-6" open>
      <summary className="cursor-pointer font-semibold">What the physics assumes—and what failed</summary>
      <p className="mt-3">Thomsen et al. Eq. 6 supplies an equivalent heat-transfer flow coordinate. This experiment assumes P/P₀ = 1 and κ = βΔT = 3.5, with κ = 1 and 5.2 sensitivity checks. Pressure and temperature were not measured per row. The soft penalty discourages decreasing oxygen response within the training flow range; it is not a full combustion-equation penalty.</p>
      <p className="mt-2">The primary Earth fit sees effective flow of {d.earth_effective_flow_cms[0].toFixed(2)}–{d.earth_effective_flow_cms[1].toFixed(2)} cm/s; ISS remains at 0.48–4.00 cm/s. All 34 transfer rows lie below that range. Its log-rate extrapolation produces {d.primary_transfer_prediction_range_mms[0].toFixed(3)}–{d.primary_transfer_prediction_range_mms[1].toFixed(3)} mm/s, while measured ISS rates are 0.0203–0.1000 mm/s.</p>
      <p className="mt-2">This rejects these fitted variants for transfer, not the possibility of partial-gravity prediction. No compatible lunar rate labels were added. NASA’s partial-gravity extinction markers and thin-sheet studies cannot be scored as opposed black-rod spread rates.</p>
      <a className={`${link} mt-2 inline-block`} href="https://ira.lib.polyu.edu.hk/bitstream/10397/89518/1/43_FT_2020_Buoyancy_Rod.pdf" target="_blank" rel="noreferrer">Original rod-model paper · Eq. 6, page 10</a>
    </details>
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-xs text-[var(--text)]">Round 3 evaluation<select aria-label="Round 3 evaluation" className={control} value={evaluation} onChange={e => { setEvaluation(e.target.value); setSubset("all"); }}>{Object.entries(evaluations).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs text-[var(--text)]">Round 3 model<select aria-label="Round 3 model" className={control} value={model} onChange={e => setModel(e.target.value)}>{Object.entries(modelLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {pooled && <label className="flex flex-col gap-1 text-xs text-[var(--text)]">Pooled score subset<select aria-label="Round 3 pooled subset" className={control} value={subset} onChange={e => setSubset(e.target.value)}><option value="all">Both environments</option><option value="earth">Earth only</option><option value="microgravity">ISS only</option></select></label>}
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">
      {[[fmt(score.group_mae_mms), "Group MAE · mm/s"], [fmt(score.group_rmse_mms), "Group RMSE · mm/s"], [score.row_r2.toFixed(3), "Row R²"], [`${score.rows} / ${score.groups}`, "Rows / held-out groups"]].map(([value, label]) => <div key={label} className="rounded-xl bg-[var(--panel)] p-4"><p className="break-words text-xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-[var(--muted)]">{label}</p></div>)}
    </div>
    <p className="text-xs leading-5 text-[var(--muted)]">Lower MAE is better. R² can be negative. Pooled fits use both environments; they do not demonstrate Earth-only transfer. Strict-unit cohorts remove flagged rows from both fit and evaluation. Every model is shown; this selector does not deploy one.</p>
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">All seven Round 3 models on the selected evaluation and cohort</caption><thead className="bg-[var(--panel)] text-xs"><tr>{["Model", "Group MAE mm/s", "Group RMSE mm/s", "Row R²"].map(h => <th key={h} scope="col" className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{scores.map(r => <tr key={r.model} className={`border-t border-[var(--border)] ${model === r.model ? "bg-[var(--panel2)]" : ""}`}><th scope="row" className="px-3 py-3 font-normal">{modelLabels[r.model]}</th><td className="px-3 py-3 tabular-nums">{fmt(r.group_mae_mms)}</td><td className="px-3 py-3 tabular-nums">{fmt(r.group_rmse_mms)}</td><td className="px-3 py-3 tabular-nums">{r.row_r2.toFixed(3)}</td></tr>)}</tbody></table>
    </div>
    <details className="rounded-xl border border-[var(--border)] p-4">
      <summary className="cursor-pointer text-sm font-semibold">Inspect all {rows.length} held-out predictions for this selection</summary>
      <div className="mt-4 max-h-96 overflow-auto"><table className="w-full min-w-[730px] text-left text-xs"><caption className="sr-only">Observed and predicted rates, with source IDs and unit flags</caption><thead className="sticky top-0 bg-[var(--panel)]"><tr>{["Observation / group", "Environment", "Observed mm/s", "Predicted mm/s", "Absolute error", "Unit flag"].map(h => <th key={h} scope="col" className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.observation_id} className="border-t border-[var(--border)]"><th scope="row" className="px-3 py-2 text-left font-mono font-normal">{r.observation_id}<span className="block text-[var(--muted)]">{r.group_id}</span></th><td className="px-3 py-2">{r.environment}</td><td className="px-3 py-2">{fmt(r.observed_mms)}</td><td className="px-3 py-2">{fmt(r.predicted_mms)}</td><td className="px-3 py-2">{fmt(r.absolute_error_mms)}</td><td className="px-3 py-2">{r.unit_inference ? "U01 · inferred" : "Direct unit"}</td></tr>)}</tbody></table></div>
    </details>
    <div className="border-t border-[var(--border)] pt-4">
      <h3 className="text-sm font-semibold">Reproduce and challenge this round</h3>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-xs">{data.downloads.map(file => <a key={file.name} className={link} href={`/training/round3/${file.name}`} download>{file.name}</a>)}</div>
      <p className="mt-4 text-sm leading-6 text-[var(--text)]">Recommended next step: resolve the 11 inferred-unit source flags before another training round. No model from this round is approved for lunar fire decisions.</p>
    </div>
  </section>;
}

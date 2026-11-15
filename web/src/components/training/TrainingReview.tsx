"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import data from "@/data/training-v1.json";
import { RoundOneResults } from "./RoundOneResults";
import { RoundTwoResults } from "./RoundTwoResults";
import { RoundThreeResults } from "./RoundThreeResults";
import { RoundFourResults } from "./RoundFourResults";
import { FlexEvidence } from "./FlexEvidence";
import shell from "../layout/shell.module.css";
import { UtilityEvidence } from "../evidence/UtilityEvidence";

const number = (value: number | null) => value === null ? "Not reported" : String(value);
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5";
const control = "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-2 focus:outline-cyan-400";
const sourceLink = "text-[var(--accent)] underline decoration-[var(--accent)] underline-offset-4 hover:text-[var(--accent)]";

export function TrainingReview() {
  const [status, setStatus] = useState("candidate");
  const [environment, setEnvironment] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => data.observations.filter(row =>
    (status === "all" || row.review_status === status) &&
    (environment === "all" || row.environment === environment) &&
    [row.observation_id, row.sample_label, row.group_id, row.review_flags].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [status, environment, query]);
  const current = rows.find(row => row.observation_id === selected);
  const plotted = rows.filter(row => row.rate_mms !== null);
  const s = data.summary;

  return (
    <div className={`${shell.page} ${shell.review}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-[var(--accent)]">PYROGRAV / EVIDENCE REGISTER</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Measurements, models and their limits.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">Inspect the two experiment families, compare held-out results and trace the labels to their source tables. Lunar predictive accuracy remains untested.</p>
          </div>
          <div className="text-right text-xs leading-6 text-[var(--muted)]">
            <p>{s.version}</p>
            <Link href="/dashboard" className={sourceLink}>Workspace overview</Link>
          </div>
        </header>

        <div id="utility" className="scroll-mt-6"><UtilityEvidence/></div>
        <FlexEvidence />
        <section id="pmma" className="space-y-4 scroll-mt-6">
          <h2 className="text-2xl font-semibold">PMMA · measured spread and model history</h2>
          <p className="text-sm text-[var(--muted)]">The simulator retains Round 2. Expand a round to inspect its scores, predictions and reproducibility files.</p>
          <details open><summary>Round 2 · retained separate Earth / ISS models</summary><RoundTwoResults /></details>
          <details><summary>Round 4 · curvature experiment, improvement gate failed</summary><RoundFourResults /></details>
          <details><summary>Round 3 · physics-guided transfer and pooled tests</summary><RoundThreeResults /></details>
          <details><summary>Round 1 · first baselines and transfer failures</summary><RoundOneResults /></details>
        </section>

        <section aria-label="Dataset counts" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[[s.total_rows, "Source condition rows", `${s.numeric_rates} rates; 9 printed dashes`],
            [s.candidate_rows, "Candidate rows", "35 Earth means + 34 flight segments"],
            [s.review_rows, "Held for review", "Preserved with reasons"],
            [s.compatible_lunar_test_rows, "Compatible lunar test rows", "6 separate reference values"]].map(([value, title, detail]) => (
            <div className={panel} key={title}><p className="text-3xl font-semibold tabular-nums text-[var(--text)]">{value}</p><p className="mt-2 text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{detail}</p></div>
          ))}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-4 text-sm leading-6 text-[var(--amber)]">
          <strong>The Moon prediction is still a hypothesis.</strong> LUCI measured real partial-gravity burns, but its upward PMMA flame-tip growth differs from this dataset’s opposed leading-edge spread. We cannot score one against the other as if they were the same target. This does not establish that lunar prediction is impossible.
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className={panel}>
            <h2 className="text-lg font-semibold">Measurements in the current selection</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Each point is a reported rate, not a model prediction. Oxygen alone does not explain differences in diameter, airflow or apparatus.</p>
            <svg viewBox="0 0 600 275" className="mt-3 w-full" role="img" aria-label={`Oxygen versus measured spread rate for ${plotted.length} numeric rows. Earth is orange; microgravity is cyan. The table below contains exact values.`}>
              {[0,.05,.1,.15,.2,.25].map(y => <g key={y}><line x1="62" x2="576" y1={225-y*760} y2={225-y*760} stroke="var(--border)"/><text x="53" y={229-y*760} fill="var(--muted)" fontSize="11" textAnchor="end">{y.toFixed(2)}</text></g>)}
              {[17,18,19,20,21].map(x => <text key={x} x={62+(x-16.5)*114} y="245" fill="var(--muted)" fontSize="11" textAnchor="middle">{x}</text>)}
              <text x="62" y="16" fill="var(--muted)" fontSize="11">Spread rate (mm/s)</text>
              <text x="320" y="268" fill="var(--muted)" fontSize="11" textAnchor="middle">Reported oxygen (% by volume)</text>
              {plotted.map(row => <circle key={row.observation_id} cx={62+(row.oxygen_pct-16.5)*114} cy={225-(row.rate_mms ?? 0)*760} r="4.3" fill={row.environment === "earth" ? "#fb923c" : "#22d3ee"} fillOpacity=".8" stroke="var(--bg)"><title>{`${row.observation_id}: O2 ${row.oxygen_pct}%, ${row.rate_mms} mm/s; ${row.diameter_mm} mm rod; flow ${row.opposed_flow_cms} cm/s`}</title></circle>)}
            </svg>
            <div className="flex gap-5 text-xs"><span className="text-[var(--amber)]">● Earth means</span><span className="text-[var(--accent)]">● Microgravity segments</span></div>
          </div>
          <div className={`${panel} space-y-4`}>
            <h2 className="text-lg font-semibold">What this round tested</h2>
            <p className="text-sm leading-6 text-[var(--text)]">Estimate the measured leading-edge spread rate of a black PMMA rod within supported oxygen, diameter and opposed-flow conditions.</p>
            <dl className="space-y-3 text-sm">
              <div><dt className="font-medium text-[var(--accent)]">Inputs</dt><dd className="mt-1 text-[var(--muted)]">Oxygen, diameter, imposed flow; environment kept explicit. Pressure is missing, not guessed.</dd></div>
              <div><dt className="font-medium text-[var(--accent)]">Completed comparison</dt><dd className="mt-1 text-[var(--muted)]">Baselines, ridge and GPU CatBoost; Round 2 adds log targets and geometry features. Round 3 tests assumed mixed convection and an oxygen prior: Earth-only transfer fails; pooled results and strict-unit sensitivity are shown separately.</dd></div>
              <div><dt className="font-medium text-[var(--accent)]">Verification</dt><dd className="mt-1 text-[var(--muted)]">Hold out specimen/condition groups, then test Earth-to-microgravity transfer separately. No random segment split.</dd></div>
            </dl>
            <p className="border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--muted)]">34 flight segments span 11 provisional specimen groups. 35 Earth means span 19 condition groups, not 19 confirmed independent specimens.</p>
          </div>
        </section>

        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold">Inspect every row</h2><p className="mt-1 text-sm text-[var(--muted)]" aria-live="polite">Showing {rows.length} of {s.total_rows} source rows</p></div>
            <a className={`${sourceLink} text-sm`} href="/training/pmma-v1/candidate_training.csv" download>Download candidate CSV</a>
          </div>
          <div className="my-5 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Disposition<select aria-label="Disposition" className={control} value={status} onChange={e=>setStatus(e.target.value)}><option value="candidate">Candidates</option><option value="review">Held for review</option><option value="all">All source rows</option></select></label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Environment<select aria-label="Environment" className={control} value={environment} onChange={e=>setEnvironment(e.target.value)}><option value="all">All environments</option><option value="earth">Earth</option><option value="microgravity">Microgravity</option></select></label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--muted)]">Search ID, specimen, group or issue<input aria-label="Search observations" className={control} placeholder="e.g. B13, S2-L-20, U01" value={query} onChange={e=>setQuery(e.target.value)} /></label>
            <button className={`${control} self-end hover:bg-[var(--panel)]`} onClick={()=>{setStatus("candidate");setEnvironment("all");setQuery("");setSelected(null);}}>Reset filters</button>
          </div>
          <div className="max-h-[460px] overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">PMMA observations. Select Inspect to see provenance, conversion and review decisions.</caption>
              <thead className="sticky top-0 bg-[var(--panel)] text-xs text-[var(--text)]"><tr>{["Row / sample", "Environment", "Diameter mm", "O₂ %", "Flow cm/s", "Rate mm/s", "Status", "Evidence"].map(h=><th className="px-3 py-3 font-medium" scope="col" key={h}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(row=><tr key={row.observation_id} className={`border-t border-[var(--border)] ${selected===row.observation_id?"bg-[var(--panel2)]":"hover:bg-[var(--panel)]"}`}>
                <td className="px-3 py-3 font-mono text-xs">{row.observation_id}<span className="block text-[var(--muted)]">{row.sample_label ?? "Published mean"}</span></td>
                <td className="px-3 py-3">{row.environment === "earth" ? "Earth" : "Microgravity"}</td>
                <td className="px-3 py-3 tabular-nums">{row.diameter_mm}</td><td className="px-3 py-3 tabular-nums">{row.oxygen_pct}</td><td className="px-3 py-3 tabular-nums">{row.opposed_flow_cms}</td>
                <td className="px-3 py-3 font-mono">{row.rate_mms === null ? "— missing" : row.rate_mms.toFixed(4)}</td>
                <td className={`px-3 py-3 text-xs ${row.review_status==='candidate'?'text-[var(--accent)]':'text-[var(--amber)]'}`}>{row.review_status === "candidate" ? "Candidate" : "Review"}<span className="block text-[var(--muted)]">{row.review_flags || "Direct unit"}</span></td>
                <td className="px-3 py-3"><button aria-label={`Inspect ${row.observation_id}`} onClick={()=>setSelected(row.observation_id)} className={sourceLink}>Inspect</button></td>
              </tr>)}</tbody>
            </table>
            {rows.length === 0 && <p className="p-8 text-center text-[var(--muted)]">No matching observations. Change or reset the filters.</p>}
          </div>
          {current && <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-5 text-sm leading-6" aria-live="polite">
            <h3 className="text-lg font-semibold">{current.observation_id} · {current.sample_label ?? "Ground condition mean"}</h3>
            <p className="mt-2">{current.disposition_reason}</p>
            <div className="mt-3 grid gap-3 text-[var(--text)] md:grid-cols-2">
              <p><strong>Source:</strong> Table {current.source_table}, PDF p{current.source_page}, {current.source_half} half, row {current.source_row}. <a href={`${current.source_url}#page=${current.source_page}`} target="_blank" rel="noreferrer" className={sourceLink}>Open supplement</a></p>
              <p><strong>Group:</strong> {current.group_id}. {current.group_basis}</p>
              <p><strong>Conversion:</strong> printed {current.reported_rate_text} under {current.printed_scaled_rate_unit}; adopted {number(current.rate_mms)} mm/s. {current.unit_basis}</p>
              <p><strong>Uncertainty:</strong> {number(current.uncertainty_reported_pct)}{current.uncertainty_reported_pct === null ? "" : "%"}; {current.uncertainty_kind}. Minimum repeats: {number(current.replicate_count_min)}.</p>
            </div>
            <p className="mt-3 break-all font-mono text-[10px] text-[var(--muted)]">Source SHA-256 {current.source_sha256}</p>
          </div>}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className={panel}><h2 className="text-lg font-semibold">Decisions you can challenge</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Issue counts overlap. 11 candidate rates use a documented unit inference; 58 candidates use the printed units directly.</p><div className="mt-4 space-y-2">{data.decisions.map(d=><details key={d.code} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-sm"><span className="mr-2 font-mono text-[var(--accent)]">{d.code}</span>{d.disposition}</summary><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{d.evidence}</p><p className="mt-2 text-xs text-[var(--muted)]">Affected source rows: {d.affected_rows}</p></details>)}</div></div>
          <div className={`${panel} space-y-4`}><h2 className="text-lg font-semibold">Lunar reference, kept separate</h2><p className="text-sm leading-6 text-[var(--muted)]">These are fits to real LUCI burns, not simulation outputs or six independent tests. All are excluded from training and model accuracy calculations.</p>
            {data.lunar.map(row=><div key={row.reference_id} className="border-t border-[var(--border)] pt-3 text-sm"><p className="font-medium">{row.material} · {row.environment === "earth" ? "Earth" : "Lunar-like gravity"}</p><p className="mt-1 text-[var(--text)]">{row.target_definition.replaceAll("_", " ")}: <strong>{row.rate_mms} mm/s</strong></p><a className={`${sourceLink} text-xs`} href={`${row.source_url}#page=${row.source_page}`} target="_blank" rel="noreferrer">Source p{row.source_page}</a></div>)}
            <p className="text-xs leading-5 text-[var(--amber)]">PMMA tip growth is not the opposed-spread target. SIBAL is a different material. Rounded source values and shared-burn grouping are preserved in the reference CSV.</p>
          </div>
        </section>

        <section className={panel}><h2 className="text-lg font-semibold">Download and reproduce the review</h2><div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{data.downloads.map(file=><a key={file.name} className={`${sourceLink} text-sm`} href={`/training/pmma-v1/${file.name}`} download>{file.name}</a>)}</div><p className="mt-4 text-xs leading-5 text-[var(--muted)]">Raw downloads are preserved. Each observation includes source hash, page, table, units, group and disposition. Candidate means proposed for review, not approved lunar validity.</p></section>
        <footer className="pb-5 text-xs leading-6 text-[var(--muted)]">Next review: examine the measured failures and agree one follow-up experiment. These results do not establish lunar fire safety or operational suppression guidance.</footer>
      </div>
    </div>
  );
}

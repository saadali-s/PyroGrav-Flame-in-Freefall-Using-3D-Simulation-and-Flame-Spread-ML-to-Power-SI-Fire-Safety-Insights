import Link from "next/link";
import flex from "@/data/flex-v1.json";
import s from "../layout/shell.module.css";

export function FlexEvidence() {
  const metrics = flex.metrics.filter(m => m.model === "log_ridge" && m.subset === "all");
  return <section id="flex" className={`${s.section} scroll-mt-6`}>
    <div className={s.eyebrow}>FLEX / ROUND 1</div><h2>Source-matched droplet rates</h2>
    <p>{flex.summary.raw_rows} source CSV records → {flex.summary.accepted} eligible observations in {flex.summary.condition_groups} condition groups. {flex.summary.review} records remain excluded from this experiment. The reported target is average K in mm²/s, not extinction probability.</p>
    <div className={s.table}><table><thead><tr><th>Log ridge evaluation</th><th>Rows / groups</th><th>Group MAE (mm²/s)</th></tr></thead><tbody>{metrics.map(m => <tr key={m.evaluation}><td>{m.evaluation === "condition_group_5fold" ? "Held-out conditions · primary" : "Held-out dates · robustness"}</td><td>{m.rows} / {m.groups}</td><td>{m.group_mae.toFixed(5)}</td></tr>)}</tbody></table></div>
    <p className="mt-4">Large individual errors remain. Fiber support, translation and residual motion are not encoded. CO₂ and helium presence does not establish a causal suppression effect.</p>
    <div className={s.links}><Link href="/simulation?experiment=flex">Inspect observations and largest errors ↗</Link><a href={flex.summary.source_url} target="_blank" rel="noreferrer">NASA original source ↗</a></div>
    <details className="mt-5"><summary>Download source-linked dataset and evaluation</summary><p>{flex.summary.source_definition}</p><div className={s.links}>{["candidate_training.csv", "review_queue.csv", "protocol.json", "metrics.csv", "predictions.csv", "verification.json"].map(f => <a key={f} href={`/training/flex-v1/${f}`} download>{f}</a>)}</div></details>
  </section>;
}

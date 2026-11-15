import Link from "next/link";
import { ArrowUpRight, Flame, Droplets } from "lucide-react";
import pmma from "@/data/simulation-evidence.json";
import flex from "@/data/flex-v1.json";
import s from "../layout/shell.module.css";
import { InvestigationFinder } from "./InvestigationFinder";
import round2 from "@/data/training-round2.json";
import { TransferChart } from "./TransferChart";
import { UtilityEvidence } from "../evidence/UtilityEvidence";

function TransferEvidence() {
  const ridge = round2.predictions.filter(row => row.model === "log_geometry_ridge");
  const transfer = new Map(ridge.filter(row => row.evaluation === "earth_to_microgravity").map(row => [row.observation_id, row]));
  const burns = ridge.filter(row => row.evaluation === "microgravity_logo").map(row => {
    const earth = transfer.get(row.observation_id);
    if (!earth || earth.observed_mms !== row.observed_mms || earth.group_id !== row.group_id) {
      throw new Error(`Unmatched PMMA evaluation record ${row.observation_id}`);
    }
    return { id: row.observation_id, measured: row.observed_mms, iss: row.predicted_mms,
      earth: earth.predicted_mms, flagged: row.unit_inference, group: row.group_id };
  }).sort((a, b) => a.measured - b.measured || a.id.localeCompare(b.id));
  const metrics = round2.evaluations.filter(row => row.model === "log_geometry_ridge");
  return <TransferChart burns={burns}
    issMae={metrics.find(row => row.evaluation === "microgravity_logo")!.group_mae_mms}
    earthMae={metrics.find(row => row.evaluation === "earth_to_microgravity")!.group_mae_mms}/>;
}

export function DashboardWorkbench() {
  const ridge = flex.metrics.find(m => m.evaluation === "condition_group_5fold" && m.subset === "all" && m.model === "log_ridge")!;
  const nearest = flex.metrics.find(m => m.evaluation === "condition_group_5fold" && m.subset === "all" && m.model === "same_fuel_nearest") ;
  const cohorts = [
    { name: "PMMA · Earth", target: "Leading-edge spread", model: "Round 2 · log-geometry ridge", rows: pmma.domains.earth.rows, groups: pmma.domains.earth.groups, error: pmma.domains.earth.mae, unit: "mm/s" },
    { name: "PMMA · ISS", target: "Leading-edge spread", model: "Round 2 · log-geometry ridge", rows: pmma.domains.microgravity.rows, groups: pmma.domains.microgravity.groups, error: pmma.domains.microgravity.mae, unit: "mm/s" },
    { name: "FLEX · ISS", target: "Average burning-rate constant", model: "Round 1 · log ridge", rows: ridge.rows, groups: ridge.groups, error: ridge.group_mae, unit: "mm²/s" },
  ];
  return <div className={s.page}>
    <header className={s.intro}><div className={s.eyebrow}>YOUR COMBUSTION WORKSPACE</div><h1>Make the next research decision with evidence.</h1><p>Estimate supported PMMA conditions, compare recorded droplet burns, and catch source conflicts before they enter a new experiment. Measurements, model errors and original sources in one workspace.</p></header>
    <UtilityEvidence/>
    <InvestigationFinder><TransferEvidence/></InvestigationFinder>
    <div className={s.grid}>
      <section className={s.card}><Flame size={25} aria-hidden/><div className={s.eyebrow}>01 / SOLID FUEL</div><h2>PMMA flame spread</h2><p>Black PMMA rods in opposed airflow. Compare measured rates, Round 2 predictions and the conditional physics baseline in synchronized 3D chambers.</p><div className={s.metrics}><div><strong>{pmma.domains.earth.rows + pmma.domains.microgravity.rows}</strong><small>Modeled rate records</small></div><div><strong>Earth + ISS</strong><small>Separate environment models</small></div></div><p>11 ISS records carry an inferred-unit flag. The physics baseline misses 26 of 34 ISS solutions. New-condition estimates remain experimental.</p><div className={s.links}><Link href="/simulation?experiment=pmma">Open PMMA <ArrowUpRight size={13} className="inline"/></Link><Link href="/training#pmma">Inspect evidence</Link></div></section>
      <section className={s.card}><Droplets size={25} aria-hidden/><div className={s.eyebrow}>02 / LIQUID FUEL</div><h2>FLEX droplet burning</h2><p>Methanol and heptane droplets in ISS gas mixtures, including CO₂ and helium. Compare reported average burning rates with held-out estimates.</p><div className={s.metrics}><div><strong>{flex.summary.accepted}</strong><small>Eligible rate records</small></div><div><strong>{flex.summary.condition_groups}</strong><small>Condition groups</small></div></div><p>{flex.summary.review} of {flex.summary.raw_rows} source CSV records remain in review. This rate model does not predict extinction or recommend a suppressant dose.</p><div className={s.links}><Link href="/simulation?experiment=flex">Open FLEX <ArrowUpRight size={13} className="inline"/></Link><Link href="/training#flex">Inspect evidence</Link></div></section>
    </div>
    <section className={s.section}><h2>What the models have demonstrated</h2><p>Group mean absolute error on held-out experimental groups. Lower is better. The two measurement targets have different units and cannot be ranked against each other.</p><div className={s.table}><table><thead><tr><th>Experimental cohort</th><th>Retained model</th><th>Rows / groups</th><th>Group MAE</th></tr></thead><tbody>{cohorts.map(c => <tr key={c.name}><td>{c.name}<br/><small>{c.target}</small></td><td>{c.model}</td><td>{c.rows} / {c.groups}</td><td>{c.error.toFixed(5)} {c.unit}</td></tr>)}</tbody></table></div><p className="mt-4">PMMA scores reuse development folds; they are not a fresh external validation. Round 4 did not beat the retained Round 2 models. FLEX has a separate held-out-date check.{nearest ? ` Its primary ridge MAE is ${(100 * (1-ridge.group_mae/nearest.group_mae)).toFixed(1)}% lower than nearest lookup.` : ""}</p><div className={s.links}><Link href="/training">Review evaluation and provenance <ArrowUpRight size={13} className="inline"/></Link></div></section>
    <div className={s.notice}><strong>Where the evidence stops.</strong> Moon and Mars prediction remains unvalidated. These visualizations illustrate rate-based motion; they are not CFD, live spacecraft telemetry or operational fire-safety guidance.</div>
  </div>;
}

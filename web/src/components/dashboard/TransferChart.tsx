"use client";
import { useState } from "react";
import s from "./finder.module.css";

type Burn = { id: string; measured: number; iss: number; earth: number; group: string; flagged: boolean };
const series = [["iss", "ISS-trained"], ["earth", "Earth-trained"]] as const;
const ticks = [0, 0.03, 0.06, 0.09, 0.12];
const x = (rate: number) => 68 + rate / 0.12 * 444;
const y = (rate: number) => 205 - rate / 0.12 * 177;
const format = (rate: number) => rate.toFixed(5);

export function TransferChart({ burns, issMae, earthMae }: { burns: Burn[]; issMae: number; earthMae: number }) {
  const largestMiss = burns.reduce((worst, burn) =>
    Math.abs(burn.earth - burn.measured) > Math.abs(worst.earth - worst.measured) ? burn : worst);
  const [id, setId] = useState(largestMiss.id);
  const [visible, setVisible] = useState("both");
  const selected = burns.find(burn => burn.id === id)!;
  return <section className={s.analytics} aria-labelledby="transfer-heading">
    <header><span className={s.ids}>PMMA · ISS flight tests</span>
      <h2 id="transfer-heading">How well does Earth training transfer to the ISS?</h2>
      <p>Two models predict the same {burns.length} measured flame-spread rates. Points above the dashed line overpredict spread.</p>
    </header>
    <div className={s.grade}>
      {series.map(([key, label]) => <div key={key}><span><i data-series={key}/>{label}</span>
        <strong>{format(key === "iss" ? issMae : earthMae)} <small>mm/s</small></strong></div>)}
      <p>Group mean absolute error<br/>{new Set(burns.map(b => b.group)).size} provisional specimen groups</p>
    </div>
    <div className={s.plot}>
      <div className={s.plotTools}><b>Predicted rate (mm/s)</b>
        <label>Show<select value={visible} onChange={e => setVisible(e.target.value)}>
          <option value="both">Both models</option>{series.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <svg viewBox="0 0 548 251" role="img" aria-label="Predicted versus measured PMMA spread rates. Use the burn selector below to inspect exact values.">
        {ticks.map(t => <g key={t} className={s.gridline}>
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(.12)}/>
          <line x1={x(0)} x2={x(.12)} y1={y(t)} y2={y(t)}/>
          <text x={x(t)} y="222" textAnchor="middle">{t.toFixed(2)}</text>
          <text x="55" y={y(t)+4} textAnchor="end">{t.toFixed(2)}</text>
        </g>)}
        <line className={s.parity} x1={x(0)} x2={x(.12)} y1={y(0)} y2={y(.12)}/>
        {series.filter(([key]) => visible === "both" || key === visible).map(([key, label]) =>
          <g key={key} className={s.points} data-series={key}>
            {burns.map(burn => <g key={burn.id} onClick={() => setId(burn.id)} transform={`translate(${x(burn.measured)} ${y(burn[key])})`}>
              <title>{`${burn.id} · ${label} · measured ${format(burn.measured)}, predicted ${format(burn[key])} mm/s`}</title>
              <circle r="6" fill="transparent"/>
              {key === "iss" ? <circle r="3.5" fill="currentColor"/> : <path d="M0 -4.7 4.7 0 0 4.7 -4.7 0Z" fill="currentColor"/>}
            </g>)}
            <circle cx={x(selected.measured)} cy={y(selected[key])} r="7" fill="none" stroke="currentColor" strokeWidth="1.5" pointerEvents="none"/>
          </g>)}
        <text x="290" y="246" textAnchor="middle" className={s.axis}>Measured spread rate (mm/s)</text>
      </svg>
    </div>
    <div className={s.inspector}>
      <label>Inspect burn<select value={id} onChange={e => setId(e.target.value)}>
        {burns.map(burn => <option key={burn.id}>{burn.id}</option>)}</select></label>
      <dl>{([["Measured", selected.measured], ["ISS-trained", selected.iss], ["Earth-trained", selected.earth]] as const).map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{format(value)} mm/s</dd></div>)}</dl>
    </div>
    <p>{selected.flagged && <strong>Selected burn has inferred units. </strong>}{burns.filter(b => b.flagged).length} rates carry an inferred-unit flag. ISS predictions held out each specimen group. Both scores reuse development evaluations. <a href="/training/round2/heldout_predictions.csv">Source rows ↗</a></p>
  </section>;
}

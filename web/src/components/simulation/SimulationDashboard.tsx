"use client";
import { useEffect, useRef, useState } from "react";
import type { SharedChamberView } from "../three/RodChamber";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FlameReference } from "./FlameReference";
import { ArrowUpRight, Box, CircleHelp, Moon, Pause, Play, RotateCcw, Wind, Download, ChevronRight, Check, ShieldAlert } from "lucide-react";
import { observations, domains, estimate, frontDistance, type Environment, type Observation } from "@/lib/simulation";
import { observationSource, observationOption } from "@/lib/observation-labels";
import physics from "@/data/physics-baseline.json";
import s from "./simulation.module.css";
import p from "./pmma-workbench.module.css";
import f from "./flex-workbench.module.css";
import { ExperimentBar } from "./ExperimentBar";
import { useTheme } from "../layout/ThemeProvider";
import { UtilityEvidence } from "../evidence/UtilityEvidence";
const RodChamber=dynamic(()=>import("@/components/three/RodChamber"),{ssr:false,loading:()=> <div className={s.loading}>Preparing the chamber…</div>});
const fmt=(x:number|null)=>x===null?"—":x.toFixed(4);
const physicsRows:Record<string,{rate:number|null;status:string}>=physics.rows;
const initial=observations.find(r=>r.environment==="earth"&&r.diameter===6.4)??observations[0];
const otherInitial=observations.find(r=>r.environment==="microgravity"&&!r.unitFlag)??observations[0];
const comparisons = [["physics", "Physics vs. ML"], ["measurement", "Measured vs. ML"], ["environments", "Earth vs. ISS"]] as const;
type Comparison = typeof comparisons[number][0];
export function SimulationDashboard(){
 const { theme } = useTheme();
 const sharedView=useRef<SharedChamberView>(null);
 const [reducedMotion,setReducedMotion]=useState(true);
 useEffect(()=>{const preference=window.matchMedia("(prefers-reduced-motion: reduce)");const update=()=>setReducedMotion(preference.matches);update();preference.addEventListener("change",update);return()=>preference.removeEventListener("change",update);},[]);
 const [env,setEnv]=useState<Environment>("earth"),[rowId,setRowId]=useState(initial.id),[otherId,setOtherId]=useState(otherInitial.id);
 const [comparison,setComparison]=useState<Comparison>("physics"),[custom,setCustom]=useState(false);
 const [inputs,setInputs]=useState({oxygen:19.5,diameter:8,flow:2});
 const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(10),[flow,setFlow]=useState(true),[camera,setCamera]=useState<"perspective"|"front">("perspective"),[reset,setReset]=useState(0);
 const row=observations.find(r=>r.id===rowId)??initial, other=observations.find(r=>r.id===otherId)??otherInitial;
 const sourceLabel=observationSource(row);
 const conditions=custom?inputs:row, domain=domains[env], experimental=estimate(env,conditions);
 const ml=custom?experimental.rate:row.heldout, physical=custom?null:physicsRows[row.id].rate;
 const leftRate=comparison==="measurement"?row.observed:comparison==="environments"?ml:physical;
 const rightRate=comparison==="environments"?other.heldout:ml;
 const leftLabel=comparison==="measurement"?"Measured-rate reference":comparison==="environments"?(env==="earth"?"Earth · 1 g":"ISS · microgravity"):"Physics-only baseline";
 const rightLabel=comparison==="environments"?(other.environment==="earth"?"Earth · 1 g":"ISS · microgravity"):"Round 2 · ML";
 const pm=physics.metrics.find(m=>m.scenario==="published_closure_primary"&&m.environment===env)!;
 const resetTime=()=>{setPlaying(false);setSeconds(0);};
 const changeEnvironment=(value:Environment)=>{setEnv(value);setRowId(observations.find(r=>r.environment===value&&!r.unitFlag)!.id);setOtherId(observations.find(r=>r.environment!==value&&!r.unitFlag)!.id);resetTime();};
 useEffect(()=>{if(!playing)return;let last=performance.now();const id=window.setInterval(()=>{const now=performance.now();setSeconds(t=>Math.min(300,t+(now-last)/1000*speed));last=now;},50);return()=>clearInterval(id);},[playing,speed]);
 useEffect(()=>{if(seconds>=300&&playing){const id=requestAnimationFrame(()=>setPlaying(false));return()=>cancelAnimationFrame(id);}},[seconds,playing]);
 const exportResult=()=>{const payload={mode:comparison,experimental:custom,conditions,observation_id:custom?null:row.id,measured_mms:custom?null:row.observed,ml_mms:ml,physics_mms:physical,time_s:seconds,other_observation:comparison==="environments"?other:null,limitations:"Physics conditional and unvalidated; ML reused development evaluation. Appearance illustrative. No lunar/Mars validation."};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="pyrograv-comparison.json";a.click();URL.revokeObjectURL(url);};
 const chooseComparison=(c:Comparison)=>{setComparison(c);setCustom(false);resetTime();};
 const summary=(r:Observation)=>`${r.oxygen}% O₂ · Ø ${r.diameter} mm · ${r.flow} cm/s`;
 return <><ExperimentBar experiment="pmma">
   <div className={p.scores} role="group" aria-label="Environment-wide evaluation scores">
     <div className={p.readout}>
       <span>Round 2 ML · {env==="earth"?"Earth":"ISS"}</span>
       <strong>{domain.mae.toFixed(5)} <small>mm/s</small></strong>
       <p>Group MAE · {domain.rows} rows / {domain.groups} groups</p>
       <div className={p.status}><Check size={12}/>Reused development evaluation</div>
     </div>
     <div className={p.readout}>
       <span>Physics baseline · {env==="earth"?"Earth":"ISS"}</span>
       <strong>{pm.group_mae_mms===null?"Not scored":pm.group_mae_mms.toFixed(5)} <small>{pm.group_mae_mms===null?"full cohort":"mm/s"}</small></strong>
       <p>Unique solutions · {pm.predicted_rows} / {pm.rows} observations</p>
       <div className={p.caution}><ShieldAlert size={12}/>{env==="earth"?"Higher error than ML":"Missing predictions count as failures"}</div>
     </div>
   </div>
 </ExperimentBar>
 <section className={`${s.main} ${p.workbench}`}><header className={p.topline}>
   <div><h1>PMMA rod lab</h1><p>Opposed flame spread · {env==="earth"?"Earth":"ISS microgravity"}</p></div>
 </header>
 <UtilityEvidence scope={env==="earth"?"earth":"iss"}/>
 <div className={p.toolbar}>
   <div className={f.tabs} role="tablist" aria-label="PMMA workspace views">
     {comparisons.map(([key, label], index) => <button key={key} role="tab" id={`pmma-tab-${key}`} aria-selected={comparison===key} aria-controls="pmma-comparison-panel" tabIndex={comparison===key?0:-1}
       onClick={()=>chooseComparison(key)} onKeyDown={event=>{
         const last = comparisons.length - 1;
         const positions: Record<string, number> = {ArrowRight:(index+1)%comparisons.length, ArrowLeft:(index+last)%comparisons.length, Home:0, End:last};
         const position = positions[event.key];
         if (position === undefined) return;
         event.preventDefault();
         const next = comparisons[position][0];
         chooseComparison(next);
         document.getElementById(`pmma-tab-${next}`)?.focus();
       }}>{label}</button>)}
   </div>
   <button className={s.export} onClick={exportResult} aria-label="Export comparison"><Download size={16}/> Export comparison</button>
 </div>
 <div id="pmma-comparison-panel" role="tabpanel" aria-labelledby={`pmma-tab-${comparison}`} className={s.labGrid}><section className={s.controls} aria-labelledby="conditions-heading"><div className={s.panelTitle}><h2 id="conditions-heading">Test conditions</h2><span>01</span></div><span className={s.label}>Environment</span><div className={s.segment}><button aria-pressed={env==="earth"} onClick={()=>changeEnvironment("earth")}>Earth <small>1 g</small></button><button aria-pressed={env==="microgravity"} onClick={()=>changeEnvironment("microgravity")}>ISS <small>≈ 0 g</small></button></div>
 <label className={s.field}>Published observation<select value={rowId} disabled={custom} onChange={e=>{setRowId(e.target.value);resetTime();}}>{observations.filter(r=>r.environment===env).map(r=><option key={r.id} value={r.id}>{observationOption(r)}</option>)}</select></label>
 {!custom&&<div className={s.observationSource}><strong>{sourceLabel.title}</strong><span>{sourceLabel.locator} · supplement p{sourceLabel.page}</span><code title="Internal extraction locator, not an official NASA test ID">Extraction ID · {row.id}</code></div>}
 <div className={s.material}><div className={s.materialSwatch}/><div><strong>Black cast PMMA</strong><span>Opposed flame spread · cylindrical rod</span></div></div><div className={s.conditions}>{[["Oxygen concentration",conditions.oxygen,"%"],["Rod diameter",conditions.diameter,"mm"],["Imposed airflow",conditions.flow,"cm/s"]].map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{typeof value==="number"&&!Number.isFinite(value)?"—":value}<small>{unit}</small></strong></div>)}</div>
 <p className={s.smallNote}>Per-run pressure is unresolved. Physics assumes reference pressure; pressure response is not validated.</p>{row.unitFlag&&!custom&&<p className={s.warning}><ShieldAlert size={14}/> This row carries an inferred-unit flag (U01).</p>}
 {comparison==="environments"&&<label className={s.field}>Compare with {other.environment==="earth"?"Earth":"ISS"}<select value={otherId} onChange={e=>{setOtherId(e.target.value);resetTime();}}>{observations.filter(r=>r.environment!==env).map(r=><option key={r.id} value={r.id}>{observationOption(r)}</option>)}</select><small>{observationSource(other).locator} · extraction ID {other.id}. Independent observations, not a matched gravity-only experiment.</small></label>}
 {comparison!=="environments"&&<details className={s.experimental}><summary>Explore a new ML condition <ChevronRight size={14}/></summary><p>Existing fold-model median. No independent accuracy score for this aggregate.</p><label><input type="checkbox" checked={custom} onChange={e=>{setCustom(e.target.checked);setComparison("physics");resetTime();}}/> Enable experimental inputs</label>{custom&&([['oxygen','Oxygen (%)',15,35,.1],['diameter','Diameter (mm)',1,20,.1],['flow','Flow (cm/s)',.1,30,.1]] as const).map(([key,label,min,max,step])=><label className={s.field} key={key}>{label}<input type="number" min={min} max={max} step={step} value={Number.isNaN(inputs[key])?"":inputs[key]} onChange={e=>{setInputs({...inputs,[key]:e.target.valueAsNumber});resetTime();}}/></label>)}{custom&&<p className={s.warning}>{experimental.reason} Physics is withheld for new inputs.</p>}</details>}
 <div className={s.unavailable}><Moon size={16}/><div><strong>Moon & Mars</strong><span>Prediction unavailable · no compatible validation</span></div></div><a className={s.sourceLink} href="https://www.nature.com/articles/s41598-017-18398-4" target="_blank" rel="noreferrer">View experimental source <ArrowUpRight size={14}/></a></section>
 <div className={p.resultsColumn} data-pmma-results><div className={s.chamberSection}><div className={s.chamberToolbar}><span><Box size={15}/> SYNCHRONIZED CHAMBERS</span><div><FlameReference onOpen={()=>setPlaying(false)}/><button aria-pressed={flow} title="Show airflow direction" onClick={()=>setFlow(!flow)}><Wind size={16}/><span>Flow</span></button><button onClick={()=>{sharedView.current=null;setCamera(camera==="front"?"perspective":"front");}} aria-label="Toggle front camera">{camera==="front"?"3D":"Front"}</button><button aria-label="Reset cameras" title="Reset cameras" onClick={()=>{sharedView.current=null;setReset(reset+1);}}><RotateCcw size={15}/></button></div></div>
 <div className={s.chambers}>{[0,1].map(index=>{const isOther=index===1&&comparison==="environments",rate=index===0?leftRate:rightRate,measured=custom?null:isOther?other.observed:row.observed,error=rate!==null&&measured!==null?Math.abs(rate-measured):null;return <section className={s.chamber} key={index} aria-label={index===0?leftLabel:rightLabel}>
 <div className={s.sceneHeading}><div><span className={index===0?s.tagPhysics:s.tagMl}>{index===0?"A":"B"}</span><h3>{index===0?leftLabel:rightLabel}</h3></div><small>{comparison==="environments"?summary(isOther?other:row):index===0&&comparison==="physics"?"Analytical energy balance · conditional":index===0?"Constant-rate kinematics":custom?"Experimental fold-model median":"Log-geometry ridge · held-out group"}</small></div>
 <div className={s.canvas}><RodChamber rate={rate} observed={measured} seconds={seconds} diameter={isOther?other.diameter:Number.isFinite(conditions.diameter)&&conditions.diameter>0?Math.min(conditions.diameter,20):8} environment={isOther?(other.environment==="earth"?"earth":"microgravity"):env} light={theme==="light"} flow={flow} camera={camera} reset={reset} playing={playing} reducedMotion={reducedMotion} sharedView={sharedView} publishView={view=>{sharedView.current=view;}}/>{rate===null&&<div className={s.abstention}><ShieldAlert size={21}/><strong>{custom?"Estimate withheld":"No steady solution found"}</strong><p>{custom?"This comparison is unavailable for the selected inputs.":"The baseline cannot describe this measured burn. This does not mean extinction."}</p></div>}<div className={s.axisLabel}>Airflow ↑<br/>Spread opposes flow ↓<br/><span>{(isOther?other.environment:env)==="earth"?"Earth · vertical schematic":"ISS · no gravitational ‘down’"}</span></div><div className={s.appearanceBadge}>Illustrated {(isOther?other.environment:env)==="earth"?"Earth plume":"ISS envelope"}</div><div className={s.scale}>50 mm display span · not burn length</div></div>
 <div className={s.sceneStats}><div><span>Spread rate</span><strong>{fmt(rate)} <small>mm/s</small></strong></div><div><span>{measured===null?"Error unavailable":"Absolute error"}</span><strong>{fmt(error)} <small>mm/s</small></strong></div></div><div className={s.progress}><div style={{width:`${frontDistance(rate,seconds)/50*100}%`}}/></div></section>;})}</div>
 <div className={s.playback}><button className={s.play} onClick={()=>{if(seconds>=300)setSeconds(0);setPlaying(!playing);}} aria-label={playing?"Pause playback":"Start playback"}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><button aria-label="Restart playback" onClick={resetTime}><RotateCcw size={16}/></button><span className={s.time}>{seconds.toFixed(1)}<small> / 300 s</small></span><input aria-label="Playback time" type="range" min={0} max={300} step={.1} value={seconds} onChange={e=>{setPlaying(false);setSeconds(Number(e.target.value));}}/><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,5,10,30].map(x=><option key={x} value={x}>{x}×</option>)}</select></div><div className={s.legend}><span><i/>Rate-driven front</span><span><i/>Measured-rate position</span><span>Linked orbit / zoom · same scale</span></div><div className={s.visualNote}><CircleHelp size={15}/><p>Only front position is rate-driven. Color, plume size and flicker are illustrative—not CFD, temperature or soot predictions. Orange marks reported rate × display time, not a video-tracked trajectory. The 50 mm span and 300 s timeline are display choices.</p></div></div>

 <section className={p.interpretation} aria-labelledby="insights-heading"><div className={s.insightIntro}><div className={s.eyebrow}>EVIDENCE, NOT APPEARANCE</div><h2 id="insights-heading">Does the model get closer?</h2><p>Compare against measured burns. Lower error is better; a convincing flame is not proof of accuracy.</p><Link href="/training">Inspect every held-out result <ArrowUpRight size={14}/></Link></div><div className={s.verdict}><span>WHAT WE LEARNED</span><p>{env==="earth"?"The current physics baseline overpredicts Earth spread. Its inherited coefficients need scrutiny before any calibration.":"The baseline misses steady solutions for 26 observed ISS burns. Low-flow heat feedback and radiation remain unresolved."}</p><small>Physics: no local fitting; some published coefficients came from CFD. ML: held-out predictions, but repeated development use. Neither validates Moon or Mars.</small></div></section>
 <div className={p.sources}><a href="/training/physics-baseline/protocol.json">Physics assumptions ↗</a><a href="/training/physics-baseline/results.json">All physics results ↗</a><Link href="/training">Data provenance ↗</Link></div></div></div></section></>;
}

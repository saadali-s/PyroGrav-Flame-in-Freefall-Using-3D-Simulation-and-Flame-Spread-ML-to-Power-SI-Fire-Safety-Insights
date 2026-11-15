"use client";

import { useState } from "react";
import { ArrowDownRight, MessageCircle } from "lucide-react";
import data from "@/data/analytics-results.json";
import { explainResult } from "@/lib/analytics-selection";
import s from "./analytics.module.css";

type Cohort = typeof data.cohorts[number];
const number = (value:number) => value.toFixed(5);
function groupName(id:string){
  if(id.startsWith("flight-"))return "Specimen "+id.slice(7);
  if(id.startsWith("ground-"))return id.replace("ground-d","Ø ").replace("-o"," cm · O₂ ")+"%";
  const [fuel,pressure,o2,,co2,he]=id.split("|");
  const percent=(v:string)=>(Number(v)*100).toFixed(1).replace(/\.0$/,"");
  return `${fuel} · ${Number(pressure)/10} atm bin · ${percent(o2)}% O₂ · ${percent(co2)}% CO₂ · ${percent(he)}% He`;
}

function Disposition({family}:{family:"pmma"|"flex"}) {
  const records = data.records[family];
  const count = records.filter(r=>r.eligible).length;
  const [slice,setSlice] = useState<boolean|null>(null);
  const [query,setQuery] = useState("");
  const list = records.filter(r=>r.eligible===slice && (r.id+" "+r.reason+" "+r.name).toLowerCase().includes(query.toLowerCase()));
  const toggle=(v:boolean)=>{setSlice(slice===v?null:v);setQuery("");};
  const portion=count/records.length;
  return <section className={s.card}><h2>Source records</h2><p>{family==="pmma"?"PMMA collection · Earth and ISS":"FLEX collection · PSI-69"}</p>
    <div className={s.donutLine}><div className={s.donut}><svg viewBox="0 0 100 100" aria-hidden="true">{[true,false].map(v=><circle key={String(v)} cx="50" cy="50" r="44" fill="none" stroke={v?"var(--accent)":"var(--amber)"} strokeWidth="11" pathLength="100" strokeDasharray={`${100*(v?portion:1-portion)} 100`} strokeDashoffset={v?0:-portion*100} transform="rotate(-90 50 50)" onClick={()=>toggle(v)}/>)}</svg><b>{records.length}<small>records</small></b></div>
    <div className={s.legend}>{[true,false].map(v=><button key={String(v)} aria-pressed={slice===v} onClick={()=>toggle(v)}><i data-review={!v}/>{v?"Evaluated":"For review"} <b>{v?count:records.length-count}</b></button>)}</div></div>
    <p>{family==="flex"?"258 records contain numeric K, including some held for review.":"Source disposition covers both environments. Each model uses its own subset."}</p>
    {slice!==null&&<div><label>Find a record<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ID, specimen or reason"/></label><div className={s.scroll}>{list.map(r=><div className={s.record} key={r.id}><strong>{r.id} · {r.name}</strong><p>{r.reason}</p><a href={r.url} target="_blank" rel="noreferrer">{r.locator} ↗</a></div>)}{!list.length&&<p>No matching records.</p>}</div></div>}
  </section>;
}

function Evaluation({c}:{c:Cohort}) {
  const [selected,setSelected] = useState(c.groups[0].id);
  const [query,setQuery] = useState("");
  const group = c.groups.find(g=>g.id===selected)!;
  const family = c.family==="flex"?"flex":"pmma";
  const records = data.records[family];
  const bars = c.groups.length>20 ? [...c.groups.slice(0,5),...c.groups.slice(-5)] : c.groups;
  const max = Math.max(...bars.map(g=>Math.abs(g.delta)));
  const wins = c.groups.filter(g=>g.winner==="ML").length;
  return <div className={s.grid}>
    <div className={s.stack}><section className={s.card}>
      <div className={s.heading}><div><h2>Error by held-out group</h2><p>Lookup MAE minus model MAE · {c.unit}</p></div><div className={s.kpi}><ArrowDownRight size={17}/>{c.gain.toFixed(2)}%<small>lower group MAE</small></div></div>
      <div className={s.chartKey}><span>← Lookup closer</span><span>ML closer →</span></div>
      <div className={s.bars}>{bars.map(g=><button key={g.id} aria-label={groupName(g.id)+", difference "+number(g.delta)+" "+c.unit} aria-pressed={selected===g.id} onClick={()=>setSelected(g.id)}>
        <span title={groupName(g.id)}>{g.id.startsWith("flight-")?g.id.slice(7):groupName(g.id)}</span><span className={s.track}><i style={{width:(50*Math.abs(g.delta)/max)+"%",[g.delta<0?"right":"left"]:"50%",background:g.delta<0?"var(--amber)":"var(--accent)"}}/></span><b>{g.delta>0?"+":""}{number(g.delta)}</b></button>)}</div>
      <p>{wins} of {c.groups.length} groups favor ML. {bars.length!==c.groups.length?"Chart shows the five largest gains and five largest losses. ":""}Each group has equal weight in the development score.</p>
      <details className={s.disclose}><summary>Search all {c.groups.length} groups</summary><label>Group filter<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className={s.scroll}><table><thead><tr><th>Group</th><th>Lookup</th><th>ML</th><th>Closer</th></tr></thead><tbody>{c.groups.filter(g=>(g.id+groupName(g.id)).toLowerCase().includes(query.toLowerCase())).map(g=><tr key={g.id}><td><button onClick={()=>setSelected(g.id)}>{groupName(g.id)}</button></td><td>{number(g.baseline)}</td><td>{number(g.model)}</td><td>{g.winner}</td></tr>)}</tbody></table></div></details>
    </section></div>
    <aside className={s.stack}><section className={s.card}><div className={s.eyebrow}>Selected group</div><h2>{groupName(group.id)}</h2><p>{group.rows.length} held-out observation{group.rows.length!==1?"s":""} · {c.unit}</p>
      <div className={s.pair}><div><small>Lookup MAE</small><b>{number(group.baseline)}</b></div><div><small>Model MAE</small><b>{number(group.model)}</b></div></div>
      <p>{group.winner==="tie"?"Equal mean absolute error.":group.winner+" has lower error in this group."} {c.id==="iss"?"Flight specimen grouping is provisional.":""}</p>
      <div className={s.scroll}><table><thead><tr><th>Source</th><th>Observed</th><th>Lookup</th><th>ML</th></tr></thead><tbody>{group.rows.map(row=>{const rec=records.find(r=>r.id===row.id)!;return <tr key={row.id}><td><a href={rec.url} title={rec.locator} target="_blank" rel="noreferrer">{rec.id} ↗</a>{rec.flags&&<small>{rec.flags.includes("U01")?"U01 · inferred unit":rec.flags}</small>}</td><td>{number(row.observed)}</td><td>{number(row.baseline)}</td><td>{number(row.model)}</td></tr>;})}</tbody></table></div>
      <button className={s.explain} onClick={()=>explainResult({kind:"group",cohort:c.id,group:group.id},c.label+" · "+groupName(group.id))}><MessageCircle size={15}/>Explain this result</button>
    </section><Disposition family={family}/></aside>
  </div>;
}

export function Performance(){
  const [choice,setChoice]=useState("iss");
  const c=data.cohorts.find(item=>item.id===choice)!;
  return <><div className={s.toolbar}><label>Evaluation <select aria-label="Evaluation" value={choice} onChange={e=>setChoice(e.target.value)}>{data.cohorts.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><span>Reused grouped development tests</span></div><Evaluation key={choice} c={c}/></>;
}


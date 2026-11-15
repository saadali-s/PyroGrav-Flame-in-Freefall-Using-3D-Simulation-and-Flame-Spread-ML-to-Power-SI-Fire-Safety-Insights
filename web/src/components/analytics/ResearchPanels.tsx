"use client";

import {useState} from "react";
import Link from "next/link";
import {MessageCircle} from "lucide-react";
import catalog from "@/data/analytics-studies.json";
import {rankStudies} from "@/lib/investigation-ranking";
import {explainResult} from "@/lib/analytics-selection";
import s from "./analytics.module.css";

const topics = [["all","All topics"],["prevention","Prevention"],["detection","Detection"],["suppression","Suppression"],["partial-gravity","Partial gravity"]];
const studies=catalog.studies.map(item=>({...item,readiness:item.readiness??"metadata",relatedTopics:item.relatedTopics??[]}));
function Sources({items}:{items:{url:string;locator:string}[]}){
  return <details className={s.disclose}><summary>Sources and locators</summary><ul>{items.map(source=><li key={source.url+source.locator}><a href={source.url} target="_blank" rel="noreferrer">{source.locator} ↗</a></li>)}</ul></details>;
}
function Study({study}:{study:typeof studies[number]}){
  return <article className={s.card}><div className={s.eyebrow}>{study.status}</div><h2>{study.name}</h2><p>{study.objective}</p>
    <dl>{[["Apparatus",study.hardware],["Sample",study.material],["Conditions",study.conditions],["Observable",study.measurement+" · "+study.units],["Evidence limit",study.limits]].map(([key,val])=><div key={key}><dt>{key}</dt><dd>{val}</dd></div>)}</dl><Sources items={study.sources}/>
    {study.action&&<Link className={s.lab} href={study.action}>{study.actionLabel} →</Link>}
  </article>;
}
export function Investigations(){
  const [topic,setTopic]=useState("all"),[id,setId]=useState("pmma"),[other,setOther]=useState("");
  const candidates=rankStudies(studies,topic).filter(e=>topic==="all"||e.topics.includes(topic)||e.relatedTopics.includes(topic));
  const first=candidates.find(e=>e.id===id)??candidates[0];
  const second=studies.find(e=>e.id===other&&e.id!==first.id);
  return <><div className={s.toolbar}><label>Focus<select aria-label="Focus" value={topic} onChange={e=>setTopic(e.target.value)}>{topics.map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
    <label>Investigation<select aria-label="Investigation" value={first.id} onChange={e=>setId(e.target.value)}>{candidates.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <label>Compare with<select aria-label="Compare with" value={second?.id??""} onChange={e=>setOther(e.target.value)}><option value="">One investigation</option>{studies.filter(e=>e.id!==first.id).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label></div>
    <div className={s.studyGrid}><Study study={first}/>{second&&<Study study={second}/>}</div><button className={s.explain} onClick={()=>explainResult({kind:"study",id:first.id,compare:second?.id},[first.name,second?.name].filter(Boolean).join(" and "))}><MessageCircle size={15}/>Explain this result</button></>;
}
export function Applications(){
  const [area,setArea]=useState("exploration");
  const cards=area==="earth"?catalog.applications.slice(2):catalog.applications.slice(0,2);
  return <><div className={s.toolbar}><label>Application<select aria-label="Application" value={area} onChange={e=>setArea(e.target.value)}><option value="exploration">Exploration habitats</option><option value="earth">Earth applications</option></select></label></div>
    <div className={s.studyGrid}>{cards.map(card=><article key={card.id} className={s.card}><div className={s.eyebrow}>{card.name}</div><h2>{card.question}</h2><p>{card.finding}</p><div className={s.context}>{card.context}</div><h3>Evidence limit</h3><p>{card.limit}</p><Sources items={card.sources}/><button className={s.explain} onClick={()=>explainResult({kind:"application",id:card.id},card.name)}><MessageCircle size={15}/>Explain this result</button></article>)}</div></>;
}


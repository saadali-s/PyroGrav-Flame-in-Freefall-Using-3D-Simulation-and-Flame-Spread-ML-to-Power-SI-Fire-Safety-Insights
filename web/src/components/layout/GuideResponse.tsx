"use client";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Check, Copy, RotateCcw, ArrowUpRight } from "lucide-react";
import type { GuideToolResult } from "@/lib/guide-tools";
import s from "./space-guide.module.css";
import { GuideToolCard } from "./GuideToolCard";

type Evidence = {id:string;title:string;limit:string;sources:{url:string;locator:string}[];audited_facts?:string[];
  saved_development_evaluations?:{evaluation:string;model:string;group_mean_absolute_error:number;units:string;project_artifact:string}[]};
export type GuideMessage = {id:number;role:"you"|"guide";text:string;status?:string;mode?:string;
  evidence?:Evidence[];actions?:{label:string;href:string}[];retrievalUnavailable?:boolean;tools?:GuideToolResult[];question?:string;selection?:import("@/lib/analytics-selection").AnalyticsSelection;origin?:string};


export function GuideResponse({message,copied,canRetry,onCopy,onRetry,onNavigate}:{message:GuideMessage;copied:boolean;canRetry:boolean;
  onCopy:()=>void;onRetry:()=>void;onNavigate:()=>void}) {
  const label=message.origin==="indus_evidence"?"INDUS source results":message.origin==="analytics_lookup"?"Verified Analytics lookup":message.origin==="verified_summary"?"Saved evaluation summary":message.origin==="tool_result"?"Lab result":message.mode==="guidance"?"App guide":message.mode==="general"?"General answer · not source-verified":message.status==="generated"?"Research answer":message.status==="error"?"Connection issue":message.status==="stopped"?"Response interrupted":"Evidence limit";
  return <>
    <div className={s.replyLabel}><span className={s.guideDot}/><span>Space guide</span><small>{label}</small></div>
    <div className={s.messageBody}><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img","input"]}
      components={{a:({children})=><span>{children}</span>,table:({children})=><div className={s.toolTable}><table>{children}</table></div>}}>{message.text}</Markdown></div>
    {message.retrievalUnavailable&&<div className={s.inlineNotice}>INDUS search unavailable. Any lab result below is separate.</div>}
    {message.tools?.map((tool,i)=><GuideToolCard key={tool.name+i} tool={tool}/>)}
    {!!message.evidence?.length&&<details className={s.sourceGroup}><summary><BookOpen size={14}/> Sources <span>{message.evidence.length} {message.evidence.length===1?"study":"studies"}</span></summary>
      {message.evidence.map(record=><div className={s.sourceRecord} key={record.id}><strong>{record.title}</strong><p>{record.limit}</p>
        {record.sources.map(source=><a key={source.url+source.locator} href={source.url} target="_blank" rel="noreferrer">{source.locator} <ArrowUpRight size={12}/></a>)}
        {record.saved_development_evaluations?.map(metric=><a key={metric.evaluation+metric.model} href={metric.project_artifact}>Group MAE · {metric.evaluation.replaceAll("_"," ")} · {metric.model.replaceAll("_"," ")} · {metric.group_mean_absolute_error.toFixed(5)} {metric.units}</a>)}
        {!!record.audited_facts?.length&&<details><summary>Reviewed audit notes</summary>{record.audited_facts.map(fact=><p key={fact}>{fact}</p>)}</details>}
      </div>)}
    </details>}
    {!!message.actions?.length&&<nav className={s.replyActions} aria-label="Suggested pages">{message.actions.map(action=><Link key={action.href} href={action.href} onClick={onNavigate}>{action.label}<ArrowUpRight size={13}/></Link>)}</nav>}
    <div className={s.messageTools}>{message.status!=="error"&&message.status!=="stopped"&&<button onClick={onCopy} aria-label={copied?"Response copied":"Copy response"} title={copied?"Copied":"Copy response"}>{copied?<Check size={14}/>:<Copy size={14}/>}<span>{copied?"Copied":"Copy"}</span></button>}
      {canRetry&&<button onClick={onRetry}><RotateCcw size={14}/>Try again</button>}
    </div>
  </>;
}

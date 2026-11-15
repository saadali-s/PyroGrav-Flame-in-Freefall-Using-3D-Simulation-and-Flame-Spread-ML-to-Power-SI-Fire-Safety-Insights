"use client";
import {useRef,useState} from "react";
import {Performance} from "./Performance";
import {Applications,Investigations} from "./ResearchPanels";
import s from "./analytics.module.css";

const tabs=["Model performance","Investigations and hardware","Earth and exploration applications"];
export function AnalyticsWorkbench(){
  const [tab,setTab]=useState(0);
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  return <div className={s.page}><header className={s.pageHead}><h1>Analytics</h1><a download href="/analytics/PyroGrav-Analytics.xlsx">Download workbook ↓</a></header><div role="tablist" aria-label="Analytics views" className={s.tabs}>
    {tabs.map((label,index)=><button key={label} id={"analytics-tab-"+index} role="tab" aria-selected={tab===index} aria-controls={"analytics-panel-"+index} tabIndex={tab===index?0:-1}
      ref={el=>{buttons.current[index]=el;}} onClick={()=>setTab(index)} onKeyDown={e=>{
        const dest=({ArrowRight:(tab+1)%3,ArrowLeft:(tab+2)%3,Home:0,End:2} as Record<string,number>)[e.key];
        if(dest!==undefined){e.preventDefault();setTab(dest);buttons.current[dest]?.focus();}
      }}>{label}</button>)}</div>
    {[Performance,Investigations,Applications].map((Panel,i)=><div key={i} role="tabpanel" hidden={tab!==i} id={"analytics-panel-"+i} aria-labelledby={"analytics-tab-"+i}><Panel/></div>)}</div>;
}

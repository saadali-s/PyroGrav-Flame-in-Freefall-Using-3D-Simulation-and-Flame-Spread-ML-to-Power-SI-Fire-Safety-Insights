import data from "@/data/analytics-results.json";
import catalog from "@/data/analytics-studies.json";
import { hostedIndus, retrieveIndus } from "./indus";

type Source = {url:string;locator:string};
type Evidence = {id:string;title:string;limit:string;sources:Source[]};
const studies=catalog.studies, apps=catalog.applications;
function evidence(id:string):Evidence|undefined{
  const study=studies.find(s=>s.id===id);
  if(study)return {id,title:study.name,limit:study.limits,sources:study.sources};
  const app=apps.find(a=>a.id===id);
  if(app)return {id,title:app.name,limit:app.limit,sources:app.sources};
}

export function lookupAnalytics(selection:unknown) {
  if(!selection||typeof selection!=="object")return;
  const s=selection as Record<string,unknown>;
  if(s.kind==="group"){
    const c=data.cohorts.find(x=>x.id===s.cohort);
    const g=c?.groups.find(x=>x.id===s.group);
    if(!c||!g)return;
    const study=c.family;
    const difference=Math.abs(g.delta).toFixed(5);
    const direction=g.winner==="tie"?"The two methods tied.":g.winner+" had lower mean absolute error by "+difference+" "+c.unit+".";
    return {ids:[study],query:c.label+" "+(study==="flex"?"liquid droplet burning constant FLEX":"BASS-II acrylic rod opposed flame spread")+" held-out model errors",
      answer:`**${c.label} · ${g.id}**\n\n${direction} Across ${g.rows.length} held-out observation(s), lookup MAE was **${g.baseline.toFixed(5)} ${c.unit}** and model MAE was **${g.model.toFixed(5)} ${c.unit}**.\n\nAcross all ${c.groups.length} equally weighted groups, the model reduced MAE by ${c.gain.toFixed(2)}%. This is a reused development evaluation.`+(c.id==="iss"?" Flight specimen grouping is provisional.":"")};
  }
  if(s.kind==="study"){
    const a=studies.find(x=>x.id===s.id),b=studies.find(x=>x.id===s.compare);
    if(!a||(s.compare!==undefined&&(!b||b===a)))return;
    const selected=b?[a,b]:[a];
    const sentence=(text:string)=>text.replace(/[.;\s]+$/,"")+".";
    return {ids:selected.map(x=>x.id),query:selected.map(x=>x.name+" "+x.hardware).join(" compared with "),answer:selected.map(x=>`**${x.name}**\n\n${sentence(x.hardware)}\n\n${sentence(x.conditions)} ${sentence(x.measurement)} ${x.limits}`).join("\n\n")};
  }
  if(s.kind==="application"){
    const a=apps.find(x=>x.id===s.id);
    if(a)return {ids:[a.id,a.study],query:a.name+" "+a.question+" "+a.context,answer:`**${a.question}**\n\n${a.finding}\n\n${a.context}\n\n${a.limit}`};
  }
}
export async function explainAnalytics(result:NonNullable<ReturnType<typeof lookupAnalytics>>, signal:AbortSignal){
  let related:string[]=[];
  let available=false;
  if(hostedIndus()){
    try{
      const {hits}=await retrieveIndus(result.query,"analytics");
      related=hits.filter(hit=>evidence(hit.id)).map(hit=>hit.id);
      available=related.length>0;
    }catch(error){ console.error("Hosted INDUS analytics request failed",error); }
  }else if(process.env.GUIDE_ENCODER_TOKEN){
    try{
      const url=new URL("/retrieve-analytics",process.env.GUIDE_ENCODER_URL??"http://127.0.0.1:8011");
      const res=await fetch(url,{method:"POST",cache:"no-store",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.GUIDE_ENCODER_TOKEN},body:JSON.stringify({question:result.query}),signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
      if(res.ok){
        const payload=await res.json();
        if(Array.isArray(payload.hits)){
          related=payload.hits.filter((h:{id?:string;score?:number})=>typeof h?.id==="string"&&typeof h.score==="number"&&Number.isFinite(h.score)&&evidence(h.id)).map((h:{id:string})=>h.id);
          available=related.length>0;
        }
      }
    }catch{/* The exact chart lookup is independent of the local encoder. */}
  }
  const ids=[...new Set([...result.ids,...related])];
  return {answer:result.answer,origin:"analytics_lookup",status:"verified",retrieval_status:available?"indus":"unavailable",
    evidence:ids.map(id=>{const e=evidence(id)!;return {...e,title:(result.ids.includes(id)?"Selected evidence · ":"INDUS related · ")+e.title};})};
}


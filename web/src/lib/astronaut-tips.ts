import evidence from "@/data/utility-evidence.json";
export type AstronautTip={text:string;context:string;href:string;pages:string[]};
const metricTips:AstronautTip[]=evidence.metrics.map(m=>({text:`${m.label}: ${m.reductionPct.toFixed(1)}% lower error than ${m.baselineName.toLowerCase()}.`,context:`Group MAE · ${m.rows} records · development evaluation`,href:"/training#utility",pages:["/dashboard","/simulation","/training"]}));
export const astronautTips:AstronautTip[]=[
 {text:"Got a condition to check? Click me to chat.",context:"NASA INDUS research + read-only model tools",href:"/training#utility",pages:[]},
 ...metricTips,
 {text:"One workspace for source tables, model errors and flagged records.",context:"Less manual searching is the goal; time savings unmeasured.",href:"/dashboard",pages:["/dashboard"]},
 {text:"11 ISS PMMA rates still carry an inferred-unit flag. We keep that uncertainty visible.",context:"Source transparency · not silently corrected labels",href:"/training#pmma",pages:["/training","/simulation"]},
 {text:"FLEX measures K in mm²/s—not flame speed or extinguisher effectiveness.",context:"A different target from PMMA’s mm/s",href:"/training#flex",pages:["/simulation","/training"]},
 {text:"A realistic flame is no accuracy test. Compare the rate with the measured burn.",context:"3D appearance is illustrative",href:"/simulation?experiment=pmma",pages:["/simulation"]},
 {text:"Can I check your PMMA inputs? I need diameter, oxygen and airflow together.",context:"Joint support check · Earth or ISS",href:"/simulation?experiment=pmma",pages:[]},
 {text:"We keep failed rounds too. Round 4 did not beat the separate Round 2 PMMA models.",context:"Results decide which model stays",href:"/training#pmma",pages:["/training","/dashboard"]},
 {text:"NASA’s FLEX CSV headers needed a documented units and CO₂ correction.",context:"Originals preserved · corrections in derived data only",href:"/training#flex",pages:["/training","/dashboard"]},
];
export function tipsForPage(page:string){return astronautTips.filter(tip=>!tip.pages.length||tip.pages.includes(page));}

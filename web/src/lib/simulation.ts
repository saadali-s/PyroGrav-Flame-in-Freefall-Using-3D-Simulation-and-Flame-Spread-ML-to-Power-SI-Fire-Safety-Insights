import evidence from "@/data/simulation-evidence.json";
export type Environment = "earth" | "microgravity";
export type Conditions = { oxygen: number; diameter: number; flow: number };
export type Observation = typeof evidence.rows[number];
export const observations = evidence.rows;
export const domains = evidence.domains;

/** Development-only aggregate of existing CV fits, never a newly validated model. */
export function estimate(environment: Environment, c: Conditions): { rate: number | null; reason: string } {
  if (![c.oxygen,c.diameter,c.flow].every(Number.isFinite) || c.diameter <= 0 || c.flow <= 0) return {rate:null,reason:"Enter finite, positive diameter and airflow."};
  if (environment === "earth" && ![2,25].some(v=>Math.abs(c.flow-v)<1e-8)) return {rate:null,reason:"Earth observations only cover 2 and 25 cm/s. Flow interpolation is withheld."};
  const domain=evidence.domains[environment];
  if (domain.hull.some(([a,b,d,e])=>a*c.oxygen+b*c.diameter+d*c.flow+e>1e-7)) return {rate:null,reason:"This combination lies outside the observed conditions’ convex hull."};
  const o=c.oxygen-19, logFlow=Math.log(c.flow), x=[o,1/c.diameter,logFlow,o*logFlow];
  const predictions=domain.models.map(m=>Math.exp(m.intercept+x.reduce((sum,v,i)=>sum+(v-m.mean[i])/m.scale[i]*m.coefficients[i],0))).sort((a,b)=>a-b);
  const n=predictions.length;const rate=n%2?predictions[(n-1)/2]:(predictions[n/2-1]+predictions[n/2])/2;
  return Number.isFinite(rate)?{rate,reason:"Inside the observed hull; experimental fold-ensemble estimate, not independently validated."}:{rate:null,reason:"Numerical estimate unavailable."};
}

export function frontDistance(rate: number | null, seconds: number) {
  return rate === null ? 0 : Math.min(50,Math.max(0,rate)*Math.max(0,seconds));
}

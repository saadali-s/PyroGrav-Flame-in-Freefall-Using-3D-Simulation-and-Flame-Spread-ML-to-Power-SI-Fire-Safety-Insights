import provenance from "@/data/pmma-display-provenance.json";
import type { Observation } from "./simulation";
const entries:Record<string,{sample:string;table:string;half:string;row:number;page:number;source_url:string}>=provenance.rows;
export function observationSource(row:Observation){
  const source=entries[row.id];
  return {...source,title:row.environment==="earth"?"Link et al. (2018) · ground baseline":`ISS BASS-II (PSI-25) · printed sample ${source.sample}`,
    locator:`Table ${source.table} · ${source.half} row ${source.row}`};
}
export function observationOption(row:Observation){
  const source=observationSource(row);
  const name=row.environment==="earth"?"Link 2018 ground":`ISS BASS-II · ${source.sample}`;
  return `${name} · ${source.table}, ${source.half} row ${source.row} · ${row.diameter} mm / ${row.oxygen}% O₂ / ${row.flow} cm/s${row.unitFlag?" · unit flag":""}`;
}

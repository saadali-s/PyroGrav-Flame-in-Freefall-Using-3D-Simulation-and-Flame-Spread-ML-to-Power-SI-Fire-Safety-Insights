import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {relevantRecordAudits} from "../src/record-audits.mjs";
test("record audits use the preserved original source hashes and retain conflicting values",()=>{
 const results=relevantRecordAudits("M8 C25 C3a C3b P22b T15");
 assert.equal(results.length,4);
 const originalPaths=["backend/data/raw_papers/bass_ii_summary/TM-20210011385.pdf","backend/data/raw_psi/PSI-25/PSI-25_Experimental table_BASS-II.csv","backend/data/raw_papers/pmma_cylinders_2018/supplementary_info.pdf"];
 const hashes=originalPaths.map(path=>createHash("sha256").update(readFileSync(new URL("../../"+path,import.meta.url))).digest("hex"));
 assert.ok(results.every(a=>a.sources.every(s=>hashes.includes(s.sha256))));
 for(const value of ["0.057","0.0637","39.1","19.1","239","236","80122","80, 122","flight-C3"])
  assert.ok(JSON.stringify(results).includes(value));
 assert.equal(relevantRecordAudits("Hello").length,0);
});

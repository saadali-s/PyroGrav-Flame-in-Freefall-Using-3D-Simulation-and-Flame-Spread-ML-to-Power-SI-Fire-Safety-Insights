// Curated source findings. Not model-generated facts, new labels, or automatic cleaning rules.
const report={url:"https://ntrs.nasa.gov/citations/20210011385",sha256:"5ffa911fd9b6356f204646003fb9342e341810dcdfdf5cb15756e7f01ec5f770"};
const csv={url:"https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",sha256:"71e792bf6b5fb5ea620c5dd70fbbac05515992e12aefcf5dff47312caa48c042"};
const supplement={url:"https://static-content.springer-cdn.com/esm/art%3A10.1038%2Fs41598-017-18398-4/MediaObjects/41598_2017_18398_MOESM1_ESM.pdf",sha256:"e17c9511c4b4b253cd0795b3984ffb9347ad5db6354c4ce792adcaf805f21b23"};
const audits=[
 {key:"M8",pattern:/\bM8\b/i,title:"M8 slab: grouped stages and table/figure conflict",
  findings:["Table 5.1: M8 is a 2 mm thick, 1.2 cm wide PMMA slab, burning on two sides. Flows 10, 6, 5 cm/s; tabulated rates 0.057, 0.056, 0.040 mm/s. Initial/final O2 19.1/18.2 vol%; these endpoints are not per-stage oxygen labels.",
   "Figure 5.2 fit slopes at the respective flows are 0.0637, 0.0557, 0.0391 mm/s. First-stage table/fit disagreement is unresolved (0.057 versus 0.0637); preserve both. All three stages are one M8 burn, not three independent tests."],
  disposition:"Do not add to the black cylindrical rod matrix. Retain in a separate slab review cohort; group by burn/specimen, preserve geometry and oxygen trajectory, and resolve source conflict before selecting labels.",
  sources:[{...report,locator:"PDF p65 / printed p57: Table 5.1 and Figure 5.2"}]},
 {key:"clear-pmma",pattern:/\b(C25|C3a|C3b|clear\s+PMMA)\b/i,title:"Clear PMMA segments: separate material cohort and specimen grouping",
  findings:["Link Table S1 labels C25, C3a and C3b as clear PMMA. Six segments: three C25, two C3a, one C3b; not six independent specimens. Frozen grouping: flight-C25 for C25, flight-C3 jointly for C3a and C3b, conservatively combining a/b labels; the crosswalk remains incomplete.",
   "C25: 9.5 mm, 20.9% O2; flows 1.58/1.52/1.48 cm/s; rates 0.0609/0.0550/0.0559 mm/s under directly printed scaled cm/s. C3a: 6.4 mm, 17.7% O2, flows 2.5/2.0 cm/s; adopted rates 0.0837/0.0642 mm/s. C3b: 6.4 mm, 17.4% O2, 1.85 cm/s; adopted rate 0.0600 mm/s.",
   "C3 right-half rates have U01: printed scaled mm/s would give 0.00837/0.00642/0.00600 mm/s, ten times smaller than the adopted inference. No author-issued correction. All six have M01 (clear material excluded from black-PMMA cohort)."],
  disposition:"Do not add to the current clean black-PMMA matrix. Retain as a separate clear-PMMA cohort; group repeated segments as above and preserve U01. Adding material as a feature would require a newly reviewed experiment, not silent pooling.",
  sources:[{...supplement,locator:"Table S1 p1: left rows 13–15; right rows 12–13 and 20"}]},
 {key:"P22b",pattern:/\bP22[ab]\b|39\.1/i,title:"P22b: source oxygen anomaly, CO conflict and reused specimen",
  findings:["PSI-25 CSV row 98 (header row 1) reports P22b final calibrated O2=39.1 vol%. The report also prints 39.1, alongside uncalibrated final O2=19.1 and calibrated initial O2=20.0. This is a source-level unresolved anomaly, not a CSV-only typo. Do not silently replace 39.1 with 19.1.",
   "Final CO is 239 ppm in CSV versus 236 ppm in report Table A.3. P22a and P22b both identify sample 200m, so treat them as shared-specimen runs for grouping. P22a also has anomalous calibrated final O2=0.6 in both sources.",
   "The PSI-25 CSV is a campaign log with no measured spread-rate target column; its rows are not additional labeled rate observations."],
  disposition:"Quarantine anomalous quantitative fields pending primary-record reconciliation. Preserve raw values; join as provenance metadata only, with shared-specimen grouping. Do not admit as an independent training rate row.",
  sources:[{...report,locator:"PDF p115 / printed p107: Appendix A, Table A.3, P22a/P22b"},{...csv,locator:"Experimental table_BASS-II.csv: row 98 P22b (header counted)"}]},
 {key:"T15",pattern:/\bT15\b|80122/i,title:"T15: collapsed display list, different fuel and no rate label",
  findings:["PSI-25 CSV row 115 (header row 1), T15, stores Fan display as 80122. Report Table A.6 prints 80, 122: two display entries, not a flow of 80122 cm/s. Air display is 9, 29; the report notes an initial transient reading of 15, about 9 cm/s after stabilization, and a maximum of 29 cm/s with no blowoff attained.",
   "T15 is sample 138, 2 cm SIBAL, not a PMMA rod. CSV has no measured spread-rate target. Fan display and calibrated air velocity are distinct fields."],
  disposition:"Quarantine the collapsed numeric interpretation. A documented derived metadata record may preserve fan display [80,122] and the separate airflow observations; do not treat the settings as independent burns or add T15 to the black-PMMA rate matrix.",
  sources:[{...report,locator:"PDF p120 / printed p112: Appendix A, Table A.6, T15"},{...csv,locator:"Experimental table_BASS-II.csv: row 115 T15 (header counted)"}]},
];
export function relevantRecordAudits(question){return audits.filter(a=>a.pattern.test(question)).map(({pattern,...record})=>record);}

# Raw evidence collection

All files here are source material, not an approved training dataset. The 2026-11-13 audit inspected the original 16 backend files and 38 research_papers files, then added 18 unchanged useful source copies. Original downloads were preserved.

Read [the current audit](../../docs/data-audit-2026-11-13/README.md), [individual file decisions](../../docs/data-audit-2026-11-13/file-by-file.md), and [copy manifest](../../docs/data-audit-2026-11-13/copy-manifest.json) before using any file.

Three .pdf files contain HTML challenge pages. Several CSVs have inconsistent units, errors, missing fields, repeated records, or no prediction target. Do not glob this folder into a training pipeline or infer trust from file extensions/names. Raw copies are deliberately unchanged, including their defects.

The valid PMMA main paper is `raw_papers/pmma_cylinders_2018/Link_2018_Effect_of_Gravity_PMMA_valid.pdf`. Its supplement is valid but needs the documented unit decision. Original bad downloads remain for the user to remove if desired.

Core solid-combustion sources, optional droplet/burner outcomes and optional smoke sources have distinct experimental meanings. Copying them into one folder does not make their targets compatible. Any future curated output must be separate from raw sources and trace each value to source, run, units and transformation.

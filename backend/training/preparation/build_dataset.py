"""Compile v1 measured PMMA candidates. Does not fit models or alter raw sources.

Requires pdfplumber (available in the bundled document Python runtime).
Run from any directory. Outputs only beneath backend/training and named web snapshots.
"""
from pathlib import Path
from decimal import Decimal
from collections import Counter, defaultdict
import csv
import hashlib
import json
import re
import shutil
import pdfplumber

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'backend/training/datasets/pmma-v1'
PUBLIC = ROOT / 'web/public/training/pmma-v1'
SUPP = ROOT / 'backend/data/raw_papers/pmma_cylinders_2018/supplementary_info.pdf'
VERSION = 'pmma-v1-2026-11-14'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decimal(value, multiplier=1):
    return float(Decimal(str(value)) * Decimal(str(multiplier)))

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

def write_csv(name, rows):
    assert rows
    with (OUT / name).open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    originals = {p.relative_to(ROOT).as_posix(): digest(p)
                 for p in (ROOT / 'backend/data').rglob('*') if p.is_file()}
    assert digest(SUPP) == 'e17c9511c4b4b253cd0795b3984ffb9347ad5db6354c4ce792adcaf805f21b23'
    sources = [
        dict(source_id='link2018_supp', path=SUPP.relative_to(ROOT).as_posix(),
             url='https://static-content.springer-cdn.com/esm/art%3A10.1038%2Fs41598-017-18398-4/MediaObjects/41598_2017_18398_MOESM1_ESM.pdf',
             version='2018 publisher supplement; 4 pages', locator='Tables S1/S2, PDF pp1–2',
             investigation_id='PSI-25 (flight); Link 2018 ground experiment', evidence='published experimental segments and means'),
        dict(source_id='link2018_main', path='backend/data/raw_papers/pmma_cylinders_2018/Link_2018_Effect_of_Gravity_PMMA_valid.pdf',
             url='https://doi.org/10.1038/s41598-017-18398-4', version='Scientific Reports 8:120 (2018)',
             locator='Methods pp3–4; Figures 5–6 p5', investigation_id='PSI-25 and companion ground study', evidence='experimental methods and unit corroboration'),
        dict(source_id='bass2021', path='backend/data/raw_papers/bass_ii_summary/TM-20210011385.pdf',
             url='https://ntrs.nasa.gov/citations/20210011385', version='NASA/TM-20210011385; 144 PDF pages',
             locator='Appendix A, PDF p114 / printed p106', investigation_id='PSI-25', evidence='campaign log; probable sample crosswalk, not extra labels'),
        dict(source_id='luci2025', path='backend/data/raw_papers/luci_2025/ASGSR_2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf',
             url='https://ntrs.nasa.gov/api/citations/20250010653/downloads/ASGSR%202025-LUCI-Ferkul-Presentation-v2-20250010653.pdf',
             version='ASGSR 2025 presentation v2; NTRS 20250010653', locator='PDF pp16,19–22,29,33,36,43',
             investigation_id='LUCI NS-29', evidence='fits of real partial-gravity and ground burns; reference only'),
    ]
    for source in sources:
        source['sha256'] = digest(ROOT / source['path'])
        source['reviewed_date'] = '2026-11-14'
    with pdfplumber.open(SUPP) as pdf:
        tables = [page.extract_tables()[0] for page in pdf.pages[:2]]
    assert len(tables[0]) == 27 and len(tables[1]) == 24
    write_json(OUT / 'source_tables.json', tables)
    rows = []
    for table_index, (table, width) in enumerate(zip(tables, [6, 5]), 1):
        for half in range(2):
            carried = [None] * width
            segments = Counter()
            for line, cells in enumerate(table[1:], 1):
                part = cells[half * width:(half + 1) * width]
                fill_count = 3 if table_index == 1 else 2
                for col, value in enumerate(part):
                    if value is not None:
                        carried[col] = value
                    elif col >= fill_count:
                        raise ValueError(f'Unexpected blank numeric cell: S{table_index} {half} {line} {col}')
                # Two oxygen values share an unruled cell. Verified against the rendered S2 table.
                if table_index == 2 and half == 0 and line in [18, 19]:
                    carried[1] = '18.5' if line == 18 else '18.2'
                diameter, oxygen = carried[:2]
                sample = carried[2] if table_index == 1 else ''
                flow = carried[3] if table_index == 1 else carried[2]
                rate = carried[5] if table_index == 1 else carried[3]
                duration = int(carried[4]) if table_index == 1 else None
                uncertainty = None if table_index == 1 or carried[4] == '-' else float(carried[4])
                segments[sample] += 1
                color = ('black' if sample.startswith('B') else 'clear' if sample.startswith('C') else 'unknown') if table_index == 1 else 'black'
                group = ('flight-' + re.sub('[ab]$', '', sample)) if table_index == 1 else f'ground-d{diameter}-o{oxygen}'
                flags = []
                reason = 'Black PMMA rate; proposed first-model candidate, subject to user review.'
                status = 'candidate'
                if table_index == 1 and half == 1:
                    flags.append('U01')
                if color == 'clear':
                    flags.append('M01'); status = 'review'; reason = 'Clear PMMA retained separately; excluded from the first black-PMMA model.'
                if color == 'unknown':
                    flags.append('M02'); status = 'review'; reason = 'P17 color is not established by the S1 B/C convention or p114 log; no guessed black label.'
                if sample in ['B16', 'B19']:
                    flags.append('F01'); status = 'review'; reason = 'Paper says opposed; probable P16/P19 log matches say concurrent. Reserve for explicit sensitivity analysis after crosswalk review.'
                if sample == 'B15':
                    flags.append('O01'); status = 'review'; reason = 'S1 reports 18.4% oxygen; probable P15 log match on report p114 gives initial18.0%. Withheld pending crosswalk/oxygen definition.'
                if rate == '-':
                    flags.append('Y01'); status = 'review'; reason = 'Printed dash has no numeric rate. Not converted to zero or an extinction class.'
                if table_index == 2 and diameter == '0.64' and oxygen == '18.0' and flow == '2':
                    flags.append('D01'); status = 'review'; reason = 'Two identical printed conditions give 4.69 and 3.13. Both withheld without averaging or selecting one.'
                if sample in ['B13a', 'B13b']:
                    flags.append('G01')
                if table_index == 2:
                    flags.append('G02')
                row = dict(
                    observation_id=f'S{table_index}-{"L" if half == 0 else "R"}-{line:02}',
                    dataset_version=VERSION, source_id='link2018_supp', source_sha256=sources[0]['sha256'],
                    source_url=sources[0]['url'], source_page=table_index, source_table=f'S{table_index}',
                    source_half='left' if half == 0 else 'right', source_row=line,
                    investigation_id='PSI-25' if table_index == 1 else 'Link2018-ground',
                    environment='microgravity' if table_index == 1 else 'earth',
                    gravity_g_nominal=0 if table_index == 1 else 1,
                    gravity_note='Microgravity category encoded 0; not measured exact acceleration.' if table_index == 1 else 'Normal gravity category.',
                    material='PMMA', color=color, geometry='rod', sample_label=sample or None,
                    segment_index=segments[sample] if table_index == 1 else None, group_id=group,
                    group_basis='Conservative printed specimen label; a/b combined; crosswalk incomplete.' if table_index == 1 else 'Diameter/oxygen condition block; actual replicate specimen IDs unavailable.',
                    diameter_reported_cm=float(diameter), diameter_mm=decimal(diameter, 10),
                    oxygen_pct=float(oxygen), oxygen_definition='Reported condition volume percent; not resolved segment sensor history.',
                    opposed_flow_cms=float(flow), flow_configuration='opposed_as_reported_in_Link2018',
                    pressure_kpa=None, duration_s=duration,
                    target_definition='quasi_steady_flame_leading_edge_spread_rate',
                    reported_rate_text=rate,
                    printed_scaled_rate_unit='Vf*1000 (mm/s)' if table_index == 1 and half == 1 else 'Vf*1000 (cm/s)',
                    adopted_rate_unit='mm/s', conversion_factor=0.01,
                    rate_mms=None if rate == '-' else decimal(rate, '.01'),
                    unit_basis='Inferred correction: S1 right header conflicts with main p5 Figures 5/6 and supplement p2 Figure S1.' if table_index == 1 and half == 1 else 'Direct printed scaled cm/s conversion.',
                    uncertainty_reported_pct=uncertainty, uncertainty_kind='unspecified source +/- percent' if uncertainty is not None else 'not reported',
                    replicate_count_min=3 if table_index == 2 else None,
                    observation_kind='reported_segment_rate' if table_index == 1 else 'reported_mean_at_least_3_tests',
                    evidence_status='published_measurement_with_documented_conversion',
                    review_status=status, review_flags=';'.join(flags), disposition_reason=reason,
                    training_authorized=False, lunar_validation_eligible=False,
                )
                rows.append(row)
    assert len(rows) == 98 and sum(r['rate_mms'] is not None for r in rows) == 89
    by_id = {r['observation_id']: r for r in rows}
    # Independent source-image anchors catch scale, joined-cell and missing-label errors.
    assert by_id['S1-L-01']['rate_mms'] == .0523
    assert by_id['S1-R-07']['sample_label'] == 'B16' and by_id['S1-R-07']['rate_mms'] == .0762
    assert by_id['S2-L-18']['oxygen_pct'] == 18.5 and by_id['S2-L-18']['rate_mms'] == .059
    assert by_id['S2-L-19']['oxygen_pct'] == 18.2 and by_id['S2-L-19']['rate_mms'] is None
    assert by_id['S2-R-12']['rate_mms'] == .2357
    assert by_id['S2-L-20']['review_flags'].startswith('D01')
    assert by_id['S2-L-21']['review_flags'].startswith('D01')
    assert by_id['S1-L-01']['group_id'] == by_id['S1-L-05']['group_id']
    candidates = [r for r in rows if r['review_status'] == 'candidate']
    review = [r for r in rows if r['review_status'] == 'review']
    assert len(candidates) == 69 and len(review) == 29
    assert Counter(r['environment'] for r in candidates) == {'earth':35,'microgravity':34}
    assert all(r['color'] == 'black' and r['rate_mms'] > 0 for r in candidates)
    assert not any(r['training_authorized'] for r in rows)
    write_csv('observations.csv', rows)
    write_csv('candidate_training.csv', candidates)
    write_csv('review_queue.csv', review)
    write_csv('sources.csv', sources)
    decisions = [
        dict(code='U01', disposition='Documented inference; compare strict-unit subset in sensitivity analysis.',
             evidence='Supplement p1 right says scaled mm/s; main p5 Figures 5/6 and supplement p2 Figure S1 support scaled cm/s. Adopt displayed value ×0.01 mm/s, not ×0.001. No author erratum.', affected_rows=sum('U01' in r['review_flags'] for r in rows)),
        dict(code='M01', disposition='Separate material color; withhold from black-PMMA first model.', evidence='S1 caption explicitly distinguishes B black and C clear; main p3 discusses radiation differences.', affected_rows=6),
        dict(code='M02', disposition='Withhold ambiguous sample color.', evidence='S1 prints P17; NASA report p114 says rod without color. Do not silently relabel B17.', affected_rows=3),
        dict(code='F01', disposition='Withhold pending crosswalk; optional expanded-cohort experiment later.', evidence='Link p4 Fig4/p5 Fig6 identify B16/B19 as opposed. NASA report p114 P16/P19 (matching oxygen and flow patterns) says Concurrent. B/P crosswalk probable, not certified.', affected_rows=8),
        dict(code='O01', disposition='Withhold pending crosswalk and oxygen reconciliation.', evidence='S1 B15 at18.4% versus probable report p114 P15 initial18.0%. Keep original values; do not substitute either automatically.', affected_rows=1),
        dict(code='Y01', disposition='Keep as missing, not zero or a class label.', evidence='Nine S2 rows contain dashes; no row-specific outcome definition adopted.', affected_rows=9),
        dict(code='D01', disposition='Withhold both duplicate-condition means.', evidence='S2 left rows20/21: d=.64cm, O2=18%, flow2cm/s; rates4.69/3.13; unresolved source entry.', affected_rows=2),
        dict(code='G01', disposition='Keep B13a/b in one conservative specimen group.', evidence='NASA report p114 P13a/b share specimen203m; probable matching labels and oxygen. No random segment splitting.', affected_rows=6),
        dict(code='G02', disposition='One row per published mean; group related conditions; no invented replicates.', evidence='S2 caption: average of at least three tests. +/- percent lacks SD/SE definition; specimen IDs unavailable.', affected_rows=46),
        dict(code='P01', disposition='Leave pressure blank; not a first-model feature.', evidence='No numerical per-row pressure column in S1/S2. No 101.325kPa default inserted.', affected_rows=98),
    ]
    write_csv('review_decisions.csv', decisions)
    lunar = []
    for material, target, page, values, unit in [
        ('PMMA','flame_tip_growth_rate',36,[.15,.40],'cm/s'),
        ('SIBAL','flame_base_spread_rate',33,[.9,1.5],'mm/s'),
        ('SIBAL','flame_tip_spread_rate',33,[1.1,2.8],'mm/s'),
    ]:
        for i, value in enumerate(values):
            lunar.append(dict(reference_id=f'LUCI-{material}-{target}-{"partial" if i == 0 else "earth"}',
                source_id='luci2025', source_sha256=sources[3]['sha256'], source_url=sources[3]['url'], source_page=page,
                material=material, target_definition=target, environment='simulated_lunar_gravity' if i == 0 else 'earth',
                nominal_gravity_g=.16 if i == 0 else 1,
                gravity_basis='Nominal lunar-like centrifugal acceleration; not a constant measured time history.' if i == 0 else 'Ground comparison.',
                diameter_mm=4 if material == 'PMMA' else None,
                direction='upward' if material == 'PMMA' else 'downward',
                reported_value=value, reported_unit=unit, rate_mms=decimal(value,10) if unit == 'cm/s' else value,
                independent_group='LUCI-flight-shared-chamber' if i == 0 else f'LUCI-ground-{material}-unknown-specimen',
                oxygen_pct=None, pressure_kpa=None, imposed_flow_cms=None, uncertainty=None,
                evidence_status='published_fit_to_real_burn', training_authorized=False,
                compatible_with_pmma_target=False,
                incompatibility='Upward flame-tip growth; Link uses opposed leading-edge spread. Different diameter/color knowledge, chamber and oxygen histories; no validated conversion.' if material == 'PMMA' else 'Different material/geometry/target; no SIBAL training cohort compiled.',
                notes='Ground tip is rounded to4.0mm/s on p36 versus~3.95 on p29. PMMA base is transient (p20/43), not a second constant-rate label.' if material == 'PMMA' else 'Partial base rounded .9 on p33 versus .92 on p19. Same burn, not an additional observation.'))
    write_csv('luci_reference_only.csv', lunar)
    groups = []
    for group in sorted({r['group_id'] for r in rows}):
        members = [r for r in rows if r['group_id'] == group]
        groups.append(dict(group_id=group, environment=members[0]['environment'],
                           all_rows=len(members), candidate_rows=sum(r['review_status']=='candidate' for r in members),
                           observation_ids=';'.join(r['observation_id'] for r in members),
                           basis=members[0]['group_basis'], split='unassigned'))
    write_csv('groups.csv', groups)
    def ranges(subset):
        return {field: [min(r[field] for r in subset),max(r[field] for r in subset)]
                for field in ['diameter_mm','oxygen_pct','opposed_flow_cms','rate_mms']}
    summary = dict(version=VERSION, date='2026-11-14', status='Candidate data review; no model trained',
        total_rows=len(rows), numeric_rates=89, candidate_rows=len(candidates), review_rows=len(review),
        flight_rows=52, ground_rows=46, candidate_flight_rows=34, candidate_ground_rows=35,
        candidate_flight_groups=len({r['group_id'] for r in candidates if r['environment']=='microgravity'}),
        candidate_ground_condition_groups=len({r['group_id'] for r in candidates if r['environment']=='earth'}),
        strict_printed_unit_candidates=sum('U01' not in r['review_flags'] for r in candidates),
        unit_inference_candidates=sum('U01' in r['review_flags'] for r in candidates),
        lunar_reference_rows=len(lunar), compatible_lunar_test_rows=0, trained_models=0,
        range_all=ranges(candidates), ranges={env:ranges([r for r in candidates if r['environment']==env]) for env in ['earth','microgravity']},
        limitations=['Rows are segments or means, not independent burns.',
                     'Gravity is confounded with apparatus, flow range and sampling procedure.',
                     'Current LUCI reference targets cannot directly validate this opposed-spread model.',
                     'Data compilation tests feasibility; it does not establish lunar accuracy.'])
    write_json(OUT / 'summary.json', summary)
    # Inventory all raw sources for traceability, without pretending every source has a common label.
    write_json(OUT / 'raw_data_manifest.json', originals)
    for path, expected in originals.items():
        assert digest(ROOT / path) == expected, f'Raw file changed: {path}'
    exports = [p for p in OUT.glob('*.csv')]
    for p in exports:
        shutil.copyfile(p, PUBLIC / p.name)
    snapshot = dict(summary=summary, observations=rows, lunar=lunar, decisions=decisions, sources=sources,
                    downloads=[dict(name=p.name,sha256=digest(p)) for p in exports])
    write_json(ROOT / 'web/src/data/training-v1.json', snapshot)
    manifest = {p.name:digest(p) for p in OUT.iterdir() if p.is_file() and p.name not in ['manifest.json','validation.json']}
    write_json(OUT / 'manifest.json', manifest)
    validation = dict(passed=True, raw_files_unchanged=len(originals), rows=98, numeric=89,
                      candidates=69, review=29, duplicate_observation_ids=0,
                      synthetic_labels=0, models_trained=0, lunar_reference_rows_excluded=6,
                      public_csv_hashes_match=all(digest(p)==digest(PUBLIC/p.name) for p in exports),
                      extraction_engine=f'pdfplumber {pdfplumber.__version__}',
                      builder_sha256=digest(Path(__file__)),
                      checked='Rendered both source tables and main p5; LUCI p20/33/36; source-row anchors, merged cells, missing values, groups, counts, conversions and raw preservation.')
    assert len(by_id) == 98
    write_json(OUT / 'validation.json', validation)
    print(json.dumps(dict(summary=summary, validation=validation), indent=2))

if __name__ == '__main__':
    build()

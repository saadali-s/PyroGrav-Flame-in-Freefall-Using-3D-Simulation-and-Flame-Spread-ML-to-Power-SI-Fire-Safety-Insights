"""Source-linked FLEX rate cohort; preserve raw bytes and all review rows."""
import csv, hashlib, json, re
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'backend/training/datasets/flex-v1'
RAW=ROOT/'backend/data/raw_psi/PSI-69/PSI-69_Experimental table_FLEX.csv'
PDF=ROOT/'backend/data/raw_papers/flex_2015/20150023456.pdf'
TEXT=ROOT/'tmp/browser-evidence-2026-11-13/20150023456.pdf.txt'
assert not OUT.exists(),'Refusing overwrite'
source=[]
for page in range(26,35):
    text=TEXT.read_text(encoding='utf8').split(f'=== PDF PAGE {page} ===')[1].split('=== PDF PAGE')[0]
    for line in text.splitlines():
        m=re.match(r'FLEX[–−]\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(Heptane|Methanol)\s+(.*)',line)
        if m:
            tokens=m[6].split();assert len(tokens)==10
            source.append(dict(id=int(m[1]),identifier=m[2],date=m[3],time=m[4],fuel=m[5],values=tokens[:9],end=tokens[9],page=page))
assert len(source)==276
raw=list(csv.DictReader(RAW.open()));assert len(raw)==274
def number(v):
    try:return float(v)
    except (ValueError,TypeError):return None
records=[]
for r in raw:
    vals=[number(r[k]) for k in list(r)[5:14]]
    key=[s for s in source if s['identifier']==r['FLEX Identifier'] and (s['time']==r['Test GMT'] or s['time']=='–' and not r['Test GMT'])]
    exact=[s for s in key if [number(v) for v in s['values']]==vals and s['fuel']==r['Fuel'] and s['end']==r['Test end']]
    flags=[]
    if len(exact)!=1:flags.append('no_unique_full_value_match')
    if len(key)>1:flags.append('ambiguous_identifier_time')
    matched=exact[0] if len(exact)==1 else None
    pressure,o2,n2,co2,he,d0,dext,k,burn=vals
    if pressure is None or pressure<=0:flags.append('invalid_pressure')
    if any(v is None or v<0 or v>1 for v in [o2,n2,co2,he]):flags.append('invalid_composition')
    elif abs(o2+n2+co2+he-1)>.011:flags.append('composition_sum_outside_rounding_tolerance')
    if d0 is None or d0<=0:flags.append('missing_initial_diameter')
    if k is None or k<=0:flags.append('missing_positive_burning_rate')
    if r['Test end']=='Disruption':flags.append('disrupted_trial_excluded_from_primary')
    if r['Test end'] not in ['Extinction','Completion','Disruption']:flags.append('unrecognized_end')
    # Pressure bins only define conservative validation groups; recorded pressure is never changed.
    group='|'.join(map(str,[r['Fuel'],round(pressure/76) if pressure else None,o2,n2,co2,he]))
    records.append(dict(id=f"csv-{r['FLEX Test #']}",source_test=f"FLEX-{matched['id']:03}" if matched else None,identifier=r['FLEX Identifier'],date=r['Test Date'],time=r['Test GMT'],fuel=r['Fuel'],pressure_mmhg=pressure,o2=o2,n2=n2,co2=co2,he=he,diameter_mm=d0,extinction_diameter_mm=dext,burning_rate_mm2s=k,burn_time_s=burn,test_end=r['Test end'],group=group,source_page=matched['page'] if matched else None,review_flags=flags,accepted=not flags))
accepted=[r for r in records if r['accepted']]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
summary=dict(raw_rows=len(raw),numeric_rates=sum(r['burning_rate_mm2s'] is not None for r in records),original_appendix_rows=len(source),accepted=len(accepted),review=len(records)-len(accepted),condition_groups=len({r['group'] for r in accepted}),dates=len({r['date'] for r in accepted}),flags=dict(Counter(f for r in records for f in r['review_flags'])),accepted_by_fuel=dict(Counter(r['fuel'] for r in accepted)),accepted_with_co2=sum(r['co2']>0 for r in accepted),accepted_with_he=sum(r['he']>0 for r in accepted),raw_sha256=sha(RAW),pdf_sha256=sha(PDF),target='Reported average slope magnitude of diameter squared versus time, mm²/s, Table IX. No extinction classifier.',source_url='https://ntrs.nasa.gov/citations/20150023456',source_definition='PDF p25/printed19; Table IX pp26–34/printed20–28',limitations=['Conditional on recorded positive rates and non-disrupted trials; not all attempted burns.','Initial nominal O2/N2/CO2/He composition; no normalization or assumed gas correction.','Support-fiber, translation and residual-motion metadata not encoded in this summary; confounding remains.','Pressure bin0.1atm defines validation groups only; original mmHg retained as feature.','Visible extinction is not a verified cessation of all combustion.','No causal suppressant ranking, discharge dynamics or spacecraft extinguisher design.'])
OUT.mkdir(parents=True)
(OUT/'data.json').write_text(json.dumps(dict(summary=summary,rows=records),indent=2)+'\n')
for name,rr in [('candidate_training.csv',accepted),('review_queue.csv',[r for r in records if not r['accepted']])]:
    with (OUT/name).open('w',newline='',encoding='utf8') as f:
        w=csv.DictWriter(f,fieldnames=list(rr[0]));w.writeheader();w.writerows([{**r,'review_flags':';'.join(r['review_flags'])} for r in rr])
(OUT/'manifest.json').write_text(json.dumps({p.name:sha(p) for p in OUT.iterdir() if p.is_file()},indent=2)+'\n')
print(json.dumps(summary,indent=2));print('Unmatched:',[(r['id'],r['identifier']) for r in records if 'no_unique_full_value_match' in r['review_flags']])

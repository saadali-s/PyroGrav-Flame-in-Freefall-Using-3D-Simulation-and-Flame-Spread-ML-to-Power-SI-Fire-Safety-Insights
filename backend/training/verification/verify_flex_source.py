"""Fresh PDF extraction to check the derived accepted rows against original Table IX."""
import hashlib,json,re
from datetime import datetime
from pathlib import Path
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[3]
PDF=ROOT/'backend/data/raw_papers/flex_2015/20150023456.pdf'
data=json.loads((ROOT/'backend/training/datasets/flex-v1/data.json').read_text())
assert hashlib.sha256(PDF.read_bytes()).hexdigest()==data['summary']['pdf_sha256']
reader=PdfReader(PDF);original={}
for page in range(26,35):
    for line in reader.pages[page-1].extract_text().splitlines():
        m=re.match(r'FLEX[–−]\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(Heptane|Methanol)\s+(.*)',line)
        if m:original[f'FLEX-{int(m[1]):03}']=(m,page)
assert len(original)==276
accepted=[r for r in data['rows'] if r['accepted']];assert len({r['source_test'] for r in accepted})==len(accepted)
keys=['pressure_mmhg','o2','n2','co2','he','diameter_mm','extinction_diameter_mm','burning_rate_mm2s','burn_time_s']
def date(s):
    return datetime.strptime(s,'%m/%d/%Y' if len(s.split('/')[-1])==4 else '%m/%d/%y').date()
def number(v):
    try:return float(v)
    except ValueError:return None
for r in data['rows']:
    m,page=original[r['source_test']]
    assert page==r['source_page'];assert r['identifier']==m[2] and r['fuel']==m[5]
    assert r['time']==m[4] or not r['time'] and m[4]=='–'
    assert date(r['date'])==date(m[3])
    assert [r[k] for k in keys]==[number(v) for v in m[6].split()[:9]]
    assert r['test_end']==m[6].split()[9]
date_forms={}
for r in accepted:date_forms.setdefault(str(date(r['date'])),set()).add(r['date'])
assert all(len(v)==1 for v in date_forms.values()),'Date spelling creates artificial groups'
out=dict(passed=True,pdf_rows=len(original),csv_rows_verified=len(data['rows']),accepted_rows_verified=len(accepted),unique_accepted_source_ids=len(accepted),normalized_dates=len(date_forms),pdf_sha256=data['summary']['pdf_sha256'],definition_page=25,table_pages=[26,34])
(ROOT/'backend/training/reports/flex-source-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))

"""Recover reporting from saved fits without training or changing predictions."""
import csv
import json
from pathlib import Path
import train_round2 as run

assert not (run.OUT/'results.json').exists(), 'Refuse to replace a published result'
assert run.base.sha(run.PROTOCOL)==run.base.sha(run.OUT/'protocol.json')
env=json.loads((run.OUT/'environment.json').read_text())
archived=run.OUT/'training-script-as-run.py'
assert run.base.sha(archived)==env['script_sha256']
expected_source=archived.read_text().replace('dict(outside_training_box=outside,','dict(outside_subset=outside,')
assert Path(run.__file__).read_text()==expected_source
fits=json.loads((run.OUT/'fit-log.json').read_text())
assert len(fits)==148
predictions=list(csv.DictReader((run.OUT/'heldout_predictions.csv').open()))
assert len(predictions)==504
numbers=['oxygen_pct','diameter_mm','opposed_flow_cms','observed_mms','raw_predicted_mms','predicted_mms','predicted_log_rate','smear_factor','error_mms','absolute_error_mms']
for row in predictions:
    for key in numbers: row[key]=float(row[key])
    for key in ['outside_training_box','unit_inference']:
        assert row[key] in ['True','False']
        row[key]=row[key]=='True'
original_hashes=json.loads((run.OUT/'round1-hashes.json').read_text())
raw_hashes=json.loads((run.DATA/'raw_data_manifest.json').read_text())
for name,expected in {**original_hashes,**raw_hashes}.items(): assert run.base.sha(run.ROOT/name)==expected
# The only correction renames a duplicate keyword in a descriptive subgroup.
run.base.write_json(run.OUT/'reporting-recovery.json',dict(reason='Duplicate outside_training_box keyword in subgroup summary',training_rerun=False,predictions_changed=False,original_script_sha256=env['script_sha256'],corrected_script_sha256=run.base.sha(Path(run.__file__))))
source=Path(run.__file__).read_text()
section=source.split("    old=json.loads",1)[1].split("\nif __name__",1)[0]
section='old=json.loads'+section
section='\n'.join(line[4:] if line.startswith('    ') else line for line in section.splitlines())
namespace=vars(run).copy()
namespace.update(predictions=predictions,fits=fits,env=env,original_hashes=original_hashes,raw_hashes=raw_hashes)
exec(compile(section,'round2-report-recovery','exec'),namespace)

"""Rebuild paired development results and audit slices from immutable inputs."""
import csv
import json
import math
from pathlib import Path
from statistics import mean

WEB = Path(__file__).resolve().parents[1]
DATA = WEB / "src/data"
DATASETS = WEB.parent / "backend/training/datasets"


def read_json(name):
    return json.loads((DATA / (name + ".json")).read_text(encoding="utf8"))


def unique(rows, key):
    result = {key(row): row for row in rows}
    assert len(result) == len(rows), "Duplicate observation or prediction key"
    return result


def compile_data():
    first, second, flex = map(read_json, ["training-round1", "training-round2", "flex-v1"])
    with (DATASETS / "pmma-v1/observations.csv").open(encoding="utf-8-sig") as source:
        pmma = list(csv.DictReader(source))
    records = {
        "pmma": [dict(id=r["observation_id"], name=r["sample_label"] or r["observation_id"],
                      eligible=r["review_status"] == "candidate", flags=r["review_flags"],
                      reason=r["disposition_reason"], locator=f'Table {r["source_table"]}, {r["source_half"]} row {r["source_row"]}',
                      url=r["source_url"], observed=float(r["rate_mms"]) if r["rate_mms"] else None) for r in pmma],
        "flex": [dict(id=r["id"], name=r["source_test"], eligible=r["accepted"], flags=", ".join(r["review_flags"]),
                      reason=", ".join(r["review_flags"]).replace("_"," ") or "Eligible burning-constant measurement",
                      locator=f'Table IX, PDF p{r["source_page"]} · {r["source_test"]}',
                      url="https://ntrs.nasa.gov/citations/20150023456", observed=r["burning_rate_mm2s"]) for r in flex["rows"]]
    }
    assert [(len(v), sum(r["eligible"] for r in v)) for v in records.values()] == [(98,69),(274,198)]
    assert sum(r["observed"] is not None for r in records["flex"]) == 258
    cohorts = []
    for cohort, label, evaluation, expected in [
        ("iss","ISS PMMA","microgravity_logo",(34,11,10,51.26)),
        ("earth","Earth PMMA","earth_logo",(35,19,17,40.58)),
        ("flex","FLEX droplets","condition_group_5fold",(198,79,52,25.76))]:
        liquid = cohort == "flex"
        family = "flex" if liquid else "pmma"
        ref = unique(records[family], lambda row: row["id"])
        fields = ("id","group","fold","observed","predicted") if liquid else ("observation_id","group_id","fold_id","observed_mms","predicted_mms")
        id_key, group_key, fold_key, obs, pred = fields
        paired = []
        verified_metrics = []
        for data, model in [(flex if liquid else first, "same_fuel_nearest" if liquid else "nearest"),
                            (flex if liquid else second, "log_ridge" if liquid else "log_geometry_ridge")]:
            matches = [r for r in data["predictions"] if r["model"] == model and r["evaluation"] == evaluation]
            paired.append(unique(matches, lambda r: (r[id_key],r[group_key],r[fold_key])))
            verified_metrics.append(next(r.get("group_mae",r.get("group_mae_mms")) for r in data.get("metrics",data.get("evaluations")) if r["model"] == model and r["evaluation"] == evaluation and r.get("subset","all") == "all"))
        baseline, retained = paired
        assert baseline.keys() == retained.keys()
        assert len({key[0] for key in baseline}) == len(baseline)
        groups = {}
        for (key,group,fold), row in baseline.items():
            model = retained[key,group,fold]
            assert ref[key]["eligible"] and math.isclose(row[obs],ref[key]["observed"],abs_tol=1e-10) and row[obs] == model[obs]
            groups.setdefault(group,[]).append(dict(id=key,fold=fold,observed=row[obs],baseline=row[pred],model=model[pred]))
        bars = []
        for key, rows in groups.items():
            a,b = (mean(abs(r[k]-r["observed"]) for r in rows) for k in ["baseline","model"])
            bars.append(dict(id=key,baseline=a,model=b,delta=a-b,winner="tie" if abs(a-b)<1e-12 else ("ML" if a>b else "Lookup"),rows=rows))
        a,b = (mean(g[k] for g in bars) for k in ["baseline","model"])
        gain = 100*(1-b/a)
        assert all(math.isclose(x,y,rel_tol=1e-8) for x,y in zip([a,b],verified_metrics))
        assert (len(baseline),len(bars),sum(g["winner"]=="ML" for g in bars),round(gain,2)) == expected
        cohorts.append(dict(id=cohort,label=label,family=family,unit="mm²/s" if liquid else "mm/s",baseline=a,model=b,gain=gain,groups=sorted(bars,key=lambda r:r["delta"])))
    return dict(cohorts=cohorts,records=records)


if __name__ == "__main__":
    data = compile_data()
    (DATA/"analytics-results.json").write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
    for c in data["cohorts"]:
        print(c["label"],len(c["groups"]),round(c["gain"],2))


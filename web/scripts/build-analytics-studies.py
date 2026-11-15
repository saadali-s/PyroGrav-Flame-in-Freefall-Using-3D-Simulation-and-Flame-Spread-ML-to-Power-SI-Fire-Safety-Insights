"""Build the Analytics-only source index with checked local provenance."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web/src/data"
PSI = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-"
BRIEF = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/"
GLOVEBOX = "https://www1.grc.nasa.gov/wp-content/uploads/ACME_CSSCI_2014_rev.pdf"
AEROSOL = "https://www.nasa.gov/wp-content/uploads/2025/07/dust-and-aerosol-measurement-feasibility-test-daft.pdf"
CIR = "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"


def link(url, locator):
    return dict(url=url, locator=locator)


def verified_source(raw, url, locator):
    files = list((ROOT/"backend/data").rglob(raw))
    assert len(files) == 1, raw
    return dict(**link(url,locator),path=files[0].relative_to(ROOT).as_posix(),sha256=hashlib.sha256(files[0].read_bytes()).hexdigest())


entries = json.loads((DATA/"investigations.json").read_text(encoding="utf8"))["entries"]
for e in entries:
    for s in e["sources"]:
        assert hashlib.sha256((ROOT/s["path"]).read_bytes()).hexdigest() == s["sha256"]
    if e["id"] == "pmma":
        e["hardware"] = "ISS Microgravity Science Glovebox, SPICE-derived flow duct. Ground tests used separate equipment."
        e["sources"].append(link(GLOVEBOX,"NASA Glenn · shared MSG apparatus"))
    if e["id"] in ("same","daft"):
        e["hardware"] += ". The modified P-Trak counts aerosol particles. DAFT tested its operation for SAME."
        e["sources"].append(link(AEROSOL,"NASA Glenn · DAFT instrument description"))
    if e["id"] == "saffire":
        e["hardware"] = "Saffire apparatus on the uncrewed Cygnus spacecraft after ISS departure. The sample scale and ventilation differ from the BASS-II rod duct."
    if e["id"] == "daft":
        e["topics"] = ["detection"]
    e["status"] = {"modeled":"Model evaluation","reference":"Measured reference"}.get(e["readiness"],"Study records")

rack = "ISS Combustion Integrated Rack, Advanced Combustion via Microgravity Experiments (ACME)"
droplets = "ISS Combustion Integrated Rack, Multi-user Droplet Combustion Apparatus"
def add(id,name,topics,status,hardware,material,conditions,objective,measurement,units,limits,sources):
    entries.append(dict(id=id,name=name,topics=topics,status=status,hardware=hardware,material=material,conditions=conditions,objective=objective,measurement=measurement,units=units,limits=limits,sources=sources))

add("spice","SPICE · co-flow smoke point",["prevention"],"Run log","ISS Microgravity Science Glovebox, common SPICE/SLICE duct later adapted for solid fuels","Gaseous jet in co-flowing air","Fuel and co-flow settings can vary during a burn.","Study smoke formation in co-flow diffusion flames.","The local run log records flow settings and ignition/flame-off times.","cm/s for air speed","469 log entries include repeated rows and changing settings. Independent smoke-point outcomes are missing.",[verified_source("PSI-107_Experimental table_Spice.csv",PSI+"107","Experimental table · ignition and co-flow columns"),link(GLOVEBOX,"NASA Glenn · shared SPICE/SLICE hardware")])
add("cfi","CFI · liquid droplets",["suppression"],"Condition records",droplets,"Liquid fuel droplets","Recorded ambient composition and fuel conditions","Investigate low-temperature droplet combustion.","Local table lists 87 condition rows, with eight repeats.","Condition settings","A droplet size history and complete outcome labels are missing. These rows cannot supply FLEX burning constants.",[verified_source("PSI-39_Experimental table_CFI (1).csv",PSI+"39","CFI experimental table · rows 24–31 and 81–88"),link(CIR,"NASA Glenn · droplet combustion hardware")])
add("cfig","CFI-G · gaseous cool flames",["prevention"],"Experimental logs",rack,"Spherical gaseous burner","Normal and inverse flow configurations. The challenge describes up to 85% oxygen in the burner feed.","Distinguish burner composition from the atmosphere around the flame.","Ignition and cool-flame observations with incomplete outcomes.","Temperature in °C and K","In the inverse table, Kelvin cells contain errors at rows 96–97. Normal-table computed cells fail at rows 69 and 77. Blank cool-flame entries cannot establish absence.",[verified_source("PSI-159_Experimental table_CFI-G_Inverse Flames.csv",PSI+"159","Inverse table · rows 96–97"),verified_source("PSI-159_Experimental table_CFI-G_Normal Flames.csv",PSI+"159","Normal table · rows 69 and 77"),link(BRIEF,"Challenge considerations · burner feed")])
add("bre","BRE · burning rate emulator",["prevention"],"Flagged metadata",rack,"Flat gaseous burner emulating a material surface","Still air, daily chamber settings","Investigate burning behavior using a controlled burner.","18 daily summaries in the local log.","Oxygen in %","CSV rows 6 and 9 report 3400% and 2100% oxygen. Chamber pressure is missing. Hold these values for review.",[verified_source("PSI-20_Experimental table_ACME BRE.csv",PSI+"20","BRE experimental table · rows 6 and 9")])
add("efield","E-FIELD Flames",["partial-gravity","prevention"],"Analogue",rack,"Gaseous flame between electrodes","Electrode polarity and burner settings","Study how an electric field changes flame behavior.","The local log records electrode polarity.","Polarity category","Voltage, electrode geometry and acceleration calibration are missing. A polarity cannot be converted into lunar or Martian gravity.",[verified_source("PSI-22_Experimental table_ACME E-FIELD Flames.csv",PSI+"22","E-FIELD experimental table · polarity column")])
add("fm2","FM2 · lunar materials experiment",["partial-gravity"],"Planned in source","Lunar-surface apparatus described in the 2024 FM2 poster","Solid material samples","Proposed lunar material flammability tests","Identify a source describing planned lunar measurements.","The archived poster describes an experiment design.","No rate in this source","The poster supplies no matched opposed-flow rod rates or later mission outcome.",[verified_source("Glenn_2024_ZayacPoster.pdf","https://ntrs.nasa.gov/citations/20240015307","2024 FM2 poster · experiment design")])

apps = [
 dict(id="cabin",name="Moon base and pressurized rover",study="pmma",question="Does our rod model cover an exploration cabin?",finding="The 34% O₂, 8.2 psi example exceeds measured oxygen coverage on Earth (17.5–20.9%) and the ISS (17.0–20.8%). Individual rod pressures are unresolved.",limit="A matched experiment needs pressure, oxygen, gravity, diameter, opposed flow and a leading-edge spread rate. The Earth and ISS measurements cannot bound a lunar or Martian rate.",context="The brief describes a 4.3 psi oxygen suit and oxygen pre-breathing to remove nitrogen. Possible cabins at ≥30% oxygen and ≤10.2 psi introduce a separate material-testing question.",sources=[link(BRIEF,"Challenge considerations · exploration atmosphere"),entries[0]["sources"][0]]),
 dict(id="feed",name="Burner feed and cabin oxygen",study="cfig",question="Where was the high oxygen concentration applied?",finding="In the challenge’s inverse-flame example, up to 85% oxygen flows out of a spherical burner into nitrogen and fuel gas.",limit="That percentage describes an inlet stream. It provides no cabin flammability threshold or PMMA spread rate.",context="Oxygen feed → spherical burner → chamber containing nitrogen and fuel gas.",sources=[link(BRIEF,"Challenge considerations · CFI-G"),link(PSI+"159","PSI-159 · normal and inverse configurations")]),
 dict(id="smoke",name="Smoke detection on Earth",study="same",question="Can a detector distinguish smoke from dust?",finding="NASA documents a shuttle-derived fire detector that discriminated smoke from dust to reduce nuisance alarms. SAME and DAFT provide related particle-measurement evidence.",limit="Scoring false alarms requires paired exposure, detector response and event labels. The local experimental settings alone cannot supply that score.",context="Compare number concentration with the response of a detector exposed to the same aerosol.",sources=[link("https://spinoff.nasa.gov/node/9407","NASA Spinoff · Fire Detector"),link(AEROSOL,"NASA Glenn · DAFT")]),
 dict(id="mist",name="Fire suppression and protective equipment",study="flex",question="What could inform terrestrial fire protection?",finding="The challenge gives fine water mist as a suppression example. FLEX measures the burning constant of individual droplets in recorded gas mixtures.",limit="Mist performance requires a measured suppression outcome under defined application conditions. FLEX K alone cannot rank extinguishers or select a dose.",context="NASA separately documents spacesuit technology adapted to firefighters’ breathing equipment and protective clothing.",sources=[link(BRIEF,"Challenge considerations · water mist"),link("https://spinoff.nasa.gov/node/9582","NASA Spinoff · Fireman’s Air Tanks"),link("https://spinoff.nasa.gov/node/9918","NASA Spinoff · New Technology for the Fire Attire")])
]
assert len({e["id"] for e in entries}) == 12
(DATA/"analytics-studies.json").write_text(json.dumps(dict(studies=entries,applications=apps),ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("Verified 12 study records and 4 application records")


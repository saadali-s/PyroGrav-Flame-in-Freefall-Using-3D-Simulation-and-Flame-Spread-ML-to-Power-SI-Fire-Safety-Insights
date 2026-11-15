"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import catalog from "@/data/investigations.json";
import { rankStudies, relevance } from "@/lib/investigation-ranking";
import styles from "./finder.module.css";

const topics = [
  ["prevention", "Material flammability"],
  ["detection", "Smoke detection"],
  ["suppression", "Suppression research"],
  ["partial-gravity", "Partial gravity"],
] as const;

const labels: Record<string, string> = {
  modeled: "Evaluated model",
  reference: "Measured reference",
  metadata: "Experiment context",
};
type Study = Omit<typeof catalog.entries[number], "topics" | "relatedTopics"> & {
  topics: string[];
  relatedTopics: string[];
};

function StudyDetail({ study }: { study: Study }) {
  return <article className={styles.detail}>
    <p className={styles.ids}>{study.ids}</p>
    <h3>{study.name}</h3>
    <p>{study.objective}</p>
    <dl>
      <dt>Sample and setup</dt><dd>{study.material}. {study.configuration}.</dd>
      <dt>Measurement</dt><dd>{study.measurement}. {study.units}.</dd>
      <dt>Coverage</dt><dd>{study.available}.</dd>
    </dl>
    <p><strong>Research use</strong> {study.utility}</p>
    <p className={styles.limit}><strong>Limit</strong> {study.limits}</p>
    <details><summary>Conditions, hardware and sources</summary>
      <p>{study.conditions}</p><p>{study.hardware}</p>
      <ul>{study.sources.map(source => <li key={source.path}>
        <a href={source.url} target="_blank" rel="noreferrer">{source.locator} ↗</a>
        <small>{source.version}</small>
      </li>)}</ul>
    </details>
    {study.action && <Link className={styles.action} href={study.action}>{study.actionLabel} →</Link>}
  </article>;
}

export function InvestigationFinder({ children }: { children: ReactNode }) {
  const [view, setView] = useState<"list" | "details">("list");
  const [topic, setTopic] = useState("prevention");
  const [selected, setSelected] = useState("pmma");
  const [compareId, setCompareId] = useState("");
  const studies = rankStudies(catalog.entries, topic);
  const primary = studies.find(study => study.id === selected) ?? studies[0];
  const comparison = studies.find(study => study.id === compareId && study.id !== primary.id);
  function selectTopic(value: string) {
    setTopic(value);
    setSelected(rankStudies(catalog.entries, value)[0].id);
    setCompareId("");
    setView("list");
  }
  return <section id="investigations" className={styles.finder} aria-labelledby="finder-title">
    <div className={styles.body}>
      {children}
      <aside className={styles.library}>
      <div className={styles.heading}><h2 id="finder-title">Find an investigation</h2>
      <label>Research focus<select value={topic} onChange={event => selectTopic(event.target.value)}>
        {topics.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select></label>
    </div>
      <div className={styles.views} role="group" aria-label="Investigation views">
        <button aria-pressed={view==="list"} onClick={()=>setView("list")}>Ranked studies</button>
        <button aria-pressed={view==="details"} onClick={()=>setView("details")}>Details &amp; comparison</button>
      </div>
      <div hidden={view!=="list"}><ol className={styles.ranks} aria-label="Research relevance order">
        {studies.map((study, index) => <li key={study.id}>
          <button aria-pressed={primary.id === study.id} onClick={() => {setSelected(study.id); if (compareId === study.id) setCompareId(""); setView("details");}}>
            <span>{index + 1}</span><span><b>{study.name}</b><small>{["Other topic", "Supporting context", "Topic match"][relevance(study, topic)]} · {labels[study.readiness]}</small></span>
          </button>
        </li>)}
      </ol><details className={styles.method}><summary>How ranking works</summary><p>Direct topic matches appear first, followed by supporting studies and other topics. Within each group, evaluated models precede measured references and experiment context. Ties use alphabetical order.</p></details></div>
      <div hidden={view!=="details"}>
        <label>Compare with<select value={comparison?.id ?? ""} onChange={event => setCompareId(event.target.value)}>
          <option value="">One investigation</option>{studies.filter(study => study.id !== primary.id).map(study => <option key={study.id} value={study.id}>{study.name}</option>)}
        </select></label>
        <div className={styles.details} data-paired={Boolean(comparison)}><StudyDetail key={primary.id} study={primary}/>{comparison && <StudyDetail key={comparison.id} study={comparison}/>}</div>
      </div></aside>
    </div>
  </section>;
}

import catalog from "./catalog.json" with { type: "json" };
import evaluations from "./metrics.json" with { type: "json" };
import auditFacts from "./audit-facts.json" with { type: "json" };
export {catalog,evaluations};
export const revision = "92b505b65c35b5842167786de403061d06dedef9";
export function evidenceFor(hits) {
  return hits.map(hit => {
    const doc = catalog.entries.find(e => e.id === hit.id);
    if (!doc || !Number.isFinite(hit.score)) throw new Error("Invalid evidence ID or score");
    return {
      id: doc.id, title: doc.name, objective: doc.objective, measurement: doc.measurement,
      units: doc.units, coverage: doc.available, interpretation: doc.utility, limit: doc.limits,
      material: doc.material, configuration: doc.configuration, conditions: doc.conditions,
      ...auditFacts[doc.id],
      saved_development_evaluations: evaluations[doc.id] ?? [],
      sources: doc.sources.map(({ url, locator, sha256 }) => ({ url, locator, sha256 }))
    };
  });
}


type StudyTopics = {
  name: string;
  topics: readonly string[];
  relatedTopics: readonly string[];
  readiness: string;
};

const evidenceOrder = ["modeled", "reference", "metadata"];

export function relevance(study: StudyTopics, focus: string) {
  if (study.topics.includes(focus)) return 2;
  return study.relatedTopics.includes(focus) ? 1 : 0;
}

export function rankStudies<T extends StudyTopics>(entries: readonly T[], focus: string) {
  return [...entries].sort((a, b) =>
    relevance(b, focus) - relevance(a, focus) ||
    evidenceOrder.indexOf(a.readiness) - evidenceOrder.indexOf(b.readiness) ||
    a.name.localeCompare(b.name, "en")
  );
}

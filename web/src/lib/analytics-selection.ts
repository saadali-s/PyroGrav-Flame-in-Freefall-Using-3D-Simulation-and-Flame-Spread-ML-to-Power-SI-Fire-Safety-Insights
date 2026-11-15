export type AnalyticsSelection =
  | {kind:"group"; cohort:string; group:string}
  | {kind:"study"; id:string; compare?:string}
  | {kind:"application"; id:string};

export const analyticsGuideEvent = "pyrograv:explain-analytics";

export function explainResult(selection: AnalyticsSelection, label: string) {
  window.dispatchEvent(new CustomEvent(analyticsGuideEvent, {detail:{selection,label}}));
}


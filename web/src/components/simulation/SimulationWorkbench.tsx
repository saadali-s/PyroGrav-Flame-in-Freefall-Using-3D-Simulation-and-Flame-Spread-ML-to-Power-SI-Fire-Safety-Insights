"use client";
import { useSearchParams } from "next/navigation";
import { ExperimentBar } from "./ExperimentBar";
import { SimulationDashboard } from "./SimulationDashboard";
import { FlexWorkbench } from "./FlexWorkbench";

export function SimulationWorkbench() {
  const experiment = useSearchParams().get("experiment") === "flex" ? "flex" : "pmma";
  return experiment === "flex"
    ? <><ExperimentBar experiment="flex"/><FlexWorkbench/></>
    : <SimulationDashboard/>;
}

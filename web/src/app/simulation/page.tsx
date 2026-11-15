import { Suspense } from "react";
import { SimulationWorkbench } from "@/components/simulation/SimulationWorkbench";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Combustion workbench | PyroGrav",
  description: "Choose PMMA flame spread or FLEX droplet burning and compare measured rates with held-out predictions.",
};

export default function SimulationPage() {
  return <Suspense fallback={<p className="p-8">Loading experiment…</p>}><SimulationWorkbench /></Suspense>;
}

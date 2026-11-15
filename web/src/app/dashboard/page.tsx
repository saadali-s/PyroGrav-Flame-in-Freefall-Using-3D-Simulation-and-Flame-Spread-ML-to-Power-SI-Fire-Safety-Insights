import { DashboardWorkbench } from "@/components/dashboard/DashboardWorkbench";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | PyroGrav AI",
  description: "One workspace for PMMA and FLEX measurements, model comparisons and source evidence.",
};

export default function DashboardPage() {
  return <DashboardWorkbench />;
}

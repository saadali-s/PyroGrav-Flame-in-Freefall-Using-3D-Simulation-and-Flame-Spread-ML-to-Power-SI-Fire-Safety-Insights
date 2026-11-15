import type { Metadata } from "next";
import { TrainingReview } from "@/components/training/TrainingReview";

export const metadata: Metadata = {
  title: "Round 4 results and evidence | PyroGrav",
  description: "Inspect held-out PMMA predictions, GPU training results, source decisions and transfer limitations.",
};

export default function TrainingPage() {
  return <TrainingReview />;
}

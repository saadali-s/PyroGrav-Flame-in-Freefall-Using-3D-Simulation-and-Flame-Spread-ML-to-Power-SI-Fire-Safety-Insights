import type { ReactNode } from "react";
import Link from "next/link";
import { Droplets, Flame } from "lucide-react";
import s from "../layout/shell.module.css";
import p from "./pmma-workbench.module.css";

export function ExperimentBar({ experiment, children }: { experiment: "pmma" | "flex"; children?: ReactNode }) {
  return <div className={`${s.selector} ${p.experimentBar}`}>
    <span>EXPERIMENT</span>
    <nav aria-label="Simulation experiment">
      <Link href="/simulation?experiment=pmma" scroll={false} aria-current={experiment === "pmma" ? "page" : undefined}><Flame size={16}/>PMMA rods</Link>
      <Link href="/simulation?experiment=flex" scroll={false} aria-current={experiment === "flex" ? "page" : undefined}><Droplets size={16}/>FLEX droplets</Link>
    </nav>
    {children}
  </div>;
}

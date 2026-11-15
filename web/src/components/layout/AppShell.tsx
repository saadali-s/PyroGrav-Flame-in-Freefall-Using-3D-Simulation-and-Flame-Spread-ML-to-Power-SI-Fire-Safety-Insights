"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutDashboard, Orbit, BookOpen, ChartNoAxesColumn, Sun, Moon } from "lucide-react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import s from "../simulation/simulation.module.css";
import shell from "./shell.module.css";
import { SpaceGuide } from "./SpaceGuide";
const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/simulation", label: "Simulation", icon: Orbit },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn },
  { href: "/training", label: "Evidence", icon: BookOpen },
];
function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  return <div className={`${s.app} ${shell.app}`} data-theme={theme}>
    <a href="#workspace" className={shell.skip}>Skip to content</a>
    <aside className={shell.sidebar} aria-label="Workspace sidebar">
      <Link href="/dashboard" aria-label="PyroGrav dashboard" className={shell.brand}><FlaskConical size={23}/><span>PyroGrav<small>COMBUSTION RESEARCH</small></span></Link>
      <div className={shell.navLabel}>WORKSPACE</div><nav aria-label="Main navigation" className={shell.nav}>
        {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-label={label} title={label} aria-current={pathname.startsWith(href) ? "page" : undefined}><Icon size={18}/><span>{label}</span></Link>)}
      </nav>
      <div className={shell.sidebarFoot}><SpaceGuide/><div className={shell.preview}><i/>Research preview<small>Source-linked experiments</small></div><div className={shell.actions}><button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span></button></div></div>
    </aside>
    <div className={shell.workspace}><main id="workspace" tabIndex={-1} className={shell.content}>{children}</main>
</div>
  </div>;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><Frame>{children}</Frame></ThemeProvider>;
}

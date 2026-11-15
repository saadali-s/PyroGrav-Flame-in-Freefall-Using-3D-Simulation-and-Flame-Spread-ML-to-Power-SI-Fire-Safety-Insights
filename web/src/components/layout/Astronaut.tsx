"use client";
import { useEffect, useRef } from "react";

// A coordinated reach / tuck / recover cycle. Angles are artistic posing, not dynamics.
const poses = [
  {t:0, body:-12, head:8, left:-12, right:16, elbowL:8, elbowR:-12, hipL:0, hipR:0, kneeL:8, kneeR:-8},
  {t:.16, body:12, head:-16, left:32, right:-38, elbowL:-55, elbowR:48, hipL:20, hipR:-18, kneeL:36, kneeR:-30},
  {t:.34, body:100, head:-20, left:-38, right:30, elbowL:25, elbowR:-48, hipL:-18, hipR:26, kneeL:52, kneeR:-45},
  {t:.49, body:184, head:16, left:26, right:-26, elbowL:-42, elbowR:22, hipL:28, hipR:-24, kneeL:28, kneeR:-20},
  {t:.64, body:154, head:20, left:-30, right:38, elbowL:36, elbowR:-36, hipL:-12, hipR:15, kneeL:44, kneeR:-48},
  {t:.83, body:20, head:-12, left:20, right:-18, elbowL:-30, elbowR:40, hipL:12, hipR:-10, kneeL:22, kneeR:-24},
  {t:1, body:-12, head:8, left:-12, right:16, elbowL:8, elbowR:-12, hipL:0, hipR:0, kneeL:8, kneeR:-8},
];
type Joint = Exclude<keyof typeof poses[number], "t">;
const pivots: Record<Joint, [number, number]> = {
  body:[60,76], head:[60,67], left:[43,73], right:[77,73], elbowL:[29,85], elbowR:[91,83],
  hipL:[51,103], hipR:[69,103], kneeL:[47,116], kneeR:[74,116],
};

export function Astronaut({paused=false, still=false}: {paused?:boolean; still?:boolean}) {
  const svg = useRef<SVGSVGElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    if (!svg.current || still) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const joints = Object.keys(pivots) as Joint[];
    const nodes = joints.map(key => svg.current!.querySelector<SVGGElement>(`[data-joint="${key}"]`));
    const visor = svg.current.querySelector<SVGGElement>('[data-visor]');
    let frame = 0, last = 0;
    const draw = (seconds: number) => {
      const phase = (seconds % 12) / 12;
      const index = Math.max(0, poses.findIndex((pose, i) => i < poses.length - 1 && phase >= pose.t && phase < poses[i+1].t));
      const a = poses[index], b = poses[index+1];
      const fraction = (phase-a.t)/(b.t-a.t);
      const blend = fraction*fraction*(3-2*fraction);
      joints.forEach((key, i) => {
        const angle = a[key]+(b[key]-a[key])*blend;
        const [x,y] = pivots[key];
        const drift = key === "body" ? `translate(${3*Math.sin(seconds*.52)} ${-4+4*Math.cos(seconds*.52)}) ` : "";
        nodes[i]?.setAttribute("transform", `${drift}rotate(${angle} ${x} ${y})`);
      });
      visor?.setAttribute("transform", `translate(${2.5*Math.sin(seconds*.8)} 0)`);
    };
    const tick = (now: number) => {
      if (last && !document.hidden) elapsed.current += Math.min((now-last)/1000, .05);
      last = now;
      draw(elapsed.current);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (preference.matches) draw(0);
      else if (!paused) frame = requestAnimationFrame(tick);
    };
    sync();
    preference.addEventListener("change", sync);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener("change", sync); };
  }, [paused, still]);
  return <svg ref={svg} viewBox="-8 0 136 145" fill="none" aria-hidden="true" data-articulated-astronaut>
    <g data-joint="body" stroke="#2b3d50" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      <rect x="34" y="64" width="49" height="38" rx="10" fill="#a6b8c7"/>
      <g data-joint="hipL">
        <path d="M44 100L41 116Q47 122 54 116L59 101" fill="#d8e4eb"/>
        <g data-joint="kneeL"><path d="M41 115L39 127Q36 133 43 134H53Q57 132 53 127L54 116" fill="#eef4f7"/><path d="M40 128H53" stroke="#93a9bb"/></g>
        <path d="M42 115L53 117" stroke="#93a9bb"/>
      </g>
      <g data-joint="hipR">
        <path d="M62 101L68 117Q75 122 81 115L77 100" fill="#d8e4eb"/>
        <g data-joint="kneeR"><path d="M68 116L70 128Q66 133 72 135H83Q89 132 82 127L81 115" fill="#eef4f7"/><path d="M71 128H82" stroke="#93a9bb"/></g>
        <path d="M69 117L80 115" stroke="#93a9bb"/>
      </g>
      <rect x="40" y="64" width="40" height="44" rx="13" fill="#eef4f7"/>
      <g data-joint="left">
        <path d="M43 68Q36 69 25 80Q21 86 27 91Q31 94 36 89L47 79" fill="#e5edf3"/>
        <g data-joint="elbowL"><path d="M25 90Q20 87 14 76Q11 70 16 67Q20 65 23 72L33 83Q35 89 30 91Z" fill="#e5edf3"/><path d="M14 76L23 72" stroke="#93a9bb"/><path d="M15 68L17 63Q20 60 22 64L24 70" fill="#f4f7fa"/></g>
        <circle cx="29" cy="85" r="3" fill="#a6b8c7" strokeWidth="1.2"/>
      </g>
      <g data-joint="right">
        <path d="M76 68L94 78Q99 83 94 89Q90 93 85 88L74 80" fill="#e5edf3"/>
        <g data-joint="elbowR"><path d="M85 82L94 64Q96 58 102 60Q107 62 104 69L98 86Q95 92 89 89Z" fill="#e5edf3"/><path d="M94 67L104 70" stroke="#93a9bb"/><path d="M95 63L96 57Q99 52 103 56L105 62" fill="#f4f7fa"/></g>
        <circle cx="91" cy="83" r="3" fill="#a6b8c7" strokeWidth="1.2"/>
      </g>
      <path d="M44 98Q60 103 77 97" stroke="#93a9bb"/>
      <rect x="50" y="75" width="22" height="17" rx="4" fill="#c2d8e3"/>
      <path d="M55 80H66" stroke="#345b70"/><circle cx="56" cy="86" r="1.4" fill="#2f8975" stroke="none"/><circle cx="65" cy="86" r="1.4" fill="#c58947" stroke="none"/>
      <path d="M73 88Q87 104 77 107" stroke="#829bab" strokeWidth="3"/>
      <ellipse cx="60" cy="67" rx="16" ry="6" fill="#829bab"/>
      <g data-joint="head">
        <ellipse cx="60" cy="46" rx="27" ry="25" fill="#f4f7fa"/>
        <rect x="31" y="41" width="6" height="15" rx="3" fill="#becfdb"/><rect x="83" y="41" width="6" height="15" rx="3" fill="#becfdb"/>
        <g data-visor><path d="M40 40Q44 30 61 30Q78 31 80 42L78 55Q69 63 50 59Q38 57 40 40Z" fill="#1c3447"/><path d="M46 40Q51 35 59 35" stroke="#9acdd9" strokeWidth="3.5"/><path d="M75 45L73 52" stroke="#5e879a"/></g>
      </g>
    </g>
  </svg>;
}

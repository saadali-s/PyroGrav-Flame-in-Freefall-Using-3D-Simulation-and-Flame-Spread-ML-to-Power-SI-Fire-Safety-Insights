"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuideChat } from "./GuideChat";
import { MessageCircle, Pause, Play, X } from "lucide-react";
import s from "./space-guide.module.css";
import { Astronaut } from "./Astronaut";
import { tipsForPage } from "@/lib/astronaut-tips";

export function SpaceGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const pathname=usePathname();
  const [tipIndex,setTipIndex]=useState(0),[tipVisible,setTipVisible]=useState(false),[engaged,setEngaged]=useState(false);
  const tips=tipsForPage(pathname),tip=tips[tipIndex%tips.length];
  const lastIndex=useRef(0);
  const showChat=()=>{dialog.current?.showModal();setOpen(true);setTipVisible(false);};
  useEffect(()=>{
    const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer:ReturnType<typeof setTimeout>;
    let hide:ReturnType<typeof setTimeout>;
    let cancelled=false;
    const schedule=(delay:number)=>{timer=setTimeout(()=>{
      if(cancelled)return;
      if(!document.hidden&&!preference.matches&&!paused&&!open&&!engaged){
        const count=tipsForPage(pathname).length;
        const index=(lastIndex.current+1+Math.floor(Math.random()*(count-1)))%count;
        lastIndex.current=index;setTipIndex(index);setTipVisible(true);
        hide=setTimeout(()=>setTipVisible(false),12000);
      }
      schedule(28000);
    },delay);};
    const stopTip=()=>setTipVisible(false);
    preference.addEventListener("change",stopTip);
    document.addEventListener("visibilitychange",stopTip);
    schedule(5000);
    return()=>{cancelled=true;clearTimeout(timer);clearTimeout(hide);preference.removeEventListener("change",stopTip);document.removeEventListener("visibilitychange",stopTip);};
  },[pathname,paused,open,engaged]);
  return <>
    <div className={s.companion} data-open={open} data-paused={paused} data-tip-visible={tipVisible&&!paused&&!open} onMouseEnter={()=>setEngaged(true)} onMouseLeave={()=>setEngaged(false)} onFocus={()=>setEngaged(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setEngaged(false);}}>
      <div className={s.factBubble} aria-label="Space guide tip">
        <button className={s.dismissTip} aria-label="Hide tip and pause automatic tips" onClick={()=>{setTipVisible(false);setPaused(true);}}><X size={12}/></button>
        <p>{tip.text}</p><small>{tip.context}</small>
        <div><Link href={tip.href}>See evidence ↗</Link><button onClick={showChat}><MessageCircle size={12}/>Chat with me</button></div>
      </div>
      <button ref={launcher} className={s.launcher} aria-label='Open space guide' aria-haspopup='dialog' aria-expanded={open} onClick={showChat}>
        <Astronaut paused={paused || open}/><span className={s.name}>Space guide</span>
      </button>
      <button className={s.pause} onClick={() => {setPaused(!paused);setTipVisible(false);}} aria-label={paused ? 'Resume astronaut and automatic tips' : 'Pause astronaut and automatic tips'} title={paused ? 'Resume animation and tips' : 'Pause animation and tips'}>{paused ? <Play size={11}/> : <Pause size={11}/>}</button>
    </div>
    <GuideChat onOpen={showChat} dialogRef={dialog} open={open} portrait={<Astronaut still/>} onClose={() => { setOpen(false); requestAnimationFrame(() => launcher.current?.focus()); }}/>
  </>;
}

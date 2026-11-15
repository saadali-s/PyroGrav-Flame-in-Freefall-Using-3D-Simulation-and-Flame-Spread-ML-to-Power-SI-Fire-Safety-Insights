"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ImageIcon, X } from "lucide-react";
import s from "./flame-reference.module.css";

export function FlameReference({ onOpen }: { onOpen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" title="Compare with the published flame photograph" aria-label="Source photo: Link et al. Figure 1"
      onClick={() => { dialog.current?.showModal(); setOpen(true); onOpen(); }}>
      <ImageIcon size={15}/><span>Source photo</span>
    </button>
    <dialog ref={dialog} className={s.dialog} aria-labelledby={titleId}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <header className={s.header}>
        <div><p>PUBLISHED REFERENCE · LINK ET AL. (2018)</p><h2 id={titleId}>The flame behind the illustration</h2></div>
        <button type="button" autoFocus aria-label="Close source photograph" onClick={() => dialog.current?.close()}><X size={19}/></button>
      </header>
      <div className={s.referenceBody}><figure><Image src="/references/link2018-figure1.jpg" alt="Published comparison: elongated luminous Earth flame with a blue base on the left; broader blue-edged microgravity flame with a warm interior on the right." width={1000} height={968} sizes="(max-width: 760px) 85vw, 340px"/><figcaption>Link et al. (2018), Figure 1. Extracted unchanged from the paper. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</figcaption></figure><div><h3>Appearance is evidence too.</h3><p>This photograph shows one comparison at 20.9% O₂ and 2 cm/s imposed flow. It is not a photograph of every selected row.</p><p>The paper reports microgravity flames changing from yellow to blue as airflow decreases. Our Earth plume and ISS envelope are representative illustrations; their shape and color are not model outputs.</p><p>The vertical presentation aligns the comparisons. The ISS apparatus used a horizontal duct; spread opposes airflow, not gravity.</p><a href="https://doi.org/10.1038/s41598-017-18398-4" target="_blank" rel="noreferrer">Read the original paper · Figures 1–4 <ArrowUpRight size={13}/></a></div></div>
      <footer className={s.footer}>Figure 1 · Reference photograph, not the selected experiment. Playback pauses when opened.</footer>
    </dialog>
  </>;
}


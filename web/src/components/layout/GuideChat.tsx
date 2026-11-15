"use client";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from "react";
import { analyticsGuideEvent, type AnalyticsSelection } from "@/lib/analytics-selection";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, MessageSquarePlus, Square, X } from "lucide-react";
import { GuideResponse, type GuideMessage } from "./GuideResponse";
import s from "./space-guide.module.css";
import {guideStarters} from "@/lib/guide-starters";


export function GuideChat({dialogRef,open,onOpen,onClose,portrait}:{dialogRef:RefObject<HTMLDialogElement|null>;open:boolean;onOpen:()=>void;onClose:()=>void;portrait:ReactNode}) {
  const pathname=usePathname();
  const log=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),lastReply=useRef<HTMLElement>(null);
  const activeRequest=useRef<AbortController|null>(null),pinned=useRef(true),nextId=useRef(0);
  const copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [draft,setDraft]=useState(""),[messages,setMessages]=useState<GuideMessage[]>([]);
  const [configured,setConfigured]=useState<boolean|null>(null),[connectionAttempt,setConnectionAttempt]=useState(0);
  const [provider,setProvider]=useState<"worker"|"hosted"|"cloudflare"|"gateway"|"groq">("worker");
  const [pending,setPending]=useState(false),[slow,setSlow]=useState(false),[showLatest,setShowLatest]=useState(false);
  const [copied,setCopied]=useState<number|null>(null),[notice,setNotice]=useState("");

  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    fetch("/api/guide",{signal:controller.signal}).then(r=>r.json()).then(data=>{
      setConfigured(data.configured===true);
      setProvider(data.mode==="gateway"||data.mode==="hosted"||data.mode==="groq"||data.mode==="cloudflare"?data.mode:"worker");
    })
      .catch(()=>{if(!controller.signal.aborted)setConfigured(false);});
    const frame=requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));
    return ()=>{controller.abort();cancelAnimationFrame(frame);};
  },[open,connectionAttempt]);
  useEffect(()=>()=>{const controller=activeRequest.current;activeRequest.current=null;controller?.abort();if(copyTimer.current)clearTimeout(copyTimer.current);},[]);
  useEffect(()=>{
    if(!pending)return;
    const timer=setTimeout(()=>setSlow(true),12000);
    return ()=>clearTimeout(timer);
  },[pending]);
  useEffect(()=>{
    if(input.current){input.current.style.height="auto";input.current.style.height=`${Math.min(160,input.current.scrollHeight)}px`;}
  },[draft]);
  useEffect(()=>{
    const viewport=log.current;
    if(!viewport||!pinned.current||!open)return;
    if(pending)viewport.scrollTop=viewport.scrollHeight;
    else if(lastReply.current)viewport.scrollTop+=lastReply.current.getBoundingClientRect().top-viewport.getBoundingClientRect().top-16;
  },[messages,pending,open]);

  const send=async(text:string,retryIndex?:number,selection?:AnalyticsSelection)=>{
    const question=text.trim();
    if(!question||activeRequest.current||(!selection&&!configured))return;
    // Retry replaces only the last failed exchange; it does not duplicate its user message.
    const base=retryIndex===undefined?messages:messages.slice(0,Math.max(0,retryIndex-1));
    const controller=new AbortController();activeRequest.current=controller;
    pinned.current=true;setShowLatest(false);setSlow(false);setPending(true);setNotice("");
    setMessages([...base,{id:++nextId.current,role:"you",text:question}]);
    if(retryIndex===undefined)setDraft("");
    const history=base.filter(m=>m.status!=="error"&&m.status!=="stopped").slice(-6).map(m=>({role:m.role==="you"?"user":"assistant",content:m.text}));
    try{
      const response=await fetch(selection?"/api/analytics/explain":"/api/guide",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(selection??{question,history,page:window.location.pathname+window.location.search}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(50000)])});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"The guide couldn't connect. Please try again.");
      if(activeRequest.current!==controller)return;
      setMessages(previous=>[...previous,{id:++nextId.current,role:"guide",status:data.status,mode:data.mode,origin:data.origin,
        text:data.answer||"I couldn't verify an answer. Try a specific study or inspect the Evidence page.",
        evidence:data.evidence,actions:data.actions,tools:data.tools,retrievalUnavailable:data.retrieval_status==="unavailable",question}]);
    }catch(error){
      if(activeRequest.current!==controller)return;
      const stopped=controller.signal.aborted;
      setMessages(previous=>[...previous,{id:++nextId.current,role:"guide",status:stopped?"stopped":"error",question,selection,
        text:stopped?"Stopped waiting for this response. You can try again or ask something else.":error instanceof Error&&error.name==="TimeoutError"?"This response took too long. Please try again.":error instanceof Error?error.message:"The connection was interrupted. Please try again."}]);
    }finally{
      if(activeRequest.current===controller){activeRequest.current=null;setPending(false);}
    }
  };
  const explainSelected=useEffectEvent((event:Event)=>{
    const detail=(event as CustomEvent<{label:string;selection:AnalyticsSelection}>).detail;
    if(!detail?.selection||!detail.label)return;
    if(activeRequest.current){
      activeRequest.current.abort();
      activeRequest.current=null;
    }
    onOpen();
    void send("Explain "+detail.label,undefined,detail.selection);
  });
  useEffect(()=>{
    if(pathname!=="/analytics")return;
    const handle=(event:Event)=>explainSelected(event);
    window.addEventListener(analyticsGuideEvent,handle);
    return ()=>window.removeEventListener(analyticsGuideEvent,handle);
  },[pathname]);
  const copy=async(message:GuideMessage)=>{
    try{await navigator.clipboard.writeText(message.text);setCopied(message.id);setNotice("Response copied.");
      if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>{setCopied(null);setNotice("");},2000);
    }catch{setNotice("Copy unavailable. You can select and copy the message text.");}
  };
  const jumpToLatest=()=>{pinned.current=true;log.current?.scrollTo({top:log.current.scrollHeight,behavior:"auto"});setShowLatest(false);};
  return <dialog ref={dialogRef} className={s.drawer} aria-labelledby="guide-title" aria-describedby="guide-description" onClose={onClose}>
    <div className={s.drawerHeader}><div><div className={s.kicker}>PYROGRAV COMPANION</div><h2 id="guide-title">Your space guide</h2></div>
      <div className={s.headerActions}><button disabled={pending||!messages.length} aria-label="Start new chat" title="New chat" onClick={()=>{setMessages([]);setDraft("");setNotice("");pinned.current=true;setShowLatest(false);input.current?.focus();}}><MessageSquarePlus size={18}/></button><button onClick={()=>dialogRef.current?.close()} aria-label="Close space guide"><X size={20}/></button></div>
    </div>
    <div className={s.status}><span/>{configured===null?"Checking connection…":configured?(provider==="hosted"?"NASA INDUS · research guide":provider==="groq"?"NASA INDUS + GPT-OSS · research guide":"NASA INDUS + DeepSeek · research guide"):"AI connection unavailable"}
      {configured===false&&<button onClick={()=>{setConfigured(null);setConnectionAttempt(v=>v+1);}}>Reconnect</button>}
    </div>
    <p id="guide-description" className={s.srOnly}>Ask about PyroGrav or its research. AI responses may be wrong; check cited records. Enter sends; Shift Enter adds a line.</p>
    <div className={s.chatScrollArea}>
      <div ref={log} className={s.conversation} onScroll={()=>{const viewport=log.current;if(!viewport)return;const near=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<90;pinned.current=near;setShowLatest(!near);}}>
        {!messages.length&&<div className={s.emptyChat}><div className={s.portrait}>{portrait}</div><h3>What would you like<br/>to explore?</h3><p>Understand a result, check a condition,<br/>or find your way around PyroGrav.</p><small>Viewing {pathname==="/training"?"Evidence":pathname==="/simulation"?"Simulation":pathname==="/analytics"?"Analytics":"Dashboard"}</small><div className={s.prompts}>{guideStarters.map(prompt=><button key={prompt.kind} disabled={!configured} onClick={()=>send(prompt.question)}><span className={s.starterText}><small>{prompt.kind}</small><strong>{prompt.label}</strong><span>{prompt.detail}</span></span><ArrowUp size={14}/></button>)}</div></div>}
        <div className={s.messages} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
          {messages.map((message,index)=><article ref={index===messages.length-1&&message.role==="guide"?lastReply:undefined} key={message.id} className={message.role==="you"?s.userMessage:s.guideMessage}>
            {message.role==="you"?<><span className={s.srOnly}>You: </span><p>{message.text}</p></>:<GuideResponse message={message} copied={copied===message.id} canRetry={!pending&&index===messages.length-1&&["error","stopped"].includes(message.status??"")} onCopy={()=>copy(message)} onRetry={()=>send(message.question??"",index,message.selection)} onNavigate={()=>dialogRef.current?.close()}/>}
          </article>)}
        </div>
        {pending&&<div className={s.pendingReply} role="status" aria-live="polite"><div className={s.replyLabel}><span className={s.thinkingDot}/><span>{slow?"Still working…":"Preparing your response"}</span></div><div className={s.skeleton} aria-hidden="true"><span/><span/><span/></div>{slow&&<small>You can stop waiting at any time.</small>}</div>}
      </div>
      {showLatest&&<button className={s.latestButton} onClick={jumpToLatest}><ArrowDown size={14}/>Latest messages</button>}
    </div>
    <form className={s.composer} onSubmit={e=>{e.preventDefault();send(draft);}}>
      <label htmlFor="guide-draft" className={s.srOnly}>Message the space guide</label>
      <div className={s.inputBox}><textarea ref={input} id="guide-draft" rows={1} maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!pending)send(draft);}}}
        placeholder="Ask your space guide…" aria-describedby="guide-input-hint"/>
        {pending?<button type="button" className={s.stopButton} onClick={()=>activeRequest.current?.abort()} aria-label="Stop waiting for response" title="Stop waiting"><Square size={15} fill="currentColor"/></button>:<button type="submit" disabled={!draft.trim()||!configured} aria-label="Send message"><ArrowUp size={19}/></button>}
      </div>
      <div className={s.inputMeta} id="guide-input-hint"><span>Enter to send · Shift Enter for a new line</span><span>{draft.length?`${draft.length}/1000`:""}</span></div>
      <small className={s.privacyNote}>{provider==="groq"?"INDUS runs on Vercel. Up to six recent messages may be sent to Groq.":provider==="gateway"?"INDUS runs on Vercel. Up to six recent messages may be sent to AI Gateway.":provider==="hosted"?"INDUS runs on Vercel and searches reviewed study summaries.":provider==="cloudflare"?"INDUS runs on Vercel. Up to six recent messages may be sent to Cloudflare for DeepSeek.":"Up to six recent messages go to Cloudflare. INDUS uses the configured retrieval service."} Check cited sources before relying on a response.</small>
      <div className={s.copyNotice} role="status">{notice}</div>
    </form>
  </dialog>;
}

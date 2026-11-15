/** Deliberately complete examples. Server shortcuts apply only to these exact questions. */
export const guideStarters = [
  {kind:"App guide",label:"What can you help me do?",detail:"NASA INDUS and the available lab tools",question:"What can you help me do?"},
  {kind:"INDUS research",label:"Research PMMA and FLEX with INDUS",detail:"Find source-backed targets, units and limits",question:"Use NASA INDUS to find the reviewed PMMA and FLEX evidence. What does each experiment measure, in what units, and why can’t their targets be pooled into one model? Cite the sources."},
  {kind:"Live tool check",label:"Check an ISS PMMA condition",detail:"9.5 mm rod · 19% oxygen · 1.5 cm/s airflow",question:"Run the read-only PMMA model tool for ISS: 9.5 mm rod diameter, 19% oxygen and 1.5 cm/s airflow. Return the experimental estimate and explain the support check and uncertainty limits."},
] as const;

export function productAnswer(question:string,provider:"worker"|"hosted"|"cloudflare"|"gateway"|"groq"="worker") {
  const message=question.trim();
  if (/^(?:hey|hi|hello|hiya|yo|howdy|good (?:morning|afternoon|evening))(?:[, ]+(?:there|space guide|pyrograv))?[!?.\s]*$/i.test(message)) {
    return {
      status:"generated",mode:"guidance",origin:"product_context",
      answer:"Hey! I’m PyroGrav’s Space Guide. I can help you explore PMMA flame spread, look up FLEX droplet burns, or check a condition in the simulator. What would you like to look into?",
      evidence:[],actions:[],
    };
  }
  if(!/^(what can you help me do|what can you do|what are you made of|who are you)[?!.]*$/i.test(message))return null;
  const generator=provider==="groq"?" **GPT-OSS 120B** writes research explanations through Groq when free quota is available."
    :provider==="gateway"?" **DeepSeek V4.1 Flash** writes explanations through Vercel AI Gateway when the free allowance is available."
    :provider==="worker"||provider==="cloudflare"?" **DeepSeek V4.1 Flash**, hosted on Cloudflare, writes research explanations.":" The guide returns source summaries and executes read-only lab tools.";
  const location=provider==="worker"?"INDUS runs on the developer’s machine in this setup.":"INDUS runs on Vercel.";
  return {status:"generated",mode:"guidance",origin:"product_context",answer:
    "I'm PyroGrav’s Space Guide. **NASA INDUS** retrieves relevant evidence from our reviewed study summaries."+generator+" I’m part of this Space Apps project, not an official NASA service.\n\n"+
    "- **Research with INDUS:** compare what PMMA and FLEX measure, inspect source limitations, and find saved validation results.\n"+
    "- **Run read-only tools:** look up published PMMA records (including flagged rows), check a new Earth or ISS condition, or inspect recorded FLEX burns. Give rod diameter, oxygen percentage and airflow for a PMMA check.\n"+
    "- **Explore the app:** use Dashboard for investigations, Simulation for comparisons, and Evidence for model scores.\n\n"+
    location+" The rate tools use frozen data and models. They cannot establish Moon/Mars accuracy or rank extinguisher effectiveness.",
    evidence:[],actions:[{label:"Explore investigations",href:"/dashboard"},{label:"Open PMMA lab",href:"/simulation?experiment=pmma"}]};
}

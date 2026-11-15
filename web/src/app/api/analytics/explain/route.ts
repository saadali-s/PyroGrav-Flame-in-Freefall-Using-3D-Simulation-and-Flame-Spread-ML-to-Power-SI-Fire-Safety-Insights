import {explainAnalytics,lookupAnalytics} from "@/lib/analytics-guide";
import {sameOrigin} from "@/lib/same-origin";

export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:"Origin mismatch."},{status:403});
  const input=await request.json().catch(()=>null);
  const result=lookupAnalytics(input);
  if(!result)return Response.json({error:"Unknown Analytics selection."},{status:400});
  return Response.json(await explainAnalytics(result,request.signal),{headers:{"cache-control":"no-store"}});
}


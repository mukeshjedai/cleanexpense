import OpenAI from 'openai';
import {z} from 'zod';
import {categories} from '@/lib/statement';
import {authenticated} from '@/lib/session';
import {loadTransactions} from '@/lib/storage';
import {makeForecast} from '@/lib/forecast';
import {generateAIForecast} from '@/lib/ai-forecast';
import {claimForecast,completeForecast,failForecast,savedForecasts} from '@/lib/saved-forecasts';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};

export async function GET(request:Request){
 if(!authenticated(request))return Response.json({error:'Please sign in.'},{status:401,headers});
 try{const url=new URL(request.url),horizon=z.coerce.number().int().min(7).max(30).parse(url.searchParams.get('horizon')||14),category=z.enum(['All categories',...categories]).parse(url.searchParams.get('category')||'All categories'),id=url.searchParams.has('id')?z.uuid().parse(url.searchParams.get('id')):undefined;return Response.json({configured:!!process.env.OPENAI_API_KEY,...await savedForecasts(horizon,category,id)},{headers});}catch{return Response.json({error:'Could not load saved forecasts. Check the database connection and filters.'},{status:502,headers});}
}
export async function POST(request:Request){
 const error=(message:string,status=400)=>Response.json({error:message},{status,headers});
 if(!authenticated(request))return error('Please sign in to generate predictions.',401);
 if(!process.env.OPENAI_API_KEY)return error('Set OPENAI_API_KEY on the server to enable AI predictions. The statistical preview remains available.',503);
 let claimedId:string|undefined;
 try{
  const text=await request.text();if(text.length>4096)return error('Forecast request is too large.',413);
  const body=z.object({horizon:z.number().int().min(7).max(30),category:z.enum(['All categories',...categories]),consent:z.literal(true),requestId:z.uuid()}).parse(JSON.parse(text));
  const existing=await savedForecasts(body.horizon,body.category,body.requestId);
  if(existing.saved)return Response.json({saved:existing.saved,reused:true},{headers});
  const saved=await loadTransactions();if(!saved)return error('No saved transactions are available.');
  const baseline=makeForecast(saved.transactions,body.horizon,body.category);
  if(!await claimForecast(body.requestId,body.horizon,body.category,saved.currency,saved.filename,baseline.history.at(-1)!.date))return error('This forecast request is already running or has finished. Reload saved forecasts before starting a new request.',409);
  claimedId=body.requestId;
  const result=await completeForecast(body.requestId,await generateAIForecast(baseline,saved.currency));
  return Response.json({saved:result,reused:false},{headers});
 }catch(e){if(claimedId)await failForecast(claimedId).catch(()=>{});if(e instanceof OpenAI.APIError)return error(e.status===429?'OpenAI rate or budget limit reached. Try again later.':'OpenAI request failed. Check API key and model access.',502);if(e instanceof z.ZodError||e instanceof SyntaxError)return error('Choose a valid horizon and category and enable AI data consent.');return error(e instanceof Error?e.message:'Forecast generation failed.',422);}
}

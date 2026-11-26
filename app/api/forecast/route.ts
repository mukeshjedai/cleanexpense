import OpenAI from 'openai';
import {z} from 'zod';
import {categories} from '@/lib/statement';
import {authenticated} from '@/lib/session';
import {loadTransactions} from '@/lib/storage';
import {makeForecast} from '@/lib/forecast';
import {generateAIForecast} from '@/lib/ai-forecast';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};

export async function GET(request:Request){if(!authenticated(request))return Response.json({error:'Please sign in.'},{status:401,headers});return Response.json({configured:!!process.env.OPENAI_API_KEY},{headers});}
export async function POST(request:Request){
 const error=(message:string,status=400)=>Response.json({error:message},{status,headers});
 if(!authenticated(request))return error('Please sign in to generate predictions.',401);
 if(!process.env.OPENAI_API_KEY)return error('Set OPENAI_API_KEY on the server to enable AI predictions. The statistical preview remains available.',503);
 try{
  const text=await request.text();if(text.length>4096)return error('Forecast request is too large.',413);
  const body=z.object({horizon:z.number().int().min(7).max(30),category:z.enum(['All categories',...categories]),consent:z.literal(true)}).parse(JSON.parse(text));
  const saved=await loadTransactions();if(!saved)return error('No saved transactions are available.');
  const baseline=makeForecast(saved.transactions,body.horizon,body.category);
  return Response.json({report:await generateAIForecast(baseline,saved.currency)},{headers});
 }catch(e){if(e instanceof OpenAI.APIError)return error(e.status===429?'OpenAI rate or budget limit reached. Try again later.':'OpenAI request failed. Check API key and model access.',502);if(e instanceof z.ZodError||e instanceof SyntaxError)return error('Choose a valid horizon and category and enable AI data consent.');return error(e instanceof Error?e.message:'Forecast generation failed.',422);}
}

import { authenticated } from '@/lib/session';
import { z,ZodError } from 'zod';
import {categories} from '@/lib/statement';
import {correctPostgresCategory,importPostgres} from '@/lib/postgres';
import { loadTransactions, saveTransactions,storageConfigured,storageName } from '@/lib/storage';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
function authorize(request:Request){
 const secret=process.env.APP_ACCESS_TOKEN;
 if(!secret||!storageConfigured())return Response.json({error:'Transaction storage is not configured on the server.'},{status:503,headers});
 if(!authenticated(request))return Response.json({error:'Please sign in to load or save transactions.'},{status:401,headers});
}
export async function GET(request:Request){
 const denied=authorize(request);if(denied)return denied;
 try{return Response.json({saved:await loadTransactions(),storage:storageName()},{headers});}catch{return Response.json({error:'Could not load saved transactions. Check the server storage configuration.'},{status:502,headers});}
}
export async function POST(request:Request){
 const denied=authorize(request);if(denied)return denied;
 try{
  let length=0;const chunks:Uint8Array[]=[];
  if(request.body){const reader=request.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>3_000_000){await reader.cancel();return Response.json({error:'Transaction data exceeds 3 MB.'},{status:413,headers});}chunks.push(value);}}finally{reader.releaseLock();}}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(body.action==='preview'||body.action==='import'){
   if(!process.env.DATABASE_URL)return Response.json({error:'Database imports require PostgreSQL configuration.'},{status:503,headers});
   return Response.json({...await importPostgres(body,body.action==='preview'),storage:'PostgreSQL'},{headers});
  }
  return Response.json({...await saveTransactions(body),storage:storageName()},{headers});
 }catch(e){const invalid=e instanceof ZodError||e instanceof SyntaxError;return Response.json({error:invalid?'Invalid transaction data. Check dates, amounts, categories and currency.':'Could not save transactions. Your data remains in this session; try again.'},{status:invalid?400:502,headers});}
}
export async function PATCH(request:Request){
 const denied=authorize(request);if(denied)return denied;
 if(!process.env.DATABASE_URL)return Response.json({error:'Automatic category saving requires PostgreSQL configuration.'},{status:503,headers});
 try{
  const text=await request.text();if(text.length>5000)return Response.json({error:'Category request is too large.'},{status:413,headers});
  const body=z.object({description:z.string().trim().min(1).max(1000),category:z.enum(categories)}).parse(JSON.parse(text));
  return Response.json({...await correctPostgresCategory(body.description,body.category),storage:'PostgreSQL'},{headers});
 }catch(e){const invalid=e instanceof ZodError||e instanceof SyntaxError;return Response.json({error:invalid?'Invalid category correction.':'Could not save category correction. No local changes were applied; try again.'},{status:invalid?400:502,headers});}
}

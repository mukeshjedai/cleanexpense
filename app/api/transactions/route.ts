import { authenticated } from '@/lib/session';
import { ZodError } from 'zod';
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
  return Response.json({...await saveTransactions(body),storage:storageName()},{headers});
 }catch(e){const invalid=e instanceof ZodError||e instanceof SyntaxError;return Response.json({error:invalid?'Invalid transaction data. Check dates, amounts, categories and currency.':'Could not save transactions. Your data remains in this session; try again.'},{status:invalid?400:502,headers});}
}

import { NextResponse } from 'next/server';
import { authenticated, createSession, matchesToken, sessionCookie, sessionDuration } from '@/lib/session';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){return NextResponse.json({authenticated:authenticated(request)},{headers});}
export async function POST(request:Request){
 if(!process.env.APP_ACCESS_TOKEN)return NextResponse.json({error:'App access is not configured on the server.'},{status:503,headers});
 try{
 const reader=request.body?.getReader();if(!reader)return NextResponse.json({error:'Enter your app passphrase.'},{status:400,headers});
 const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2048){await reader.cancel();return NextResponse.json({error:'Invalid passphrase.'},{status:400,headers});}chunks.push(value);}}finally{reader.releaseLock();}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(typeof data.token!=='string'||!matchesToken(data.token))return NextResponse.json({error:'Incorrect app passphrase.'},{status:401,headers});
 const response=NextResponse.json({authenticated:true},{headers});response.cookies.set(sessionCookie,createSession(),{httpOnly:true,secure:process.env.NODE_ENV==='production'&&!new URL(request.url).hostname.match(/^(localhost|127\.0\.0\.1)$/),sameSite:'strict',path:'/',maxAge:sessionDuration});return response;
 }catch{return NextResponse.json({error:'Unable to sign in. Try again.'},{status:400,headers});}
}
export async function DELETE(){const response=NextResponse.json({authenticated:false},{headers});response.cookies.set(sessionCookie,'',{httpOnly:true,path:'/',maxAge:0,sameSite:'strict'});return response;}

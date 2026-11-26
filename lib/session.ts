import { createHmac, timingSafeEqual } from 'node:crypto';
export const sessionCookie='cleanexpense_session';
export const sessionDuration=60*60*24*7;
export function matchesToken(value:string){const secret=process.env.APP_ACCESS_TOKEN;return !!secret&&Buffer.byteLength(value)===Buffer.byteLength(secret)&&timingSafeEqual(Buffer.from(value),Buffer.from(secret));}
export function createSession(now=Date.now()){
 const secret=process.env.APP_ACCESS_TOKEN;if(!secret)throw new Error('App access is not configured');
 const expires=String(Math.floor(now/1000)+sessionDuration);
 return `${expires}.${createHmac('sha256',secret).update('cleanexpense-session:'+expires).digest('hex')}`;
}
export function validSession(value:string,now=Date.now()){
 const secret=process.env.APP_ACCESS_TOKEN;if(!secret)return false;
 const match=value.match(/^(\d{10})\.([a-f0-9]{64})$/);if(!match)return false;
 const expiry=Number(match[1]);if(expiry<=Math.floor(now/1000)||expiry>Math.floor(now/1000)+sessionDuration)return false;
 const signature=createHmac('sha256',secret).update('cleanexpense-session:'+match[1]).digest('hex');
 return timingSafeEqual(Buffer.from(match[2]),Buffer.from(signature));
}
export function authenticated(request:Request){
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)||'';
 return validSession(cookie)||matchesToken(request.headers.get('authorization')?.replace(/^Bearer /,'')||'');
}

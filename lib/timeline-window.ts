export function shiftDate(date:string,days:number){const value=new Date(date+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
export function windowEnding(end:string,days=7){return {start:shiftDate(end,-Math.max(0,days-1)),end};}
export function daysInWindow(start:string,end:string){return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;}
export function zoomWindow(start:string,end:string,direction:'in'|'out',maximumDays:number){const current=daysInWindow(start,end);return windowEnding(end,direction==='in'?Math.max(1,Math.ceil(current/2)):Math.min(Math.max(maximumDays,7),current*2));}
import type { Transaction } from './statement';
export function newestExpenseFirst(a:Transaction,b:Transaction){return b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||a.id.localeCompare(b.id);}
